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

  it('returns found: false when no guidance files exist', async () => {
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(false);
  });

  it('finds AGENTS.md and returns its content', async () => {
    await writeFile(join(dir, 'AGENTS.md'), '# Agent Guidelines\nDo not break things.', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(true);
    expect(result.path).toBe('AGENTS.md');
    expect(result.content).toContain('Agent Guidelines');
    expect(result.truncated).toBe(false);
  });

  it('prefers .deepiri/agent-guidelines.md over AGENTS.md', async () => {
    await mkdir(join(dir, '.deepiri'), { recursive: true });
    await writeFile(join(dir, '.deepiri', 'agent-guidelines.md'), '# Team rules', 'utf-8');
    await writeFile(join(dir, 'AGENTS.md'), '# Fallback', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(true);
    expect(result.path).toBe('.deepiri/agent-guidelines.md');
  });

  it('truncates content longer than 4000 chars', async () => {
    const long = 'x'.repeat(5000);
    await writeFile(join(dir, 'AGENTS.md'), long, 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(true);
    expect(result.content.length).toBe(4000);
    expect(result.truncated).toBe(true);
  });

  it('continues to next candidate when a preferred file is missing', async () => {
    await mkdir(join(dir, '.deepiri'), { recursive: true });
    // .deepiri dir exists but neither guidance file inside it does
    await writeFile(join(dir, 'AGENTS.md'), '# Found', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.found).toBe(true);
    expect(result.path).toBe('AGENTS.md');
  });

  it('returns relative path from cwd', async () => {
    await writeFile(join(dir, 'CONTRIBUTING.md'), '# Contributing', 'utf-8');
    const result = await discoverGuidance(dir);
    expect(result.path).not.toContain(dir);
    expect(result.path).toBe('CONTRIBUTING.md');
  });
});
