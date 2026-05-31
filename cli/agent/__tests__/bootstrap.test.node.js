import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { bootstrapProject, formatSnapshot } from '../bootstrap.js';

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bootstrap-test-'));
});

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('bootstrapProject — empty workspace', () => {
  it('returns sensible defaults for an empty dir', async () => {
    const result = await bootstrapProject(dir);
    expect(result.cwd).toBe(dir);
    expect(result.gitRoot).toBe(false);
    expect(result.hasReadme).toBe(false);
    expect(result.hasEmotionMd).toBe(false);
    expect(result.packageManagers).toEqual([]);
    expect(result.name).toBeNull();
    expect(result.entrypoint).toBeNull();
    expect(result.topDirs).toEqual([]);
  });
});

describe('bootstrapProject — package.json detection', () => {
  it('captures project name and main entrypoint from package.json', async () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'my-cool-project', main: 'src/index.js' })
    );
    const result = await bootstrapProject(dir);
    expect(result.name).toBe('my-cool-project');
    expect(result.entrypoint).toBe('src/index.js');
    expect(result.packageManagers).toContain('npm');
  });

  it('falls back to bin entrypoint when main is missing', async () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'my-cli', bin: { 'my-cli': './cli/index.js' } })
    );
    const result = await bootstrapProject(dir);
    expect(result.entrypoint).toBe('./cli/index.js');
  });

  it('returns null name/entrypoint when package.json is malformed', async () => {
    writeFileSync(join(dir, 'package.json'), '{ this is not valid json');
    const result = await bootstrapProject(dir);
    expect(result.name).toBeNull();
    expect(result.entrypoint).toBeNull();
    expect(result.packageManagers).toContain('npm'); // file still exists
  });
});

describe('bootstrapProject — multi-language package manager detection', () => {
  it('detects multiple package managers when several manifests exist', async () => {
    writeFileSync(join(dir, 'package.json'), '{}');
    writeFileSync(join(dir, 'pyproject.toml'), '');
    writeFileSync(join(dir, 'Cargo.toml'), '');
    writeFileSync(join(dir, 'go.mod'), '');
    const result = await bootstrapProject(dir);
    expect(result.packageManagers.sort()).toEqual(['go', 'npm', 'python', 'rust']);
  });
});

describe('bootstrapProject — file presence flags', () => {
  it('flags README.md presence', async () => {
    writeFileSync(join(dir, 'README.md'), '# hello');
    const result = await bootstrapProject(dir);
    expect(result.hasReadme).toBe(true);
  });

  it('flags lowercase readme.md', async () => {
    writeFileSync(join(dir, 'readme.md'), '# hello');
    const result = await bootstrapProject(dir);
    expect(result.hasReadme).toBe(true);
  });

  it('flags EMOTION.md presence', async () => {
    writeFileSync(join(dir, 'EMOTION.md'), '# project memory');
    const result = await bootstrapProject(dir);
    expect(result.hasEmotionMd).toBe(true);
  });

  it('flags git root via .git directory', async () => {
    mkdirSync(join(dir, '.git'));
    const result = await bootstrapProject(dir);
    expect(result.gitRoot).toBe(true);
  });
});

describe('bootstrapProject — top-level dirs', () => {
  it('lists user-visible directories alphabetically', async () => {
    mkdirSync(join(dir, 'src'));
    mkdirSync(join(dir, 'tests'));
    mkdirSync(join(dir, 'lib'));
    const result = await bootstrapProject(dir);
    expect(result.topDirs).toEqual(['lib', 'src', 'tests']);
  });

  it('skips node_modules, .git, dist, and other noise dirs', async () => {
    mkdirSync(join(dir, 'src'));
    mkdirSync(join(dir, 'node_modules'));
    mkdirSync(join(dir, 'dist'));
    mkdirSync(join(dir, '.git'));
    mkdirSync(join(dir, 'coverage'));
    mkdirSync(join(dir, '.venv'));
    const result = await bootstrapProject(dir);
    expect(result.topDirs).toEqual(['src']);
  });

  it('caps top dirs at 20 entries', async () => {
    for (let i = 0; i < 30; i++) {
      mkdirSync(join(dir, `dir${String(i).padStart(2, '0')}`));
    }
    const result = await bootstrapProject(dir);
    expect(result.topDirs.length).toBe(20);
  });
});

describe('formatSnapshot', () => {
  it('returns empty string for null snapshot', () => {
    expect(formatSnapshot(null)).toBe('');
  });

  it('formats a full snapshot as readable text', () => {
    const snapshot = {
      cwd: '/path/to/proj',
      gitRoot: true,
      hasReadme: true,
      hasEmotionMd: true,
      packageManagers: ['npm'],
      name: 'cool-app',
      entrypoint: 'src/index.js',
      topDirs: ['src', 'tests'],
    };
    const text = formatSnapshot(snapshot);
    expect(text).toContain('Project: cool-app');
    expect(text).toContain('Workspace: /path/to/proj');
    expect(text).toContain('Git: yes');
    expect(text).toContain('Package managers: npm');
    expect(text).toContain('Entrypoint: src/index.js');
    expect(text).toContain('Top-level dirs: src, tests');
    expect(text).toContain('README.md: present');
    expect(text).toContain('EMOTION.md: present');
  });

  it('omits absent fields cleanly', () => {
    const snapshot = {
      cwd: '/path',
      gitRoot: false,
      hasReadme: false,
      hasEmotionMd: false,
      packageManagers: [],
      name: null,
      entrypoint: null,
      topDirs: [],
    };
    const text = formatSnapshot(snapshot);
    expect(text).toBe('Workspace: /path');
  });

  it('truncates output to 2KB', () => {
    const snapshot = {
      cwd: '/path',
      gitRoot: false,
      hasReadme: false,
      hasEmotionMd: false,
      packageManagers: [],
      name: null,
      entrypoint: null,
      topDirs: Array.from({ length: 20 }, (_, i) => 'dir-' + 'x'.repeat(200) + i),
    };
    const text = formatSnapshot(snapshot);
    expect(text.length).toBeLessThanOrEqual(2 * 1024);
  });
});
