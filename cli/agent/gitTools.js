/**
 * Read-only git tools: git_status, git_diff.
 * Shell out via execFile (no shell) — paths cannot inject.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const DEFAULT_CWD = process.cwd();
const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER = 4 * 1024 * 1024;
const DIFF_MAX_LINES = 400;

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
