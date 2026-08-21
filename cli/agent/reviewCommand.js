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
