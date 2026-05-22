import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { discoverGuidance } from '../guidance.js';

describe('discoverGuidance', () => {
  let dir;

  beforeEach(async () => {
    dir = join(tmpdir(), `guidance-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  // ─── existing tests (updated for new return shape) ────────────────────────

  it('returns found: false when no guidance files exist', async () => {
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(false);
    expect(result.files).toEqual([]);
    expect(result.direction_present).toBe(false);
    expect(result.readme_present).toBe(false);
  });

  it('finds AGENTS.md and returns its content', async () => {
    await writeFile(join(dir, 'AGENTS.md'), '# Agent Guidelines\nDo not break things.', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(true);
    expect(result.files[0].path).toBe('AGENTS.md');
    expect(result.files[0].content).toContain('Agent Guidelines');
    expect(result.files[0].truncated).toBe(false);
  });

  it('reads .deepiri/agent-guidelines.md before AGENTS.md (preserves candidate order)', async () => {
    await mkdir(join(dir, '.deepiri'), { recursive: true });
    await writeFile(join(dir, '.deepiri', 'agent-guidelines.md'), '# Team rules', 'utf-8');
    await writeFile(join(dir, 'AGENTS.md'), '# Fallback', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(true);
    expect(result.files[0].path).toBe('.deepiri/agent-guidelines.md');
    expect(result.files.length).toBeGreaterThanOrEqual(2);
  });

  it('truncates file content longer than 2000 chars', async () => {
    const long = 'x'.repeat(3000);
    await writeFile(join(dir, 'AGENTS.md'), long, 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(true);
    expect(result.files[0].content.length).toBe(2000);
    expect(result.files[0].truncated).toBe(true);
  });

  it('continues to next candidate when a preferred file is missing', async () => {
    await mkdir(join(dir, '.deepiri'), { recursive: true });
    await writeFile(join(dir, 'AGENTS.md'), '# Found', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(true);
    expect(result.files[0].path).toBe('AGENTS.md');
  });

  it('returns relative path from cwd', async () => {
    await writeFile(join(dir, 'CONTRIBUTING.md'), '# Contributing', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.files[0].path).not.toContain(dir);
    expect(result.files[0].path).toBe('CONTRIBUTING.md');
  });

  // ─── new tests ────────────────────────────────────────────────────────────

  it('reads all matching files, not just the first', async () => {
    await writeFile(join(dir, 'AGENTS.md'), '# Agents', 'utf-8');
    await writeFile(join(dir, 'README.md'), '# Readme', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.files.length).toBe(2);
    const paths = result.files.map(f => f.path);
    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('README.md');
  });

  it('sets direction_present: true when DIRECTION.md exists', async () => {
    await writeFile(join(dir, 'DIRECTION.md'), '# Direction', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.direction_present).toBe(true);
  });

  it('sets readme_present: true when README.md exists', async () => {
    await writeFile(join(dir, 'README.md'), '# Readme', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.readme_present).toBe(true);
  });

  it('total_chars never exceeds MAX_TOTAL_CHARS (6000)', async () => {
    // Four files of 2000 chars each would be 8000 — should be capped at 6000
    const chunk = 'y'.repeat(2000);
    await writeFile(join(dir, 'AGENTS.md'), chunk, 'utf-8');
    await writeFile(join(dir, 'CONTRIBUTING.md'), chunk, 'utf-8');
    await writeFile(join(dir, 'DIRECTION.md'), chunk, 'utf-8');
    await writeFile(join(dir, 'README.md'), chunk, 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.total_chars).toBeLessThanOrEqual(6000);
  });

  it('total_chars reflects actual chars collected', async () => {
    await writeFile(join(dir, 'AGENTS.md'), 'hello', 'utf-8');
    await writeFile(join(dir, 'README.md'), 'world', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.total_chars).toBe(10);
  });
});
