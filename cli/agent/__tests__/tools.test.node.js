/**
 * CLI tools tests (Node env).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseToolIntent, readFileTool, searchTool, runCommandTool } from '../tools.js';

describe('parseToolIntent', () => {
  it('returns read_file for "read file path"', () => {
    expect(parseToolIntent('read file package.json')).toEqual({
      tool: 'read_file',
      args: { filePath: 'package.json' }
    });
  });

  it('returns read_file for "read path.ext"', () => {
    expect(parseToolIntent('read src/main.js')).toEqual({
      tool: 'read_file',
      args: { filePath: 'src/main.js' }
    });
  });

  it('returns search for "search for X"', () => {
    expect(parseToolIntent('search for hello')).toEqual({
      tool: 'search',
      args: { query: 'hello' }
    });
  });

  it('returns search for "search X"', () => {
    expect(parseToolIntent('search openFile')).toEqual({
      tool: 'search',
      args: { query: 'openfile' }
    });
  });

  it('returns run_command for "run ..."', () => {
    expect(parseToolIntent('run npm test')).toEqual({
      tool: 'run_command',
      args: { command: 'npm test' }
    });
  });

  it('returns null for plain message', () => {
    expect(parseToolIntent('hello world')).toBeNull();
    expect(parseToolIntent('what is the weather')).toBeNull();
  });
});

describe('readFileTool', () => {
  let dir;

  beforeEach(async () => {
    dir = join(tmpdir(), `cli-tools-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it('reads file and returns content', async () => {
    const path = join(dir, 'foo.txt');
    await writeFile(path, 'hello', 'utf-8');
    const result = await readFileTool('foo.txt', dir);
    expect(result.error).toBeUndefined();
    expect(result.path).toBe(path);
    expect(result.content).toBe('hello');
  });

  it('returns error for missing file', async () => {
    const result = await readFileTool('missing.txt', dir);
    expect(result.error).toContain('not found');
  });
});

describe('searchTool', () => {
  let dir;

  beforeEach(async () => {
    dir = join(tmpdir(), `cli-search-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it('finds files containing query', async () => {
    await writeFile(join(dir, 'a.js'), 'const hello = 1;', 'utf-8');
    await writeFile(join(dir, 'b.js'), 'const world = 2;', 'utf-8');
    const result = await searchTool('hello', dir);
    expect(result.error).toBeUndefined();
    expect(result.count).toBe(1);
    expect(result.results[0].path).toContain('a.js');
  });

  it('returns error for empty query', async () => {
    const result = await searchTool('', dir);
    expect(result.error).toBe('Empty query');
  });
});

describe('runCommandTool', () => {
  it('runs command and returns stdout/exitCode', async () => {
    const result = await runCommandTool('echo ok', process.cwd());
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('ok');
  });

  it('captures stderr and non-zero exit', async () => {
    const result = await runCommandTool('exit 2', process.cwd());
    expect(result.exitCode).toBe(2);
  });
});
