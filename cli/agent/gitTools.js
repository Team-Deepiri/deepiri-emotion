/**
 * Read-only git tools: git_status, git_diff, git_explain.
 * Shell out via execFile (no shell) — paths cannot inject.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const DEFAULT_CWD = process.cwd();
const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER = 4 * 1024 * 1024;
const DIFF_MAX_LINES = 400;
const LOG_MAX_ENTRIES = 30;
const BLAME_MAX_LINES = 2000;
const EXPLAIN_TEXT_MAX_LINES = 400;
const LOG_FIELD_SEP = '\x1f';
const LOG_FORMAT = `%H${LOG_FIELD_SEP}%an${LOG_FIELD_SEP}%ad${LOG_FIELD_SEP}%s`;

async function runGit(args, cwd) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
    });
    return { stdout };
  } catch (err) {
    return { error: err.message, code: err.code ?? null };
  }
}

async function ensureRepo(cwd) {
  const result = await runGit(['rev-parse', '--is-inside-work-tree'], cwd);
  if (result.error) {
    return { error: `Not a git repository: ${cwd}` };
  }
  if ((result.stdout || '').trim() !== 'true') {
    return { error: `Not a git repository: ${cwd}` };
  }
  return { ok: true };
}

function parseStatus(output) {
  const lines = output.split('\n');
  let branch = null;
  let ahead = 0;
  let behind = 0;
  const staged = [];
  const unstaged = [];
  const untracked = [];

  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith('## ')) {
      const rest = line.slice(3);
      if (rest.startsWith('HEAD (no branch)')) {
        branch = 'HEAD';
      } else {
        const branchMatch = rest.match(/^([^\s.]+)/);
        if (branchMatch) branch = branchMatch[1];
      }
      const aheadMatch = rest.match(/ahead (\d+)/);
      if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
      const behindMatch = rest.match(/behind (\d+)/);
      if (behindMatch) behind = parseInt(behindMatch[1], 10);
      continue;
    }

    const x = line[0];
    const y = line[1];
    const path = line.slice(3);

    if (x === '?' && y === '?') {
      untracked.push(path);
      continue;
    }

    if (x !== ' ' && x !== '?') {
      staged.push({ path, status: x });
    }
    if (y !== ' ' && y !== '?') {
      unstaged.push({ path, status: y });
    }
  }

  return {
    branch,
    ahead,
    behind,
    staged,
    unstaged,
    untracked,
    clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
  };
}

export async function gitStatus(cwd = DEFAULT_CWD) {
  const repoCheck = await ensureRepo(cwd);
  if (repoCheck.error) return { error: repoCheck.error };

  const result = await runGit(['status', '--porcelain=v1', '--branch'], cwd);
  if (result.error) return { error: result.error };

  return parseStatus(result.stdout || '');
}

export async function gitDiff(cwd = DEFAULT_CWD, { staged = false, path = null } = {}) {
  const repoCheck = await ensureRepo(cwd);
  if (repoCheck.error) return { error: repoCheck.error };

  const args = ['diff'];
  if (staged) args.push('--cached');
  if (path) args.push('--', String(path));

  const result = await runGit(args, cwd);
  if (result.error) return { error: result.error };

  const fullDiff = result.stdout || '';
  if (fullDiff.length === 0) {
    return { diff: '', truncated: false, lineCount: 0 };
  }

  const rawLines = fullDiff.split('\n');
  const trailingNewline = rawLines[rawLines.length - 1] === '';
  const totalLines = trailingNewline ? rawLines.length - 1 : rawLines.length;

  if (totalLines > DIFF_MAX_LINES) {
    const shown = rawLines.slice(0, DIFF_MAX_LINES).join('\n');
    return {
      diff: `${shown}\n… (truncated, showing ${DIFF_MAX_LINES} of ${totalLines} lines)`,
      truncated: true,
      lineCount: totalLines,
    };
  }

  return {
    diff: fullDiff,
    truncated: false,
    lineCount: totalLines,
  };
}

function parseLog(output) {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, author, date, subject] = line.split(LOG_FIELD_SEP);
      return { hash: hash?.slice(0, 12) ?? null, author, date, subject };
    });
}

/**
 * Parses `git blame --porcelain` output into one entry per source line.
 * Porcelain format: a header line "<sha> <origLine> <finalLine> [<numLines>]"
 * starts each run, followed by metadata lines (author, author-time, summary,
 * ...) for the first line of each commit group, then a tab-prefixed line
 * holding the actual source text.
 */
function parseBlame(output) {
  const lines = output.split('\n');
  const commits = new Map();
  const blameLines = [];
  let current = null;

  for (const line of lines) {
    const headerMatch = line.match(/^([0-9a-f]{40}) (\d+) (\d+)/);
    if (headerMatch) {
      current = { hash: headerMatch[1], finalLine: parseInt(headerMatch[3], 10) };
      continue;
    }
    if (!current) continue;

    if (line.startsWith('author ')) {
      const commit = commits.get(current.hash) || {};
      commit.author = line.slice('author '.length);
      commits.set(current.hash, commit);
    } else if (line.startsWith('author-time ')) {
      const commit = commits.get(current.hash) || {};
      commit.timestamp = parseInt(line.slice('author-time '.length), 10);
      commits.set(current.hash, commit);
    } else if (line.startsWith('summary ')) {
      const commit = commits.get(current.hash) || {};
      commit.subject = line.slice('summary '.length);
      commits.set(current.hash, commit);
    } else if (line.startsWith('\t')) {
      const commit = commits.get(current.hash) || {};
      blameLines.push({
        line: current.finalLine,
        hash: current.hash.slice(0, 12),
        author: commit.author ?? null,
        date: Number.isFinite(commit.timestamp) ? new Date(commit.timestamp * 1000).toISOString().slice(0, 10) : null,
        subject: commit.subject ?? null,
        content: line.slice(1),
      });
      current = null;
    }
  }
  return blameLines;
}

/**
 * The story behind a file (or line range): commit history via `git log`
 * plus current line-by-line authorship via `git blame`, returned as
 * structured data so the agent can summarize in plain language instead of
 * dumping raw log/blame output.
 *
 * With `lineRange`, uses `git log -L` instead, which walks how those exact
 * lines changed over time (each entry includes the diff hunk for that
 * commit) — better suited to "why do these lines look like this" than
 * separate log+blame calls would be.
 */
export async function gitExplain(cwd = DEFAULT_CWD, { path, lineRange = null, limit = LOG_MAX_ENTRIES } = {}) {
  if (!path) return { error: 'path is required' };
  const repoCheck = await ensureRepo(cwd);
  if (repoCheck.error) return { error: repoCheck.error };

  if (lineRange) {
    const { start, end } = lineRange;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      return { error: 'lineRange must be { start, end } with integers, start >= 1 and end >= start' };
    }
    const result = await runGit(['log', `-L${start},${end}:${path}`, '-n', String(limit)], cwd);
    if (result.error) return { error: result.error };

    const text = result.stdout || '';
    if (!text) return { path, lineRange, history: '', truncated: false };

    const rawLines = text.split('\n');
    const trailingNewline = rawLines[rawLines.length - 1] === '';
    const totalLines = trailingNewline ? rawLines.length - 1 : rawLines.length;
    if (totalLines > EXPLAIN_TEXT_MAX_LINES) {
      return {
        path,
        lineRange,
        history: `${rawLines.slice(0, EXPLAIN_TEXT_MAX_LINES).join('\n')}\n… (truncated, showing ${EXPLAIN_TEXT_MAX_LINES} of ${totalLines} lines)`,
        truncated: true,
      };
    }
    return { path, lineRange, history: text, truncated: false };
  }

  const [logResult, blameResult] = await Promise.all([
    runGit(['log', '--follow', '-n', String(limit), '--date=short', `--pretty=format:${LOG_FORMAT}`, '--', path], cwd),
    runGit(['blame', '--porcelain', '--', path], cwd),
  ]);

  if (logResult.error && blameResult.error) {
    return { error: logResult.error };
  }

  const history = logResult.error ? [] : parseLog(logResult.stdout || '');
  let blame = blameResult.error ? [] : parseBlame(blameResult.stdout || '');
  const blameTruncated = blame.length > BLAME_MAX_LINES;
  if (blameTruncated) blame = blame.slice(0, BLAME_MAX_LINES);

  return {
    path,
    history,
    historyTruncated: history.length >= limit,
    blame,
    blameTruncated,
  };
}
