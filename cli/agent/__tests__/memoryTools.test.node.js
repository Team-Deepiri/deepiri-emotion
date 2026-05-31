import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { memorySet, memoryGet, memoryList } from '../memoryTools.js';

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'memory-tools-test-'));
});

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('memorySet + memoryGet (round-trip)', () => {
  it('stores and retrieves a simple string value', async () => {
    const setResult = await memorySet({ key: 'preference', value: 'tabs' }, dir);
    expect(setResult.ok).toBe(true);
    expect(setResult.stored).toBe(true);

    const getResult = await memoryGet({ key: 'preference' }, dir);
    expect(getResult.found).toBe(true);
    expect(getResult.value).toBe('tabs');
  });

  it('stores and retrieves a structured object value', async () => {
    const value = { entrypoint: 'cli/index.js', framework: 'ink' };
    await memorySet({ key: 'project', value }, dir);
    const result = await memoryGet({ key: 'project' }, dir);
    expect(result.value).toEqual(value);
  });

  it('overwrites an existing key', async () => {
    await memorySet({ key: 'mode', value: 'auto' }, dir);
    await memorySet({ key: 'mode', value: 'manual' }, dir);
    const result = await memoryGet({ key: 'mode' }, dir);
    expect(result.value).toBe('manual');
  });

  it('persists values to .emotion-memory.json on disk', async () => {
    await memorySet({ key: 'foo', value: 'bar' }, dir);
    const filePath = join(dir, '.emotion-memory.json');
    expect(existsSync(filePath)).toBe(true);
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(parsed).toEqual({ foo: 'bar' });
  });
});

describe('memoryGet (miss)', () => {
  it('returns found:false when key has never been set', async () => {
    const result = await memoryGet({ key: 'never-set' }, dir);
    expect(result.found).toBe(false);
    expect(result.key).toBe('never-set');
    expect(result.value).toBeUndefined();
  });
});

describe('memoryList', () => {
  it('returns empty list when no memory file exists', async () => {
    const result = await memoryList({}, dir);
    expect(result.count).toBe(0);
    expect(result.keys).toEqual([]);
  });

  it('returns sorted list of stored keys', async () => {
    await memorySet({ key: 'zebra', value: 1 }, dir);
    await memorySet({ key: 'apple', value: 2 }, dir);
    await memorySet({ key: 'mango', value: 3 }, dir);
    const result = await memoryList({}, dir);
    expect(result.count).toBe(3);
    expect(result.keys).toEqual(['apple', 'mango', 'zebra']);
  });
});

describe('validation', () => {
  it('rejects empty key on set', async () => {
    const result = await memorySet({ key: '', value: 'x' }, dir);
    expect(result.error).toMatch(/non-empty string/);
  });

  it('rejects missing key on set', async () => {
    const result = await memorySet({ value: 'x' }, dir);
    expect(result.error).toMatch(/non-empty string/);
  });

  it('rejects non-string key on set', async () => {
    const result = await memorySet({ key: 42, value: 'x' }, dir);
    expect(result.error).toMatch(/non-empty string/);
  });

  it('rejects key with path separator on set', async () => {
    const result = await memorySet({ key: 'a/b', value: 'x' }, dir);
    expect(result.error).toMatch(/path separators/);
  });

  it('rejects key over 200 chars on set', async () => {
    const result = await memorySet({ key: 'x'.repeat(201), value: 'v' }, dir);
    expect(result.error).toMatch(/200 characters/);
  });

  it('rejects null value', async () => {
    const result = await memorySet({ key: 'k', value: null }, dir);
    expect(result.error).toMatch(/null or undefined/);
  });

  it('rejects undefined value', async () => {
    const result = await memorySet({ key: 'k' }, dir);
    expect(result.error).toMatch(/null or undefined/);
  });

  it('rejects value exceeding 4KB JSON-serialized', async () => {
    const big = 'x'.repeat(5000);
    const result = await memorySet({ key: 'big', value: big }, dir);
    expect(result.error).toMatch(/4096 bytes or fewer/);
  });

  it('rejects bad key on get', async () => {
    const result = await memoryGet({ key: '' }, dir);
    expect(result.error).toMatch(/non-empty string/);
  });
});

describe('resilience', () => {
  it('treats a corrupted JSON file as empty store', async () => {
    writeFileSync(join(dir, '.emotion-memory.json'), '{ this is not json');
    const result = await memoryGet({ key: 'anything' }, dir);
    expect(result.found).toBe(false);
    const setResult = await memorySet({ key: 'recovered', value: 'yes' }, dir);
    expect(setResult.ok).toBe(true);
    const verify = await memoryGet({ key: 'recovered' }, dir);
    expect(verify.value).toBe('yes');
  });

  it('treats a JSON array file as empty store (defensive)', async () => {
    writeFileSync(join(dir, '.emotion-memory.json'), '[1, 2, 3]');
    const result = await memoryList({}, dir);
    expect(result.count).toBe(0);
  });
});
