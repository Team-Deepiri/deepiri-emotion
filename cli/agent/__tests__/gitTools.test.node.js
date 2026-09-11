import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { gitStatus, gitDiff, gitExplain } from '../gitTools.js';

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

function sh(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'pipe', env: { ...process.env, ...GIT_ENV } });
}

function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'git-tools-test-'));
  sh('git init -b main', dir);
  sh('git config commit.gpgsign false', dir);
  writeFileSync(join(dir, 'README.md'), 'initial\n');
  sh('git add README.md', dir);
  sh('git commit -m "initial"', dir);
  return dir;
}

let repo;

beforeEach(() => {
  repo = initRepo();
});

afterEach(async () => {
  if (!repo) return;
  // Retry manually: macOS occasionally still holds a brief lock on .git/ right
  // after a git subprocess exits (Spotlight/fseventsd indexing the just-created
  // dir), which surfaces as ENOTEMPTY on rmdir. rmSync's built-in maxRetries
  // does not reliably clear this in practice, so retry from JS instead.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      rmSync(repo, { recursive: true, force: true });
      return;
    } catch (err) {
      if (err.code !== 'ENOTEMPTY' || attempt === 4) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
});

// ─── gitStatus ────────────────────────────────────────────────────────────────

describe('gitStatus', () => {
  it('reports clean on a fresh repo', async () => {
    const result = await gitStatus(repo);
    expect(result.error).toBeUndefined();
    expect(result.clean).toBe(true);
    expect(result.branch).toBe('main');
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
    expect(result.untracked).toEqual([]);
    expect(result.ahead).toBe(0);
    expect(result.behind).toBe(0);
  });

  it('lists untracked files', async () => {
    writeFileSync(join(repo, 'new.txt'), 'hello');
    const result = await gitStatus(repo);
    expect(result.clean).toBe(false);
    expect(result.untracked).toContain('new.txt');
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
  });

  it('lists staged additions', async () => {
    writeFileSync(join(repo, 'added.txt'), 'hello');
    sh('git add added.txt', repo);
    const result = await gitStatus(repo);
    expect(result.staged).toEqual([{ path: 'added.txt', status: 'A' }]);
    expect(result.unstaged).toEqual([]);
    expect(result.untracked).toEqual([]);
  });

  it('lists unstaged modifications', async () => {
    writeFileSync(join(repo, 'README.md'), 'changed\n');
    const result = await gitStatus(repo);
    expect(result.unstaged).toEqual([{ path: 'README.md', status: 'M' }]);
    expect(result.staged).toEqual([]);
  });

  it('handles a file that is both staged and further modified', async () => {
    writeFileSync(join(repo, 'README.md'), 'first change\n');
    sh('git add README.md', repo);
    writeFileSync(join(repo, 'README.md'), 'second change\n');
    const result = await gitStatus(repo);
    expect(result.staged).toEqual([{ path: 'README.md', status: 'M' }]);
    expect(result.unstaged).toEqual([{ path: 'README.md', status: 'M' }]);
  });

  it('returns a clear error when cwd is not a git repo', async () => {
    const nonRepo = mkdtempSync(join(tmpdir(), 'not-a-repo-'));
    try {
      const result = await gitStatus(nonRepo);
      expect(result.error).toMatch(/Not a git repository/);
    } finally {
      rmSync(nonRepo, { recursive: true, force: true });
    }
  });
});

// ─── gitDiff ──────────────────────────────────────────────────────────────────

describe('gitDiff', () => {
  it('returns empty diff on a clean repo', async () => {
    const result = await gitDiff(repo);
    expect(result.error).toBeUndefined();
    expect(result.diff).toBe('');
    expect(result.truncated).toBe(false);
    expect(result.lineCount).toBe(0);
  });

  it('returns the unstaged diff for a modified file', async () => {
    writeFileSync(join(repo, 'README.md'), 'changed line\n');
    const result = await gitDiff(repo);
    expect(result.diff).toContain('-initial');
    expect(result.diff).toContain('+changed line');
    expect(result.truncated).toBe(false);
    expect(result.lineCount).toBeGreaterThan(0);
  });

  it('only returns staged changes when staged: true', async () => {
    writeFileSync(join(repo, 'README.md'), 'staged change\n');
    sh('git add README.md', repo);
    writeFileSync(join(repo, 'README.md'), 'further unstaged change\n');

    const stagedResult = await gitDiff(repo, { staged: true });
    expect(stagedResult.diff).toContain('+staged change');
    expect(stagedResult.diff).not.toContain('+further unstaged change');

    const unstagedResult = await gitDiff(repo);
    expect(unstagedResult.diff).toContain('+further unstaged change');
    expect(unstagedResult.diff).not.toContain('+staged change');
  });

  it('filters by path when path is provided', async () => {
    writeFileSync(join(repo, 'README.md'), 'readme change\n');
    writeFileSync(join(repo, 'other.txt'), 'other content\n');
    sh('git add other.txt', repo);
    sh('git commit -m "add other"', repo);
    writeFileSync(join(repo, 'other.txt'), 'other changed\n');

    const result = await gitDiff(repo, { path: 'README.md' });
    expect(result.diff).toContain('README.md');
    expect(result.diff).not.toContain('other.txt');
  });

  it('truncates at 400 lines and reports total', async () => {
    const bigContent = Array.from({ length: 600 }, (_, i) => `line ${i}`).join('\n') + '\n';
    writeFileSync(join(repo, 'big.txt'), bigContent);
    sh('git add big.txt', repo);
    sh('git commit -m "add big"', repo);
    const changedContent = Array.from({ length: 600 }, (_, i) => `changed ${i}`).join('\n') + '\n';
    writeFileSync(join(repo, 'big.txt'), changedContent);

    const result = await gitDiff(repo);
    expect(result.truncated).toBe(true);
    expect(result.lineCount).toBeGreaterThan(400);
    expect(result.diff).toContain('truncated');
    expect(result.diff.split('\n').length).toBeLessThanOrEqual(401);
  });

  it('returns a clear error when cwd is not a git repo', async () => {
    const nonRepo = mkdtempSync(join(tmpdir(), 'not-a-repo-'));
    try {
      const result = await gitDiff(nonRepo);
      expect(result.error).toMatch(/Not a git repository/);
    } finally {
      rmSync(nonRepo, { recursive: true, force: true });
    }
  });
});

// ─── gitExplain ───────────────────────────────────────────────────────────────

describe('gitExplain', () => {
  it('requires a path', async () => {
    const result = await gitExplain(repo, {});
    expect(result.error).toMatch(/path is required/);
  });

  it('returns log history for a file with a single commit', async () => {
    const result = await gitExplain(repo, { path: 'README.md' });
    expect(result.error).toBeUndefined();
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({ author: 'Test', subject: 'initial' });
    expect(result.history[0].hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('orders history most-recent-first across multiple commits', async () => {
    writeFileSync(join(repo, 'README.md'), 'second\n');
    sh('git add README.md', repo);
    sh('git commit -m "second commit"', repo);

    const result = await gitExplain(repo, { path: 'README.md' });
    expect(result.history.map((h) => h.subject)).toEqual(['second commit', 'initial']);
  });

  it('returns per-line blame with author, date, and commit for the current content', async () => {
    writeFileSync(join(repo, 'README.md'), 'line one\nline two\n');
    sh('git add README.md', repo);
    sh('git commit -m "two lines"', repo);

    const result = await gitExplain(repo, { path: 'README.md' });
    expect(result.blame).toHaveLength(2);
    expect(result.blame[0]).toMatchObject({ line: 1, author: 'Test', subject: 'two lines', content: 'line one' });
    expect(result.blame[1]).toMatchObject({ line: 2, author: 'Test', subject: 'two lines', content: 'line two' });
  });

  it('attributes blame lines to the commit that last touched them', async () => {
    writeFileSync(join(repo, 'README.md'), 'line one\nline two\n');
    sh('git add README.md', repo);
    sh('git commit -m "add line two"', repo);

    writeFileSync(join(repo, 'README.md'), 'line one\nline two changed\n');
    sh('git add README.md', repo);
    sh('git commit -m "change line two"', repo);

    const result = await gitExplain(repo, { path: 'README.md' });
    const first = result.blame.find((b) => b.line === 1);
    const second = result.blame.find((b) => b.line === 2);
    expect(first.subject).toBe('add line two');
    expect(second.subject).toBe('change line two');
  });

  it('uses git log -L and returns diff-style history when lineRange is given', async () => {
    writeFileSync(join(repo, 'README.md'), 'line one\nline two\n');
    sh('git add README.md', repo);
    sh('git commit -m "two lines"', repo);

    const result = await gitExplain(repo, { path: 'README.md', lineRange: { start: 1, end: 2 } });
    expect(result.error).toBeUndefined();
    expect(result.lineRange).toEqual({ start: 1, end: 2 });
    expect(result.history).toContain('two lines');
    expect(result.truncated).toBe(false);
  });

  it('rejects an invalid lineRange', async () => {
    const result = await gitExplain(repo, { path: 'README.md', lineRange: { start: 5, end: 2 } });
    expect(result.error).toMatch(/lineRange/);
  });

  it('returns empty history and blame for a nonexistent file without erroring', async () => {
    const result = await gitExplain(repo, { path: 'does-not-exist.txt' });
    expect(result.error).toBeUndefined();
    expect(result.history).toEqual([]);
    expect(result.blame).toEqual([]);
  });

  it('returns a clear error when cwd is not a git repo', async () => {
    const nonRepo = mkdtempSync(join(tmpdir(), 'not-a-repo-'));
    try {
      const result = await gitExplain(nonRepo, { path: 'README.md' });
      expect(result.error).toMatch(/Not a git repository/);
    } finally {
      rmSync(nonRepo, { recursive: true, force: true });
    }
  });
});
