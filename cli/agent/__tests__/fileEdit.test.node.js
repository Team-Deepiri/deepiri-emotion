import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createFileTool, writeFileTool, editFileTool } from '../fileEdit.js';

let dir;

beforeEach(async () => {
  dir = join(tmpdir(), `file-edit-test-${Date.now()}`);
  await mkdir(dir, { recursive: true });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true }).catch(() => {});
});

// ─── createFileTool ───────────────────────────────────────────────────────────

describe('createFileTool', () => {
  it('creates a new file with correct content', async () => {
    const result = await createFileTool('new.js', 'const x = 1;', dir);
    expect(result.error).toBeUndefined();
    expect(result.created).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
    const content = await readFile(join(dir, 'new.js'), 'utf-8');
    expect(content).toBe('const x = 1;');
  });

  it('creates file in a subdirectory, making parent dirs', async () => {
    const result = await createFileTool('sub/dir/file.js', 'hello', dir);
    expect(result.error).toBeUndefined();
    expect(result.created).toBe(true);
  });

  it('refuses if file already exists', async () => {
    await writeFile(join(dir, 'exists.js'), 'old', 'utf-8');
    const result = await createFileTool('exists.js', 'new', dir);
    expect(result.error).toMatch(/already exists/i);
    const content = await readFile(join(dir, 'exists.js'), 'utf-8');
    expect(content).toBe('old');
  });

  it('allows absolute path inside workspace', async () => {
    const absPath = join(dir, 'abs.js');
    const result = await createFileTool(absPath, 'abs content', dir);
    expect(result.error).toBeUndefined();
    expect(result.created).toBe(true);
  });
});

// ─── writeFileTool ────────────────────────────────────────────────────────────

describe('writeFileTool', () => {
  it('creates a new file when it does not exist', async () => {
    const result = await writeFileTool('written.js', 'content', dir);
    expect(result.error).toBeUndefined();
    expect(result.overwritten).toBe(false);
    expect(result.message).toMatch(/written/i);
    const content = await readFile(join(dir, 'written.js'), 'utf-8');
    expect(content).toBe('content');
  });

  it('refuses to overwrite an existing file by default', async () => {
    await writeFile(join(dir, 'target.js'), 'old content', 'utf-8');
    const result = await writeFileTool('target.js', 'new content', dir);
    expect(result.error).toMatch(/already exists/i);
    expect(result.error).toMatch(/overwrite/i);
    const content = await readFile(join(dir, 'target.js'), 'utf-8');
    expect(content).toBe('old content');
  });

  it('overwrites an existing file when allowOverwrite is true', async () => {
    await writeFile(join(dir, 'target.js'), 'old content', 'utf-8');
    const result = await writeFileTool('target.js', 'new content', dir, true);
    expect(result.error).toBeUndefined();
    expect(result.overwritten).toBe(true);
    expect(result.message).toMatch(/overwritten/i);
    const content = await readFile(join(dir, 'target.js'), 'utf-8');
    expect(content).toBe('new content');
  });

  it('rejects .env file', async () => {
    const result = await writeFileTool('.env', 'SECRET=1', dir);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects file with "secret" in name', async () => {
    const result = await writeFileTool('my-secrets.js', '', dir);
    expect(result.error).toBeDefined();
  });

  it('rejects file with "credential" in name', async () => {
    const result = await writeFileTool('credentials.json', '{}', dir);
    expect(result.error).toBeDefined();
  });

  it('rejects path traversal', async () => {
    const result = await writeFileTool('../outside.js', 'data', dir);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/outside workspace/i);
  });

  it('rejects absolute path outside workspace', async () => {
    const result = await writeFileTool('/tmp/evil.js', 'data', dir);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/outside workspace/i);
  });

  it('rejects paths into .git', async () => {
    const result = await writeFileTool('.git/config', 'data', dir);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/\.git/);
  });

  it('rejects paths into node_modules', async () => {
    const result = await writeFileTool('node_modules/pkg/index.js', 'data', dir);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/node_modules/);
  });

  it('rejects .pem file', async () => {
    const result = await writeFileTool('server.pem', 'data', dir);
    expect(result.error).toBeDefined();
  });

  it('rejects .key file', async () => {
    const result = await writeFileTool('server.key', 'data', dir);
    expect(result.error).toBeDefined();
  });
});

// ─── editFileTool ─────────────────────────────────────────────────────────────

describe('editFileTool', () => {
  it('replaces oldString when it appears exactly once', async () => {
    await writeFile(join(dir, 'code.js'), 'const a = 1;\nconst b = 2;\n', 'utf-8');
    const result = await editFileTool('code.js', 'const a = 1;', 'const a = 99;', dir);
    expect(result.error).toBeUndefined();
    expect(result.edited).toBe(true);
    const content = await readFile(join(dir, 'code.js'), 'utf-8');
    expect(content).toBe('const a = 99;\nconst b = 2;\n');
  });

  it('includes a diff preview in the result', async () => {
    await writeFile(join(dir, 'code.js'), 'hello world', 'utf-8');
    const result = await editFileTool('code.js', 'hello', 'goodbye', dir);
    expect(result.diff).toContain('-hello');
    expect(result.diff).toContain('+goodbye');
    expect(result.diff).toContain('--- code.js');
    expect(result.diff).toContain('+++ code.js');
  });

  it('refuses when oldString is not found', async () => {
    await writeFile(join(dir, 'code.js'), 'hello world', 'utf-8');
    const result = await editFileTool('code.js', 'not present', 'replacement', dir);
    expect(result.error).toMatch(/not found/i);
    const content = await readFile(join(dir, 'code.js'), 'utf-8');
    expect(content).toBe('hello world');
  });

  it('refuses when oldString appears more than once', async () => {
    await writeFile(join(dir, 'code.js'), 'dup\ndup\n', 'utf-8');
    const result = await editFileTool('code.js', 'dup', 'replaced', dir);
    expect(result.error).toMatch(/2 times/i);
    const content = await readFile(join(dir, 'code.js'), 'utf-8');
    expect(content).toBe('dup\ndup\n');
  });

  it('refuses when oldString is empty', async () => {
    await writeFile(join(dir, 'code.js'), 'content', 'utf-8');
    const result = await editFileTool('code.js', '', 'new', dir);
    expect(result.error).toMatch(/empty/i);
  });

  it('refuses when file does not exist', async () => {
    const result = await editFileTool('missing.js', 'old', 'new', dir);
    expect(result.error).toMatch(/not found/i);
  });

  it('can delete text by passing empty newString', async () => {
    await writeFile(join(dir, 'code.js'), 'remove this line\nkeep this', 'utf-8');
    const result = await editFileTool('code.js', 'remove this line\n', '', dir);
    expect(result.error).toBeUndefined();
    const content = await readFile(join(dir, 'code.js'), 'utf-8');
    expect(content).toBe('keep this');
  });

  it('rejects unsafe path', async () => {
    const result = await editFileTool('.env', 'old', 'new', dir);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects path traversal', async () => {
    const result = await editFileTool('../sibling.js', 'old', 'new', dir);
    expect(result.error).toMatch(/outside workspace/i);
  });
});
