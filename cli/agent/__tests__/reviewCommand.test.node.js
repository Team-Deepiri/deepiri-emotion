import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { createEventBus, EVENTS } from '../../core/eventBus.js';
import {
  indexDiff,
  buildReviewPrompt,
  parseReviewResponse,
  validateFindings,
  formatReview,
  handleReviewCommand,
  parseFixResponse,
  applyPatches,
  runFixPass,
} from '../reviewCommand.js';

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

const MODIFIED_DIFF = [
  'diff --git a/src/math.js b/src/math.js',
  'index 1234567..89abcde 100644',
  '--- a/src/math.js',
  '+++ b/src/math.js',
  '@@ -10,4 +10,6 @@ export function sum(values) {',
  '   let total = 0;',
  '-  for (let i = 0; i <= values.length; i++) {',
  '+  for (let i = 0; i < values.length; i++) {',
  '+    if (values[i] == null) continue;',
  '     total += values[i];',
  '   }',
  '',
].join('\n');

describe('indexDiff', () => {
  it('numbers added and context lines with their new-file line numbers', () => {
    const { annotated } = indexDiff(MODIFIED_DIFF);
    const lines = annotated.split('\n');

    expect(lines[0]).toBe('### FILE: src/math.js');
    expect(lines[1]).toBe('@@ -10,4 +10,6 @@ export function sum(values) {');
    expect(lines[2]).toMatch(/^\s+10\s+let total = 0;$/);
    // The removed line carries its OLD number (11) and a - marker.
    expect(lines[3]).toMatch(/^\s+11 - {3}for \(let i = 0; i <= values\.length; i\+\+\) \{$/);
    expect(lines[4]).toMatch(/^\s+11 \+ {3}for \(let i = 0; i < values\.length; i\+\+\) \{$/);
    expect(lines[5]).toMatch(/^\s+12 \+ {5}if \(values\[i\] == null\) continue;$/);
    expect(lines[6]).toMatch(/^\s+13\s+total \+= values\[i\];$/);
  });

  it('records citable and changed lines per file', () => {
    const { files, fileCount } = indexDiff(MODIFIED_DIFF);

    expect(fileCount).toBe(1);
    const entry = files.get('src/math.js');
    expect(entry.deleted).toBe(false);
    // Added lines are 11 and 12; context lines are 10, 13, 14.
    expect([...entry.changed].sort((a, b) => a - b)).toEqual([11, 12]);
    expect([...entry.lines].sort((a, b) => a - b)).toEqual([10, 11, 12, 13, 14]);
  });

  it('does not make removed lines citable in a modified file', () => {
    const { files } = indexDiff(MODIFIED_DIFF);
    // Old line 11 (the removed loop) coincides with new line 11, but nothing
    // in the index comes from the removal itself.
    const entry = files.get('src/math.js');
    expect(entry.changed.has(11)).toBe(true); // from the + line, not the - line
    expect(entry.lines.has(15)).toBe(false);
  });

  it('indexes multiple files independently', () => {
    const diff = [
      MODIFIED_DIFF,
      'diff --git a/README.md b/README.md',
      '--- a/README.md',
      '+++ b/README.md',
      '@@ -1,2 +1,3 @@',
      ' # Title',
      '+added docs line',
      '',
    ].join('\n');

    const { files, fileCount, annotated } = indexDiff(diff);
    expect(fileCount).toBe(2);
    expect([...files.keys()]).toEqual(['src/math.js', 'README.md']);
    expect([...files.get('README.md').changed]).toEqual([2]);
    expect(annotated).toContain('### FILE: README.md');
  });

  it('names a deleted file from the --- line and makes its old lines citable', () => {
    const diff = [
      'diff --git a/src/old.js b/src/old.js',
      'deleted file mode 100644',
      '--- a/src/old.js',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-const a = 1;',
      '-const b = 2;',
      '',
    ].join('\n');

    const { files, annotated } = indexDiff(diff);
    const entry = files.get('src/old.js');
    expect(entry.deleted).toBe(true);
    expect([...entry.changed].sort((a, b) => a - b)).toEqual([1, 2]);
    expect(annotated).toContain('### FILE: src/old.js (deleted)');
  });

  it('names a new file and numbers it from 1', () => {
    const diff = [
      'diff --git a/src/new.js b/src/new.js',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/src/new.js',
      '@@ -0,0 +1,2 @@',
      '+export const x = 1;',
      '+export const y = 2;',
      '',
    ].join('\n');

    const { files } = indexDiff(diff);
    const entry = files.get('src/new.js');
    expect(entry.deleted).toBe(false);
    expect([...entry.changed].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('unquotes paths containing spaces', () => {
    const diff = [
      'diff --git "a/src/my file.js" "b/src/my file.js"',
      '--- "a/src/my file.js"',
      '+++ "b/src/my file.js"',
      '@@ -1 +1 @@',
      '+const a = 1;',
      '',
    ].join('\n');

    expect([...indexDiff(diff).files.keys()]).toEqual(['src/my file.js']);
  });

  it('passes through non-hunk content and survives an empty diff', () => {
    expect(indexDiff('').fileCount).toBe(0);
    expect(indexDiff('').annotated).toBe('');

    const binary = [
      'diff --git a/logo.png b/logo.png',
      'Binary files a/logo.png and b/logo.png differ',
      '',
    ].join('\n');
    expect(indexDiff(binary).annotated).toContain('Binary files');
  });
});

describe('buildReviewPrompt', () => {
  it('lists the changed files and embeds the numbered diff', () => {
    const prompt = buildReviewPrompt(indexDiff(MODIFIED_DIFF));
    expect(prompt).toContain('FILES CHANGED:\n- src/math.js');
    expect(prompt).toContain('### FILE: src/math.js');
    expect(prompt).toContain('STAGED changes');
    expect(prompt).toContain('empty findings array');
  });

  it('says so when reviewing unstaged work', () => {
    const prompt = buildReviewPrompt(indexDiff(MODIFIED_DIFF), { mode: 'unstaged' });
    expect(prompt).toContain('UNCOMMITTED working-tree changes');
    expect(prompt).not.toContain('STAGED changes');
  });

  it('warns the reviewer not to speculate about a truncated diff', () => {
    const prompt = buildReviewPrompt(indexDiff(MODIFIED_DIFF), { truncated: true });
    expect(prompt).toContain('truncated');
    expect(prompt).toContain('do not speculate');
  });
});

describe('parseReviewResponse', () => {
  const finding = { severity: 'bug', file: 'src/math.js', line: 11, confidence: 'high', title: 't', detail: 'd', fix: 'f' };

  it('parses a clean JSON object', () => {
    const result = parseReviewResponse(JSON.stringify({ findings: [finding] }));
    expect(result.error).toBeUndefined();
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ severity: 'bug', file: 'src/math.js', line: 11, confidence: 'high' });
  });

  it('parses through markdown fences and surrounding prose', () => {
    const raw = `Sure, here's the review:\n\`\`\`json\n${JSON.stringify({ findings: [finding] })}\n\`\`\`\nHope that helps!`;
    expect(parseReviewResponse(raw).findings).toHaveLength(1);
  });

  it('accepts a bare array', () => {
    expect(parseReviewResponse(JSON.stringify([finding])).findings).toHaveLength(1);
  });

  it('treats an empty findings list as a clean review, not an error', () => {
    const result = parseReviewResponse('{"findings":[]}');
    expect(result.error).toBeUndefined();
    expect(result.findings).toEqual([]);
  });

  it('reports an error when there is no JSON at all', () => {
    expect(parseReviewResponse('I could not review this.').error).toMatch(/parse/i);
    expect(parseReviewResponse('').error).toMatch(/parse/i);
  });

  it('maps severity synonyms and defaults an unknown confidence to medium', () => {
    const raw = JSON.stringify({ findings: [
      { severity: 'correctness', file: 'a.js', line: 1, title: 'x', confidence: 'pretty sure' },
      { severity: 'vulnerability', file: 'a.js', line: 1, title: 'y' },
      { severity: 'wat', file: 'a.js', line: 1, title: 'z' },
    ] });
    const { findings } = parseReviewResponse(raw);
    expect(findings.map((f) => f.severity)).toEqual(['bug', 'security', 'other']);
    expect(findings[0].confidence).toBe('medium');
  });

  it('drops entries with no title and no detail', () => {
    const raw = JSON.stringify({ findings: [{ severity: 'bug', file: 'a.js', line: 1 }, finding] });
    expect(parseReviewResponse(raw).findings).toHaveLength(1);
  });
});

describe('validateFindings', () => {
  const { files } = indexDiff(MODIFIED_DIFF);
  const base = { severity: 'bug', confidence: 'high', title: 't', detail: 'd', fix: '' };

  it('keeps a finding that cites a real file and a line in the diff', () => {
    const { findings, dropped } = validateFindings([{ ...base, file: 'src/math.js', line: 12 }], files);
    expect(dropped).toEqual([]);
    expect(findings[0]).toMatchObject({ file: 'src/math.js', line: 12, lineAdjusted: false });
  });

  it('drops a finding that cites a file not in the diff', () => {
    const { findings, dropped } = validateFindings([{ ...base, file: 'src/invented.js', line: 12 }], files);
    expect(findings).toEqual([]);
    expect(dropped[0].reason).toMatch(/not in the diff/);
  });

  it('resolves a bare basename to the one matching changed file', () => {
    const { findings } = validateFindings([{ ...base, file: 'math.js', line: 11 }], files);
    expect(findings[0].file).toBe('src/math.js');
  });

  it('snaps an out-of-range line onto the nearest line in the diff and flags it', () => {
    const { findings } = validateFindings([{ ...base, file: 'src/math.js', line: 400 }], files);
    expect(findings[0].line).toBe(14);
    expect(findings[0].lineAdjusted).toBe(true);
  });

  it('points a finding with no line at the first changed line', () => {
    const { findings } = validateFindings([{ ...base, file: 'src/math.js', line: null }], files);
    expect(findings[0].line).toBe(11);
    expect(findings[0].lineAdjusted).toBe(true);
  });

  it('drops low-confidence findings that are not a real severity', () => {
    const nitpick = { ...base, severity: 'other', confidence: 'low', file: 'src/math.js', line: 11 };
    const { findings, dropped } = validateFindings([nitpick], files);
    expect(findings).toEqual([]);
    expect(dropped[0].reason).toMatch(/nitpick/);
  });

  it('keeps a low-confidence finding when it names a real severity', () => {
    const hunch = { ...base, severity: 'security', confidence: 'low', file: 'src/math.js', line: 11 };
    expect(validateFindings([hunch], files).findings).toHaveLength(1);
  });

  it('orders by severity, then by confidence within a severity', () => {
    const input = [
      { ...base, severity: 'tests', file: 'src/math.js', line: 11 },
      { ...base, severity: 'bug', confidence: 'medium', file: 'src/math.js', line: 11 },
      { ...base, severity: 'security', file: 'src/math.js', line: 11 },
      { ...base, severity: 'bug', confidence: 'high', file: 'src/math.js', line: 11 },
    ];
    const { findings } = validateFindings(input, files);
    expect(findings.map((f) => `${f.severity}/${f.confidence}`))
      .toEqual(['bug/high', 'bug/medium', 'security/high', 'tests/high']);
  });
});

describe('formatReview', () => {
  const finding = (over = {}) => ({
    severity: 'bug', file: 'src/math.js', line: 11, confidence: 'high',
    title: 'Loop skips the last element', detail: 'Off by one.', fix: 'Use <=.',
    lineAdjusted: false, ...over,
  });

  it('groups findings by severity in bugs-first order', () => {
    const out = formatReview({
      fileCount: 1,
      findings: [
        finding(),
        finding({ severity: 'security', title: 'Unescaped input' }),
        finding({ severity: 'tests', title: 'No test for the new branch' }),
      ],
    });
    expect(out.indexOf('Likely bugs')).toBeLessThan(out.indexOf('Security'));
    expect(out.indexOf('Security')).toBeLessThan(out.indexOf('Missing tests'));
    expect(out).toContain('3 findings');
  });

  it('renders each finding as a clickable path:line with its confidence', () => {
    const out = formatReview({ fileCount: 1, findings: [finding()] });
    expect(out).toContain('● src/math.js:11  [high]  Loop skips the last element');
    expect(out).toContain('Off by one.');
    expect(out).toContain('Fix: Use <=.');
  });

  it('admits when a line was snapped rather than pretending it was exact', () => {
    const out = formatReview({ fileCount: 1, findings: [finding({ lineAdjusted: true })] });
    expect(out).toContain('src/math.js:11 (nearest changed line)');
  });

  it('says plainly when there is nothing to report', () => {
    const out = formatReview({ fileCount: 2, mode: 'staged' });
    expect(out).toContain('no findings');
    expect(out).toContain('2 files');
    expect(out).not.toContain('●');
  });

  it('labels an unstaged review as unstaged', () => {
    expect(formatReview({ fileCount: 1, mode: 'unstaged' })).toContain('(unstaged)');
  });

  it('flags when nothing in the review is high-confidence', () => {
    const out = formatReview({ fileCount: 1, findings: [finding({ confidence: 'medium' })] });
    expect(out).toContain('Nothing here is high-confidence');
  });

  it('does not add the confidence caveat when a high-confidence finding is present', () => {
    const out = formatReview({ fileCount: 1, findings: [finding(), finding({ confidence: 'low' })] });
    expect(out).not.toContain('Nothing here is high-confidence');
  });

  it('reports what it discarded, grouped by reason', () => {
    const out = formatReview({
      fileCount: 1,
      findings: [finding()],
      dropped: [
        { reason: 'cited a file that is not in the diff' },
        { reason: 'cited a file that is not in the diff' },
        { reason: 'low-confidence nitpick' },
      ],
    });
    expect(out).toContain('Discarded 3 findings');
    expect(out).toContain('2 cited a file that is not in the diff');
    expect(out).toContain('1 low-confidence nitpick');
  });

  it('warns when the diff was truncated', () => {
    const out = formatReview({ fileCount: 1, findings: [finding()], truncated: true });
    expect(out).toContain('too large to review in full');
  });
});

describe('/review', () => {
  let repo;
  let bus;
  let tokens;

  const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'pipe', env: { ...process.env, ...GIT_ENV } });

  const stubModel = (reply) => {
    const calls = [];
    const fn = async (_bus, prompt, opts) => {
      calls.push(prompt);
      for (const chunk of String(reply).match(/[\s\S]{1,20}/g) ?? []) opts.onToken(chunk);
    };
    fn.calls = calls;
    return fn;
  };

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'review-cmd-test-'));
    sh('git init -b main', repo);
    sh('git config commit.gpgsign false', repo);
    sh('git config gc.auto 0', repo);
    sh('git config maintenance.auto false', repo);
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a + b;\n');
    sh('git add math.js', repo);
    sh('git commit -m init', repo);

    bus = createEventBus();
    tokens = [];
    bus.on(EVENTS.LLM_TOKEN, ({ token }) => tokens.push(token));
  });

  afterEach(() => {
    if (repo) rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
  });

  const out = () => tokens.join('\n');

  it('ignores text that is not the command', async () => {
    expect(await handleReviewCommand('review my code', { bus, config: {} })).toBe(false);
    expect(await handleReviewCommand('/reviewer', { bus, config: {} })).toBe(false);
  });

  it('rejects unrecognised options with usage', async () => {
    expect(await handleReviewCommand('/review --wat', { bus, config: { workspaceDir: repo } })).toBe(true);
    expect(out()).toMatch(/Usage: \/review \[--fix\]/);
  });

  it('reports when there is nothing to review', async () => {
    await handleReviewCommand('/review', { bus, config: { workspaceDir: repo }, streamFn: stubModel('{}') });
    expect(out()).toMatch(/Nothing to review/);
  });

  it('reports a clear error outside a git repo', async () => {
    const nonRepo = mkdtempSync(join(tmpdir(), 'review-non-repo-'));
    try {
      await handleReviewCommand('/review', { bus, config: { workspaceDir: nonRepo } });
      expect(out()).toMatch(/Cannot review: Not a git repository/);
    } finally {
      rmSync(nonRepo, { recursive: true, force: true });
    }
  });

  it('reviews staged changes and reports findings by severity', async () => {
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a - b;\n');
    sh('git add math.js', repo);

    const model = stubModel(JSON.stringify({ findings: [
      { severity: 'bug', file: 'math.js', line: 1, confidence: 'high', title: 'sum subtracts', detail: 'Returns a - b.', fix: 'Use +.' },
    ] }));

    await handleReviewCommand('/review', { bus, config: { workspaceDir: repo }, streamFn: model });

    expect(model.calls[0]).toContain('STAGED changes');
    expect(model.calls[0]).toContain('### FILE: math.js');
    expect(out()).toContain('Likely bugs (1)');
    expect(out()).toContain('math.js:1');
    expect(out()).toContain('sum subtracts');
  });

  it('falls back to unstaged changes when nothing is staged, and says so', async () => {
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a - b;\n');

    const model = stubModel('{"findings":[]}');
    await handleReviewCommand('/review', { bus, config: { workspaceDir: repo }, streamFn: model });

    expect(model.calls[0]).toContain('UNCOMMITTED working-tree changes');
    expect(out()).toContain('(unstaged)');
    expect(out()).toContain('no findings');
  });

  it('prefers staged changes when both staged and unstaged exist', async () => {
    writeFileSync(join(repo, 'staged.js'), 'export const a = 1;\n');
    sh('git add staged.js', repo);
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a - b;\n');

    const model = stubModel('{"findings":[]}');
    await handleReviewCommand('/review', { bus, config: { workspaceDir: repo }, streamFn: model });

    expect(model.calls[0]).toContain('### FILE: staged.js');
    expect(model.calls[0]).not.toContain('### FILE: math.js');
  });

  it('drops findings that cite files outside the diff and says it did', async () => {
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a - b;\n');
    sh('git add math.js', repo);

    const model = stubModel(JSON.stringify({ findings: [
      { severity: 'bug', file: 'math.js', line: 1, confidence: 'high', title: 'real', detail: 'd' },
      { severity: 'bug', file: 'server/api.js', line: 90, confidence: 'high', title: 'invented', detail: 'd' },
    ] }));
    await handleReviewCommand('/review', { bus, config: { workspaceDir: repo }, streamFn: model });

    expect(out()).toContain('real');
    expect(out()).not.toContain('invented');
    expect(out()).toContain('Discarded 1 finding');
  });

  it('reports a failure when the model returns prose instead of JSON', async () => {
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a - b;\n');
    sh('git add math.js', repo);

    await handleReviewCommand('/review', { bus, config: { workspaceDir: repo }, streamFn: stubModel('Looks fine to me!') });
    expect(out()).toMatch(/Review failed/);
  });

  it('reports a failure when the model returns nothing at all', async () => {
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a - b;\n');
    sh('git add math.js', repo);

    await handleReviewCommand('/review', { bus, config: { workspaceDir: repo }, streamFn: stubModel('') });
    expect(out()).toMatch(/Review failed: The reviewer returned nothing/);
  });

  it('always emits LLM_DONE so headless mode terminates', async () => {
    let doneCount = 0;
    bus.on(EVENTS.LLM_DONE, () => { doneCount += 1; });
    await handleReviewCommand('/review', { bus, config: { workspaceDir: repo }, streamFn: stubModel('{"findings":[]}') });
    expect(doneCount).toBeGreaterThan(0);
  });
});

describe('parseFixResponse', () => {
  const findings = [{ file: 'src/math.js' }, { file: 'src/util.js' }];

  it('keeps well-formed patches for files a finding pointed at', () => {
    const raw = JSON.stringify({ patches: [
      { finding: 1, file: 'src/math.js', oldString: 'a - b', newString: 'a + b', note: 'use +' },
    ] });
    const { patches } = parseFixResponse(raw, findings);
    expect(patches).toEqual([{ file: 'src/math.js', oldString: 'a - b', newString: 'a + b', note: 'use +' }]);
  });

  it('drops a patch for a file no finding mentioned', () => {
    const raw = JSON.stringify({ patches: [
      { file: 'src/elsewhere.js', oldString: 'x', newString: 'y' },
    ] });
    expect(parseFixResponse(raw, findings).patches).toEqual([]);
  });

  it('drops patches with an empty oldString or a missing newString', () => {
    const raw = JSON.stringify({ patches: [
      { file: 'src/math.js', oldString: '', newString: 'y' },
      { file: 'src/math.js', oldString: 'x' },
      { file: 'src/math.js', oldString: 'x', newString: 'x' },
    ] });
    expect(parseFixResponse(raw, findings).patches).toEqual([]);
  });

  it('allows an empty newString, which deletes the matched text', () => {
    const raw = JSON.stringify({ patches: [{ file: 'src/math.js', oldString: 'debugger;\n', newString: '' }] });
    expect(parseFixResponse(raw, findings).patches).toHaveLength(1);
  });

  it('errors when the response is not JSON', () => {
    expect(parseFixResponse('no patches for you', findings).error).toMatch(/parse/i);
  });
});

describe('applyPatches', () => {
  let bus;
  let tokens;

  beforeEach(() => {
    bus = createEventBus();
    tokens = [];
    bus.on(EVENTS.LLM_TOKEN, ({ token }) => tokens.push(token));
  });

  const patch = (over = {}) => ({ file: 'src/math.js', oldString: 'a - b', newString: 'a + b', note: 'use +', ...over });

  it('routes every patch through the confirmation gate as an edit_file call', async () => {
    const calls = [];
    const executeFn = async (_bus, tool, args, cwd, opts) => {
      calls.push({ tool, args, cwd, opts });
      return { edited: true };
    };

    const result = await applyPatches([patch()], {
      bus,
      cwd: '/repo',
      config: { allowSet: new Set(), checkpoints: [], currentTurnId: 7 },
      modes: {},
      executeFn,
    });

    expect(calls[0].tool).toBe('edit_file');
    expect(calls[0].args).toEqual({ filePath: 'src/math.js', oldString: 'a - b', newString: 'a + b' });
    expect(calls[0].opts.autoApprove).toBe(false);
    expect(calls[0].opts.turnId).toBe(7);
    expect(result.applied).toHaveLength(1);
  });

  it('auto-approves only when the session is in auto or accept-edits mode', async () => {
    const seen = [];
    const executeFn = async (_bus, _tool, _args, _cwd, opts) => { seen.push(opts.autoApprove); return { edited: true }; };

    await applyPatches([patch()], { bus, cwd: '/repo', config: {}, modes: { acceptEdits: true }, executeFn });
    await applyPatches([patch()], { bus, cwd: '/repo', config: {}, modes: { autoMode: true }, executeFn });
    expect(seen).toEqual([true, true]);
  });

  it('separates denied and failed patches from applied ones', async () => {
    const executeFn = async (_bus, _tool, args) => {
      if (args.filePath === 'denied.js') return { denied: true };
      if (args.filePath === 'broken.js') return { error: 'oldString not found' };
      return { edited: true };
    };

    const result = await applyPatches(
      [patch(), patch({ file: 'denied.js' }), patch({ file: 'broken.js' })],
      { bus, cwd: '/repo', config: {}, modes: {}, executeFn }
    );

    expect(result.applied).toHaveLength(1);
    expect(result.denied).toHaveLength(1);
    expect(result.failed[0].error).toMatch(/not found/);
  });

  it('announces each patch before asking about it', async () => {
    await applyPatches([patch(), patch({ note: 'second' })], {
      bus, cwd: '/repo', config: {}, modes: {}, executeFn: async () => ({ edited: true }),
    });
    expect(tokens[0]).toContain('Fix 1/2: src/math.js — use +');
    expect(tokens[1]).toContain('Fix 2/2');
  });

  it('starts each announcement on its own line', async () => {
    // Tokens are concatenated into one message, so without a leading newline
    // the first fix renders glued to the end of the review report.
    await applyPatches([patch()], {
      bus, cwd: '/repo', config: {}, modes: {}, executeFn: async () => ({ edited: true }),
    });
    expect(tokens[0].startsWith('\n')).toBe(true);
  });
});

describe('/review --fix', () => {
  let repo;
  let bus;
  let tokens;

  const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'pipe', env: { ...process.env, ...GIT_ENV } });

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'review-fix-test-'));
    sh('git init -b main', repo);
    sh('git config commit.gpgsign false', repo);
    sh('git config gc.auto 0', repo);
    sh('git config maintenance.auto false', repo);
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a + b;\n');
    sh('git add math.js', repo);
    sh('git commit -m init', repo);
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a - b;\n');
    sh('git add math.js', repo);

    bus = createEventBus();
    tokens = [];
    bus.on(EVENTS.LLM_TOKEN, ({ token }) => tokens.push(token));
  });

  afterEach(() => {
    if (repo) rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
  });

  const out = () => tokens.join('\n');

  // First call is the review pass, second is the fix pass.
  const twoPassModel = (reviewReply, fixReply) => {
    const prompts = [];
    const fn = async (_bus, prompt, opts) => {
      prompts.push(prompt);
      opts.onToken(prompts.length === 1 ? reviewReply : fixReply);
    };
    fn.prompts = prompts;
    return fn;
  };

  const REVIEW_REPLY = JSON.stringify({ findings: [
    { severity: 'bug', file: 'math.js', line: 1, confidence: 'high', title: 'sum subtracts', detail: 'Returns a - b.', fix: 'Use +.' },
  ] });

  it('offers a patch through the confirmation gate and reports it applied', async () => {
    const fixReply = JSON.stringify({ patches: [
      { finding: 1, file: 'math.js', oldString: 'a - b', newString: 'a + b', note: 'restore addition' },
    ] });
    const gated = [];
    const executeFn = async (_bus, tool, args) => { gated.push({ tool, args }); return { edited: true }; };

    await handleReviewCommand('/review --fix', {
      bus,
      config: { workspaceDir: repo },
      streamFn: twoPassModel(REVIEW_REPLY, fixReply),
      executeFn,
    });

    expect(gated).toHaveLength(1);
    expect(gated[0].tool).toBe('edit_file');
    expect(out()).toContain('1 fix applied');
    expect(out()).toContain('review them with git diff');
  });

  it('sends the current file contents to the fix pass so oldString can be copied exactly', async () => {
    const model = twoPassModel(REVIEW_REPLY, '{"patches":[]}');
    await handleReviewCommand('/review --fix', {
      bus, config: { workspaceDir: repo }, streamFn: model, executeFn: async () => ({ edited: true }),
    });

    expect(model.prompts).toHaveLength(2);
    expect(model.prompts[1]).toContain('export const sum = (a, b) => a - b;');
    expect(model.prompts[1]).toContain('sum subtracts');
  });

  it('opens one turn for the batch so /rewind undoes the fixes together', async () => {
    let turns = 0;
    const fixReply = JSON.stringify({ patches: [
      { file: 'math.js', oldString: 'a - b', newString: 'a + b' },
      { file: 'math.js', oldString: 'sum', newString: 'total' },
    ] });

    await handleReviewCommand('/review --fix', {
      bus,
      config: { workspaceDir: repo },
      streamFn: twoPassModel(REVIEW_REPLY, fixReply),
      executeFn: async () => ({ edited: true }),
      beginTurn: () => { turns += 1; },
    });

    expect(turns).toBe(1);
  });

  it('says plainly when no patch could be drafted', async () => {
    await handleReviewCommand('/review --fix', {
      bus,
      config: { workspaceDir: repo },
      streamFn: twoPassModel(REVIEW_REPLY, '{"patches":[]}'),
      executeFn: async () => ({ edited: true }),
    });
    expect(out()).toContain('No patches offered');
  });

  it('does not run a fix pass when the review is clean', async () => {
    const model = twoPassModel('{"findings":[]}', '{"patches":[]}');
    await handleReviewCommand('/review --fix', {
      bus, config: { workspaceDir: repo }, streamFn: model, executeFn: async () => ({ edited: true }),
    });

    expect(model.prompts).toHaveLength(1);
    expect(out()).toContain('Nothing to fix');
  });

  it('reports a declined patch without claiming it was applied', async () => {
    const fixReply = JSON.stringify({ patches: [{ file: 'math.js', oldString: 'a - b', newString: 'a + b' }] });
    await handleReviewCommand('/review --fix', {
      bus,
      config: { workspaceDir: repo },
      streamFn: twoPassModel(REVIEW_REPLY, fixReply),
      executeFn: async () => ({ denied: true }),
    });

    expect(out()).toContain('0 fixes applied, 1 declined');
    expect(out()).not.toContain('review them with git diff');
  });
});

describe('runFixPass staged/worktree divergence', () => {
  let repo;
  let bus;
  let tokens;

  const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'pipe', env: { ...process.env, ...GIT_ENV } });

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'review-diverge-test-'));
    sh('git init -b main', repo);
    sh('git config commit.gpgsign false', repo);
    sh('git config gc.auto 0', repo);
    sh('git config maintenance.auto false', repo);
    writeFileSync(join(repo, 'math.js'), 'export const sum = (a, b) => a + b;\n');
    sh('git add math.js', repo);
    sh('git commit -m init', repo);

    bus = createEventBus();
    tokens = [];
    bus.on(EVENTS.LLM_TOKEN, ({ token }) => tokens.push(token));
  });

  afterEach(() => {
    if (repo) rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
  });

  const findings = [{ severity: 'bug', file: 'math.js', line: 1, confidence: 'high', title: 't', detail: 'd', fix: '' }];
  const noPatches = async (_bus, _prompt, opts) => { opts.onToken('{"patches":[]}'); };

  it('warns before drafting when a cited file has unstaged changes', async () => {
    await runFixPass({
      findings, bus, cwd: repo, config: {}, modes: {},
      streamFn: noPatches, executeFn: async () => ({ edited: true }),
      divergedFiles: ['math.js'],
    });
    expect(tokens.join('')).toMatch(/math\.js has unstaged changes/);
    expect(tokens.join('')).toMatch(/patches may not match/i);
  });

  it('explains an empty result by the divergence rather than calling findings unfixable', async () => {
    const summary = await runFixPass({
      findings, bus, cwd: repo, config: {}, modes: {},
      streamFn: noPatches, executeFn: async () => ({ edited: true }),
      divergedFiles: ['math.js'],
    });
    expect(summary).toMatch(/not in the working copy of math\.js/);
    expect(summary).not.toMatch(/could not be fixed/);
  });

  it('does not warn about a diverged file no finding points at', async () => {
    await runFixPass({
      findings, bus, cwd: repo, config: {}, modes: {},
      streamFn: noPatches, executeFn: async () => ({ edited: true }),
      divergedFiles: ['unrelated.js'],
    });
    expect(tokens.join('')).not.toMatch(/unstaged changes/);
  });

  it('gives the plain empty-result message when nothing has diverged', async () => {
    const summary = await runFixPass({
      findings, bus, cwd: repo, config: {}, modes: {},
      streamFn: noPatches, executeFn: async () => ({ edited: true }),
    });
    expect(summary).toMatch(/applies cleanly to the current file contents/);
  });
});
