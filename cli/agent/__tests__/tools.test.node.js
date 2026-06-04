/**
 * CLI tools tests (Node env).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, symlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseToolIntent, readFileTool, searchTool, listFilesTool, runCommandTool, explainTool } from '../tools.js';

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

  it('parses a valid JSON read_file call', () => {
    const json = JSON.stringify({ tool: 'read_file', args: { filePath: 'cli/index.js' } });
    expect(parseToolIntent(json)).toEqual({ tool: 'read_file', args: { filePath: 'cli/index.js' } });
  });

  it('parses a valid JSON search call', () => {
    const json = JSON.stringify({ tool: 'search', args: { query: 'event bus' } });
    expect(parseToolIntent(json)).toEqual({ tool: 'search', args: { query: 'event bus' } });
  });

  it('rejects a JSON call with an unknown tool name (falls back to null)', () => {
    // "delete_file" is not in KNOWN_TOOLS → validateToolCall returns null →
    // regex fallback also returns null (no natural-language pattern matches JSON).
    const json = JSON.stringify({ tool: 'delete_file', args: { filePath: 'x.js' } });
    expect(parseToolIntent(json)).toBeNull();
  });

  it('rejects a JSON call missing required args (falls back to null)', () => {
    // read_file requires filePath; passing a different key should reject.
    const json = JSON.stringify({ tool: 'read_file', args: { path: 'x.js' } });
    expect(parseToolIntent(json)).toBeNull();
  });

  it('rejects a JSON call whose args is null', () => {
    const json = JSON.stringify({ tool: 'search', args: null });
    expect(parseToolIntent(json)).toBeNull();
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

  it('refuses to read .env file (blocked pattern)', async () => {
    await writeFile(join(dir, '.env'), 'API_KEY=secret', 'utf-8');
    const result = await readFileTool('.env', dir);
    expect(result.error).toMatch(/blocked/i);
    expect(result.content).toBeUndefined();
  });

  it('refuses to read .env.local file', async () => {
    await writeFile(join(dir, '.env.local'), 'API_KEY=secret', 'utf-8');
    const result = await readFileTool('.env.local', dir);
    expect(result.error).toMatch(/blocked/i);
  });

  it('refuses path traversal via ..', async () => {
    const result = await readFileTool('../escape.txt', dir);
    expect(result.error).toMatch(/outside workspace/i);
  });

  it('refuses to read symlink pointing outside workspace', async () => {
    const outsideTarget = join(tmpdir(), `outside-read-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.txt`);
    await writeFile(outsideTarget, 'sensitive', 'utf-8');
    const linkPath = join(dir, 'innocent.txt');
    await symlink(outsideTarget, linkPath);
    try {
      const result = await readFileTool('innocent.txt', dir);
      expect(result.error).toMatch(/symlink/i);
    } finally {
      await rm(outsideTarget, { force: true }).catch(() => {});
    }
  });
});

describe('listFilesTool', () => {
  let dir;

  beforeEach(async () => {
    dir = join(tmpdir(), `cli-list-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it('lists files and folders in workspace root', async () => {
    await writeFile(join(dir, 'a.js'), 'x', 'utf-8');
    await mkdir(join(dir, 'subdir'), { recursive: true });
    const result = await listFilesTool('.', dir);
    expect(result.error).toBeUndefined();
    expect(result.count).toBe(2);
    expect(result.items.map((i) => i.name).sort()).toEqual(['a.js', 'subdir']);
  });

  it('filters dotfiles out of the listing', async () => {
    await writeFile(join(dir, 'visible.js'), 'x', 'utf-8');
    await writeFile(join(dir, '.hidden'), 'x', 'utf-8');
    const result = await listFilesTool('.', dir);
    expect(result.items.map((i) => i.name)).toEqual(['visible.js']);
  });

  it('refuses to list .ssh directory', async () => {
    await mkdir(join(dir, '.ssh'), { recursive: true });
    const result = await listFilesTool('.ssh', dir);
    expect(result.error).toMatch(/\.ssh/);
  });

  it('refuses to list .aws directory', async () => {
    await mkdir(join(dir, '.aws'), { recursive: true });
    const result = await listFilesTool('.aws', dir);
    expect(result.error).toMatch(/\.aws/);
  });

  it('refuses to list node_modules directory', async () => {
    await mkdir(join(dir, 'node_modules'), { recursive: true });
    const result = await listFilesTool('node_modules', dir);
    expect(result.error).toMatch(/node_modules/);
  });

  it('refuses path traversal via ..', async () => {
    const result = await listFilesTool('..', dir);
    expect(result.error).toMatch(/outside workspace/i);
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

  it('does not return .env file contents even when content matches query', async () => {
    await writeFile(join(dir, 'a.js'), 'const hello = 1;', 'utf-8');
    await writeFile(join(dir, '.env'), 'API_KEY=sk-secret-hello', 'utf-8');
    const result = await searchTool('hello', dir);
    expect(result.error).toBeUndefined();
    expect(result.results.some((r) => r.path.includes('.env'))).toBe(false);
  });

  it('does not return .env.local file contents even when content matches query', async () => {
    await writeFile(join(dir, 'app.js'), 'const hello = 1;', 'utf-8');
    await writeFile(join(dir, '.env.local'), 'API_KEY=sk-hello-secret', 'utf-8');
    const result = await searchTool('hello', dir);
    expect(result.error).toBeUndefined();
    expect(result.results.some((r) => r.path.includes('.env'))).toBe(false);
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

describe('explainTool', () => {
  it('returns structured explanation with all fields', () => {
    const r = explainTool({
      concept: 'Event Emitter Pattern',
      explanation: 'Decouples producers from consumers via named events.',
      example: "bus.on('USER_MESSAGE', handler)",
      category: 'code_concept'
    });
    expect(r.concept).toBe('Event Emitter Pattern');
    expect(r.explanation).toBe('Decouples producers from consumers via named events.');
    expect(r.example).toBe("bus.on('USER_MESSAGE', handler)");
    expect(r.category).toBe('code_concept');
  });

  it('defaults example to null when not provided', () => {
    const r = explainTool({ concept: 'X', explanation: 'Y' });
    expect(r.example).toBeNull();
  });

  it('defaults category to code_concept when not provided', () => {
    const r = explainTool({ concept: 'X', explanation: 'Y' });
    expect(r.category).toBe('code_concept');
  });

  it('parseToolIntent detects explain JSON from LLM output', () => {
    const json = JSON.stringify({
      tool: 'explain',
      args: { concept: 'Singleton', explanation: 'One shared instance.', category: 'code_concept' }
    });
    const result = parseToolIntent(json);
    expect(result).not.toBeNull();
    expect(result.tool).toBe('explain');
    expect(result.args.concept).toBe('Singleton');
  });
});
