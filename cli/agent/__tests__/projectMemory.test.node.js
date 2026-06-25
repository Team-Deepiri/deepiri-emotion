import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadProjectMemory } from '../projectMemory.js';

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'project-memory-test-'));
});

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('loadProjectMemory', () => {
  it('returns found:false when EMOTION.md is absent', async () => {
    const result = await loadProjectMemory(dir);
    expect(result.found).toBe(false);
    expect(result.content).toBe('');
    expect(result.truncated).toBe(false);
    expect(result.path).toBe(join(dir, 'EMOTION.md'));
  });

  it('returns content when EMOTION.md exists and is small', async () => {
    const body = '# My Project\n\nThis project does X, Y, Z.\n';
    writeFileSync(join(dir, 'EMOTION.md'), body);
    const result = await loadProjectMemory(dir);
    expect(result.found).toBe(true);
    expect(result.content).toBe(body);
    expect(result.truncated).toBe(false);
  });

  it('truncates content larger than 16KB and sets truncated:true', async () => {
    const big = 'x'.repeat(20 * 1024);
    writeFileSync(join(dir, 'EMOTION.md'), big);
    const result = await loadProjectMemory(dir);
    expect(result.found).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBe(16 * 1024);
  });

  it('does NOT truncate when content is exactly 16KB', async () => {
    const exact = 'y'.repeat(16 * 1024);
    writeFileSync(join(dir, 'EMOTION.md'), exact);
    const result = await loadProjectMemory(dir);
    expect(result.found).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.content.length).toBe(16 * 1024);
  });

  it('returns empty content when EMOTION.md is an empty file', async () => {
    writeFileSync(join(dir, 'EMOTION.md'), '');
    const result = await loadProjectMemory(dir);
    expect(result.found).toBe(true);
    expect(result.content).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('defaults cwd to process.cwd() when not provided', async () => {
    const result = await loadProjectMemory();
    expect(typeof result.found).toBe('boolean');
  });

  it('returns found:false when EMOTION.md is a symlink pointing outside workspace', async () => {
    const outsideTarget = join(
      tmpdir(),
      `outside-emotion-target-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.md`,
    );
    writeFileSync(outsideTarget, 'sensitive content that should NOT be exposed');

    const linkPath = join(dir, 'EMOTION.md');
    symlinkSync(outsideTarget, linkPath);

    try {
      const result = await loadProjectMemory(dir);
      expect(result.found).toBe(false);
      expect(result.content).toBe('');
    } finally {
      rmSync(outsideTarget, { force: true });
    }
  });
});
