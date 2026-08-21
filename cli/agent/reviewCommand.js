/**
 * /review — a second-opinion LLM pass over the changes you're about to commit.
 *
 * Same machinery as supervisor.js (a silent reviewer pass that critiques
 * something before it lands), pointed at a staged diff instead of a pending
 * tool call.
 *
 * The part that isn't "just a prompt" is the indexing below. A raw diff has no
 * line numbers in its body, so a reviewer asked to cite "file and line" can
 * only guess — and a finding you can't jump to is barely a finding. indexDiff
 * walks the hunk headers, hands every body line its real new-file line number,
 * and records which numbers are citable per file, so a finding's location can
 * be checked against the diff instead of trusted.
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { EVENTS } from '../core/eventBus.js';
import { gitStatus, gitDiff } from './gitTools.js';
import { streamLLM } from './llmStream.js';
import { safeWorkspacePath } from './pathSafety.js';
import { maybeConfirmAndExecute } from './confirm.js';

/**
 * Strip git's `a/` / `b/` prefix (and any surrounding quotes) from a diff
 * header path. Returns null for /dev/null, which marks a create or delete.
 */
function stripDiffPath(raw) {
  let path = (raw || '').trim();
  // git quotes paths containing spaces or non-ASCII: +++ "b/some file.js"
  if (path.startsWith('"') && path.endsWith('"') && path.length > 1) {
    path = path.slice(1, -1);
  }
  if (path === '/dev/null') return null;
  if (path.startsWith('a/') || path.startsWith('b/')) return path.slice(2);
  return path;
}

// Git's extended header lines, which sit between `diff --git` and the `---`/
// `+++` pair and carry no review-relevant information.
const EXTENDED_HEADER_RE = /^(index |old mode |new mode |new file mode |deleted file mode |similarity index |dissimilarity index |rename (from|to) |copy (from|to) )/;

const LINE_NO_WIDTH = 5;
const BLANK_GUTTER = ' '.repeat(LINE_NO_WIDTH);

function gutter(n) {
  return String(n).padStart(LINE_NO_WIDTH);
}

/**
 * Parse a unified diff into (a) a line-numbered rendering for the reviewer
 * prompt and (b) a per-file index of the line numbers a finding is allowed to
 * cite.
 *
 * For a normal file, citable lines are the new-file numbers of added and
 * context lines — the ones that exist after the commit and can be jumped to.
 * For a deleted file there is no "after", so its old-file numbers are used
 * instead; that's the only location a finding about the deletion could name.
 *
 * @param {string} diff - unified diff text (`git diff` / `git diff --cached`)
 * @returns {{
 *   annotated: string,
 *   files: Map<string, { lines: Set<number>, changed: Set<number>, deleted: boolean }>,
 *   fileCount: number,
 * }}
 */
export function indexDiff(diff) {
  const files = new Map();
  const out = [];

  let current = null;   // index entry for the file being parsed
  let oldPath = null;   // path from the most recent `--- ` line
  let newLine = 0;
  let oldLine = 0;

  const fileEntry = (path, deleted) => {
    let entry = files.get(path);
    if (!entry) {
      entry = { lines: new Set(), changed: new Set(), deleted };
      files.set(path, entry);
    } else if (deleted) {
      entry.deleted = true;
    }
    return entry;
  };

  for (const line of String(diff ?? '').split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = null;
      oldPath = null;
      continue;
    }

    if (line.startsWith('--- ')) {
      oldPath = stripDiffPath(line.slice(4));
      continue;
    }

    if (line.startsWith('+++ ')) {
      const newPath = stripDiffPath(line.slice(4));
      // +++ /dev/null means the file was deleted; its name is on the --- line.
      const path = newPath ?? oldPath;
      if (!path) {
        current = null;
        continue;
      }
      current = fileEntry(path, newPath === null);
      out.push(`### FILE: ${path}${current.deleted ? ' (deleted)' : ''}`);
      continue;
    }

    if (line.startsWith('@@')) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldLine = match ? Number(match[1]) : 0;
      newLine = match ? Number(match[2]) : 0;
      out.push(line);
      continue;
    }

    // Outside a hunk. Git's extended headers (index/mode/rename metadata) tell
    // a reviewer nothing and just spend context, so they're dropped; anything
    // else here — "Binary files … differ", the truncation note gitDiff appends
    // — is real information and passes through.
    if (!current) {
      if (line && !EXTENDED_HEADER_RE.test(line)) out.push(line);
      continue;
    }

    const marker = line[0];
    const body = line.slice(1);

    if (marker === '+') {
      current.lines.add(newLine);
      current.changed.add(newLine);
      out.push(`${gutter(newLine)} + ${body}`);
      newLine += 1;
    } else if (marker === '-') {
      // Removed lines have no new-file location, so they're citable only when
      // the whole file is gone and there's nothing else to point at.
      if (current.deleted) {
        current.lines.add(oldLine);
        current.changed.add(oldLine);
      }
      out.push(`${gutter(oldLine)} - ${body}`);
      oldLine += 1;
    } else if (marker === ' ') {
      current.lines.add(newLine);
      out.push(`${gutter(newLine)}   ${body}`);
      newLine += 1;
      oldLine += 1;
    } else {
      // "\ No newline at end of file", stray blank lines, anything unexpected.
      if (line) out.push(`${BLANK_GUTTER}   ${line}`);
    }
  }

  return { annotated: out.join('\n'), files, fileCount: files.size };
}

// ─── Review pass ──────────────────────────────────────────────────────────────

/** Severity buckets, in the order findings are reported. */
export const SEVERITY_ORDER = ['bug', 'security', 'perf', 'tests', 'api', 'other'];

export const SEVERITY_LABELS = {
  bug:      'Likely bugs',
  security: 'Security',
  perf:     'Performance',
  tests:    'Missing tests',
  api:      'Breaking API changes',
  other:    'Other',
};

// Models don't reliably return the exact enum they were given, so near-misses
// are mapped rather than dumped into "other" where they'd be sorted last.
const SEVERITY_ALIASES = new Map(Object.entries({
  bug: 'bug', bugs: 'bug', correctness: 'bug', logic: 'bug', crash: 'bug', error: 'bug', defect: 'bug',
  security: 'security', vulnerability: 'security', vuln: 'security', injection: 'security', secret: 'security', secrets: 'security',
  perf: 'perf', performance: 'perf', efficiency: 'perf', memory: 'perf',
  test: 'tests', tests: 'tests', testing: 'tests', coverage: 'tests', 'missing-tests': 'tests', 'missing_tests': 'tests', 'missing-test': 'tests',
  api: 'api', breaking: 'api', 'breaking-change': 'api', 'breaking-api': 'api', compatibility: 'api', interface: 'api',
}));

const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);

// Enough room for a substantial changeset without risking the context window.
const MAX_ANNOTATED_CHARS = 60_000;

const REVIEW_INSTRUCTIONS = `You are a senior engineer reviewing a change before it is committed.

The diff below is line-numbered: on each line, the leading number is that line's
real line number in the file AFTER this change, followed by a marker
(+ added, - removed, blank = unchanged context).

Report only problems you can point at in this diff. For each finding, classify:

severity (pick exactly one):
  bug      - it will produce wrong behaviour, a crash, or data loss
  security - injection, auth/authz gap, leaked secret, unsafe deserialization, path traversal
  perf     - a real efficiency problem at the scale this code runs at
  tests    - behaviour introduced here that needs a test and doesn't have one
  api      - a breaking change to a signature, export, schema, or CLI contract that callers depend on

confidence (be honest, this is the most useful part of the review):
  high     - you can name the concrete input or state that triggers it
  medium   - likely wrong, but it depends on code you cannot see in this diff
  low      - a suspicion worth a second look, nothing more

Rules:
- "file" must be exactly one of the paths listed under FILES CHANGED.
- "line" must be one of the numbers shown in the diff for that file.
- Do NOT report style, formatting, naming preferences, comment density, or
  "consider extracting this" refactors. Those are not findings.
- Do NOT pad the list to look thorough. An empty findings array is a correct,
  respected answer for a clean change, and is far more useful than nitpicks.
- Judge the code as it will exist after the change, not the diff in isolation.

Respond ONLY with valid JSON - no markdown fences, no prose before or after:
{"findings":[{"severity":"bug","file":"path/to/file.js","line":42,"confidence":"high","title":"one line, what is wrong","detail":"why it is wrong and what happens when it goes wrong","fix":"the concrete change that would fix it"}]}`;

/**
 * Build the reviewer prompt from an indexed diff.
 *
 * @param {{ annotated: string, files: Map<string, object> }} index - from indexDiff
 * @param {{ mode?: 'staged'|'unstaged', truncated?: boolean }} [opts]
 */
export function buildReviewPrompt(index, { mode = 'staged', truncated = false } = {}) {
  let body = index.annotated;
  let clipped = false;
  if (body.length > MAX_ANNOTATED_CHARS) {
    body = body.slice(0, MAX_ANNOTATED_CHARS);
    clipped = true;
  }

  const fileList = [...index.files.keys()].map((p) => `- ${p}`).join('\n');
  const scope = mode === 'staged'
    ? 'These are the STAGED changes, about to be committed.'
    : 'Nothing is staged, so these are the UNCOMMITTED working-tree changes.';
  const truncNote = (truncated || clipped)
    ? '\n\nNOTE: this diff was truncated for length. Review what is shown; do not speculate about the omitted part.'
    : '';

  return `${REVIEW_INSTRUCTIONS}

${scope}${truncNote}

FILES CHANGED:
${fileList}

DIFF:
${body}

Respond ONLY with JSON.`;
}

function normalizeFinding(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const severityKey = String(raw.severity ?? '').trim().toLowerCase();
  const confidence = String(raw.confidence ?? '').trim().toLowerCase();
  const lineValue = Number.parseInt(raw.line, 10);
  const title = String(raw.title ?? '').trim();
  const detail = String(raw.detail ?? '').trim();

  // A finding with nothing to say isn't a finding.
  if (!title && !detail) return null;

  return {
    severity:   SEVERITY_ALIASES.get(severityKey) ?? 'other',
    file:       String(raw.file ?? '').trim(),
    line:       Number.isFinite(lineValue) ? lineValue : null,
    confidence: CONFIDENCE_LEVELS.has(confidence) ? confidence : 'medium',
    title:      title || detail.split('\n')[0].slice(0, 120),
    detail,
    fix:        String(raw.fix ?? '').trim(),
  };
}

/**
 * Pull the findings array out of a reviewer response. Tolerates markdown
 * fences and stray prose around the JSON, and accepts either {"findings":[…]}
 * or a bare array. An explicitly empty list parses as zero findings — that's a
 * clean review, not a failure.
 *
 * @returns {{ findings: object[] } | { error: string }}
 */
export function parseReviewResponse(raw) {
  const text = String(raw ?? '');
  const candidates = [];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]);

  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) candidates.push(text.slice(objStart, objEnd + 1));

  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) candidates.push(text.slice(arrStart, arrEnd + 1));

  for (const candidate of candidates) {
    let parsed;
    try {
      parsed = JSON.parse(candidate.trim());
    } catch {
      continue;
    }
    const list = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed?.findings) ? parsed.findings
      : null;
    if (list) return { findings: list.map(normalizeFinding).filter(Boolean) };
  }

  return { error: 'Could not parse the reviewer response as JSON.' };
}

/** Normalize a model-supplied path the way a human would read it. */
function canonicalizePath(raw) {
  let path = String(raw ?? '').trim().replace(/^\.\//, '');
  if (path.startsWith('a/') || path.startsWith('b/')) path = path.slice(2);
  return path;
}

/**
 * Match a cited path against the files actually in the diff. Exact first, then
 * a unique suffix match, then a unique basename match — so `math.js` or
 * `src/math.js` both resolve when only one such file changed, while an
 * ambiguous or invented path resolves to nothing and the finding is dropped.
 */
function resolveFile(cited, files) {
  const path = canonicalizePath(cited);
  if (!path) return null;
  if (files.has(path)) return path;

  const known = [...files.keys()];
  const suffixHits = known.filter((k) => k.endsWith(`/${path}`));
  if (suffixHits.length === 1) return suffixHits[0];

  const base = path.split('/').pop();
  const baseHits = known.filter((k) => k.split('/').pop() === base);
  if (baseHits.length === 1) return baseHits[0];

  return null;
}

/**
 * Snap a cited line onto a line that actually appears in the diff for that
 * file, so the reported location is always somewhere you can jump to. Returns
 * `adjusted: true` when the number moved, which the formatter surfaces rather
 * than hiding.
 */
function snapLine(line, entry) {
  const citable = [...entry.lines].sort((a, b) => a - b);
  if (citable.length === 0) return { line: null, adjusted: false };
  if (line != null && entry.lines.has(line)) return { line, adjusted: false };

  // No usable number at all — point at the first changed line in the file.
  if (line == null) {
    const changed = [...entry.changed].sort((a, b) => a - b);
    return { line: changed[0] ?? citable[0], adjusted: true };
  }

  let nearest = citable[0];
  for (const candidate of citable) {
    if (Math.abs(candidate - line) < Math.abs(nearest - line)) nearest = candidate;
  }
  return { line: nearest, adjusted: true };
}

/**
 * Check every finding against the diff it claims to describe. A finding whose
 * file isn't in the diff was invented and is dropped; a low-confidence finding
 * that didn't land in a real severity bucket is the nitpick padding the prompt
 * asked for less of, and is dropped too. Everything kept is guaranteed to
 * carry a file and line you can open.
 *
 * @returns {{ findings: object[], dropped: object[] }}
 */
export function validateFindings(findings, files) {
  const kept = [];
  const dropped = [];

  for (const finding of findings || []) {
    const file = resolveFile(finding.file, files);
    if (!file) {
      dropped.push({ ...finding, reason: 'cited a file that is not in the diff' });
      continue;
    }
    if (finding.severity === 'other' && finding.confidence === 'low') {
      dropped.push({ ...finding, reason: 'low-confidence nitpick' });
      continue;
    }

    const { line, adjusted } = snapLine(finding.line, files.get(file));
    kept.push({ ...finding, file, line, lineAdjusted: adjusted });
  }

  kept.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });

  return { findings: kept, dropped };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function indentBlock(text, pad) {
  return String(text)
    .split('\n')
    .map((l) => `${pad}${l.trim()}`)
    .join('\n');
}

function plural(n, word, pluralForm = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralForm}`;
}

/**
 * Render a validated review for the terminal, grouped by severity in
 * SEVERITY_ORDER. Every finding line is `path:line`, which terminals make
 * clickable, so the report is navigable rather than just readable.
 *
 * Deliberately reports what was thrown away and how confident the reviewer
 * actually was — a review that hides its own uncertainty is worth less than
 * one you can calibrate against.
 */
export function formatReview({ findings = [], dropped = [], fileCount = 0, mode = 'staged', truncated = false } = {}) {
  const scope = mode === 'staged' ? 'staged' : 'unstaged';
  const lines = [];

  if (findings.length === 0) {
    lines.push(`🔍 Review of ${plural(fileCount, 'file')} (${scope}) — no findings.`);
    lines.push('Nothing here looked like a bug, a security issue, or a missing test worth flagging.');
  } else {
    lines.push(`🔍 Review of ${plural(fileCount, 'file')} (${scope}) — ${plural(findings.length, 'finding')}:`);

    for (const severity of SEVERITY_ORDER) {
      const group = findings.filter((f) => f.severity === severity);
      if (group.length === 0) continue;

      lines.push('');
      lines.push(`${SEVERITY_LABELS[severity]} (${group.length})`);
      for (const f of group) {
        const location = f.line == null ? f.file : `${f.file}:${f.line}`;
        const snapped = f.lineAdjusted ? ' (nearest changed line)' : '';
        lines.push(`  ● ${location}${snapped}  [${f.confidence}]  ${f.title}`);
        if (f.detail) lines.push(indentBlock(f.detail, '      '));
        if (f.fix) lines.push(indentBlock(`Fix: ${f.fix}`, '      '));
      }
    }
  }

  const notes = [];
  if (truncated) {
    notes.push('The diff was too large to review in full — later changes were not looked at.');
  }
  if (findings.length > 0 && !findings.some((f) => f.confidence === 'high')) {
    notes.push('Nothing here is high-confidence — treat all of it as worth a look, not as established.');
  }
  if (dropped.length > 0) {
    const reasons = new Map();
    for (const d of dropped) reasons.set(d.reason, (reasons.get(d.reason) ?? 0) + 1);
    const summary = [...reasons].map(([reason, count]) => `${count} ${reason}`).join(', ');
    notes.push(`Discarded ${plural(dropped.length, 'finding')} before showing you this: ${summary}.`);
  }

  if (notes.length > 0) {
    lines.push('');
    lines.push(...notes.map((n) => `· ${n}`));
  }

  return lines.join('\n');
}

// ─── --fix ────────────────────────────────────────────────────────────────────

const MAX_FIX_FILES = 8;
const MAX_FIX_FILE_CHARS = 30_000;

const FIX_INSTRUCTIONS = `You are fixing findings from a code review you just produced.

For each finding you can fix with a small, local edit, emit one patch. A patch
replaces an exact string in a file with a new string.

Rules:
- "oldString" must be copied VERBATIM from the file content shown below,
  including exact indentation and whitespace. Do not retype it from memory.
- Include enough surrounding lines that "oldString" occurs exactly ONCE in that
  file. A one-line oldString that appears twice is not usable.
- "newString" is the complete replacement for "oldString".
- OMIT any finding you cannot fix this way - one that needs a new file, a new
  test, a design decision, or a change you are not confident about. Omitting is
  correct and expected; a wrong patch is far worse than a missing one.
- Never "fix" a finding by deleting the feature or weakening the check.

Respond ONLY with valid JSON - no markdown fences, no prose:
{"patches":[{"finding":1,"file":"path/to/file.js","oldString":"...","newString":"...","note":"one line describing the change"}]}`;

/**
 * Read the current on-disk content of the files a set of findings points at.
 * Content is passed to the patch pass verbatim (no line numbers) because the
 * model has to copy oldString out of it character for character.
 */
async function readCitedFiles(findings, cwd) {
  const paths = [...new Set(findings.map((f) => f.file))].slice(0, MAX_FIX_FILES);
  const files = [];

  for (const path of paths) {
    const safety = await safeWorkspacePath(path, cwd);
    if (safety.error || !existsSync(safety.resolved)) continue;
    let content;
    try {
      content = await readFile(safety.resolved, 'utf-8');
    } catch {
      continue;
    }
    files.push({
      path,
      content: content.length > MAX_FIX_FILE_CHARS ? content.slice(0, MAX_FIX_FILE_CHARS) : content,
      clipped: content.length > MAX_FIX_FILE_CHARS,
    });
  }

  return files;
}

export function buildFixPrompt(findings, files) {
  const findingBlock = findings.map((f, i) => {
    const lines = [`${i + 1}. [${f.severity}/${f.confidence}] ${f.file}:${f.line ?? '?'} - ${f.title}`];
    if (f.detail) lines.push(`   ${f.detail}`);
    if (f.fix) lines.push(`   Suggested fix: ${f.fix}`);
    return lines.join('\n');
  }).join('\n\n');

  const fileBlock = files.map((f) => (
    `### FILE: ${f.path}${f.clipped ? ' (truncated - do not patch past the end of what is shown)' : ''}\n${f.content}`
  )).join('\n\n');

  return `${FIX_INSTRUCTIONS}

FINDINGS:
${findingBlock}

CURRENT FILE CONTENTS:
${fileBlock}

Respond ONLY with JSON.`;
}

/**
 * Pull patches out of the fix pass's response, keeping only ones that name a
 * file some finding actually pointed at and carry a usable oldString. A patch
 * for an unrelated file is a hallucination, not a fix.
 *
 * @returns {{ patches: object[] } | { error: string }}
 */
export function parseFixResponse(raw, findings) {
  const text = String(raw ?? '');
  const candidates = [];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]);
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) candidates.push(text.slice(objStart, objEnd + 1));

  const allowedFiles = new Set((findings || []).map((f) => f.file));

  for (const candidate of candidates) {
    let parsed;
    try {
      parsed = JSON.parse(candidate.trim());
    } catch {
      continue;
    }
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.patches) ? parsed.patches : null;
    if (!list) continue;

    const patches = [];
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const file = canonicalizePath(raw.file);
      const oldString = typeof raw.oldString === 'string' ? raw.oldString : '';
      const newString = typeof raw.newString === 'string' ? raw.newString : null;
      // newString may legitimately be '' (a deletion); oldString may not.
      if (!allowedFiles.has(file) || !oldString || newString === null) continue;
      if (oldString === newString) continue;
      patches.push({ file, oldString, newString, note: String(raw.note ?? '').trim() });
    }
    return { patches };
  }

  return { error: 'Could not parse the fix response as JSON.' };
}

/**
 * Apply patches one at a time through the normal confirmation gate, so each
 * one shows its own diff preview and can be approved or denied individually —
 * the same path any agent file edit takes, including checkpointing for
 * /rewind. Nothing here writes to disk directly.
 */
export async function applyPatches(patches, { bus, cwd, config, modes = {}, executeFn = maybeConfirmAndExecute }) {
  const results = { applied: [], denied: [], failed: [] };

  for (const [i, patch] of patches.entries()) {
    const label = patch.note ? ` — ${patch.note}` : '';
    say(bus, `⚙ Fix ${i + 1}/${patches.length}: ${patch.file}${label}`);

    const result = await executeFn(
      bus,
      'edit_file',
      { filePath: patch.file, oldString: patch.oldString, newString: patch.newString },
      cwd,
      {
        autoApprove: !!(modes.autoMode || modes.acceptEdits),
        allowSet: config.allowSet,
        checkpoints: config.checkpoints,
        turnId: config.currentTurnId,
      }
    );

    if (result?.denied) results.denied.push(patch);
    else if (result?.error) results.failed.push({ patch, error: result.error });
    else results.applied.push(patch);
  }

  return results;
}

/**
 * Generate and apply patches for a set of findings.
 * @returns {Promise<string>} a summary line for the user
 */
export async function runFixPass({ findings, bus, cwd, config, modes, streamFn, executeFn, beginTurn }) {
  const files = await readCitedFiles(findings, cwd);
  if (files.length === 0) {
    return '🔧 No patchable files — the findings point at files that no longer exist on disk.';
  }

  bus.emit(EVENTS.AGENT_STATUS, { status: 'thinking', message: '🔧 Drafting fixes...' });

  let raw = '';
  await streamFn(bus, buildFixPrompt(findings, files), {
    config,
    silent: true,
    onToken: (token) => { raw += token; },
  });

  const parsed = parseFixResponse(raw, findings);
  if (parsed.error) return `🔧 Could not draft fixes: ${parsed.error}`;
  if (parsed.patches.length === 0) {
    return '🔧 No patches offered — none of these findings could be fixed with a safe local edit.';
  }

  // One turn for the whole batch, so /rewind undoes the fixes as a single unit.
  if (typeof beginTurn === 'function') beginTurn();

  // Approximate: the model may fold two findings into one patch, so clamp at 0
  // rather than reporting a negative "unfixed" count.
  const skipped = Math.max(0, findings.length - parsed.patches.length);
  const { applied, denied, failed } = await applyPatches(parsed.patches, { bus, cwd, config, modes, executeFn });

  const parts = [`🔧 ${plural(applied.length, 'fix', 'fixes')} applied`];
  if (denied.length) parts.push(`${denied.length} declined`);
  if (failed.length) parts.push(`${failed.length} failed to apply`);
  const summary = [`${parts.join(', ')}.`];

  if (failed.length) {
    summary.push(...failed.map(({ patch, error }) => `  ✗ ${patch.file}: ${error}`));
  }
  if (skipped > 0) {
    summary.push(`Findings without a patch are left for you — they needed more than a local edit.`);
  }
  if (applied.length) {
    summary.push('Fixes are unstaged; review them with git diff before committing.');
  }

  return summary.join('\n');
}

// ─── Command ──────────────────────────────────────────────────────────────────

// Far above git_diff's default 400 — a review that silently ignores half the
// changeset is worse than no review, so the cap is only a context-safety net.
const REVIEW_MAX_DIFF_LINES = 2000;

function say(bus, token) {
  bus.emit(EVENTS.LLM_TOKEN, { token });
}

function done(bus) {
  bus.emit(EVENTS.LLM_DONE, {});
}

/**
 * Pick what to review: staged changes if anything is staged, otherwise the
 * working tree. Reviewing nothing because you forgot to `git add` is a worse
 * failure than reviewing slightly more than you'll commit, and the report
 * always says which of the two it looked at.
 */
async function collectDiff(cwd) {
  const staged = await gitDiff(cwd, { staged: true, maxLines: REVIEW_MAX_DIFF_LINES });
  if (staged.error) return { error: staged.error };
  if (staged.diff.trim()) return { ...staged, mode: 'staged' };

  const unstaged = await gitDiff(cwd, { maxLines: REVIEW_MAX_DIFF_LINES });
  if (unstaged.error) return { error: unstaged.error };
  if (unstaged.diff.trim()) return { ...unstaged, mode: 'unstaged' };

  return { empty: true };
}

/**
 * Run the reviewer pass over an indexed diff. Separated from the command shell
 * so the LLM round-trip is one testable step.
 *
 * @returns {{ findings: object[], dropped: object[] } | { error: string }}
 */
export async function runReviewPass({ index, mode, truncated, bus, config, streamFn }) {
  const prompt = buildReviewPrompt(index, { mode, truncated });

  let raw = '';
  await streamFn(bus, prompt, {
    config,
    silent: true,
    onToken: (token) => { raw += token; },
  });

  if (!raw.trim()) {
    return { error: 'The reviewer returned nothing — the model call likely failed. Check /status and try again.' };
  }

  const parsed = parseReviewResponse(raw);
  if (parsed.error) {
    return { error: `${parsed.error} The model replied with prose instead of the requested JSON.` };
  }

  return validateFindings(parsed.findings, index.files);
}

/**
 * /review — read the changes you're about to commit and report what a senior
 * reviewer would flag, grouped by severity.
 *
 * @returns {Promise<boolean>} true if the text was this command
 */
export async function handleReviewCommand(text, {
  bus,
  config = {},
  modes = {},
  beginTurn = null,
  streamFn = streamLLM,
  executeFn = maybeConfirmAndExecute,
} = {}) {
  const match = (text || '').trim().match(/^\/review\b(.*)$/i);
  if (!match) return false;

  const args = match[1].trim();
  const fix = /^--fix$/i.test(args);
  if (args && !fix) {
    say(bus, `Unrecognised option "${args}". Usage: /review [--fix]`);
    done(bus);
    return true;
  }

  const cwd = config.workspaceDir || process.cwd();

  const repo = await gitStatus(cwd);
  if (repo.error) {
    say(bus, `🔍 Cannot review: ${repo.error}`);
    done(bus);
    return true;
  }

  const collected = await collectDiff(cwd);
  if (collected.error) {
    say(bus, `🔍 Cannot review: ${collected.error}`);
    done(bus);
    return true;
  }
  if (collected.empty) {
    say(bus, '🔍 Nothing to review — no staged or unstaged changes in this repo.');
    done(bus);
    return true;
  }

  const index = indexDiff(collected.diff);
  if (index.fileCount === 0) {
    say(bus, '🔍 Nothing reviewable in these changes (binary files only).');
    done(bus);
    return true;
  }

  const scopeNote = collected.mode === 'staged'
    ? `🔍 Reviewing ${plural(index.fileCount, 'staged file')}...`
    : `🔍 Nothing staged — reviewing ${plural(index.fileCount, 'changed file')} in the working tree...`;
  bus.emit(EVENTS.AGENT_STATUS, { status: 'thinking', message: scopeNote });

  const result = await runReviewPass({
    index,
    mode: collected.mode,
    truncated: collected.truncated,
    bus,
    config,
    streamFn,
  });

  if (result.error) {
    say(bus, `🔍 Review failed: ${result.error}`);
    done(bus);
    return true;
  }

  say(bus, formatReview({
    findings: result.findings,
    dropped: result.dropped,
    fileCount: index.fileCount,
    mode: collected.mode,
    truncated: collected.truncated,
  }));

  if (fix && result.findings.length > 0) {
    say(bus, await runFixPass({
      findings: result.findings,
      bus,
      cwd,
      config,
      modes,
      streamFn,
      executeFn,
      beginTurn,
    }));
  } else if (fix) {
    say(bus, '🔧 Nothing to fix.');
  }

  done(bus);
  return true;
}
