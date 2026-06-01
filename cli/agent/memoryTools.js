/**
 * Per-workspace persistent memory store for the agent.
 * Backs a JSON file (`.emotion-memory.json`) in the workspace root with size caps
 * and atomic writes. The agent uses memory_set/get/list to remember facts across
 * sessions ("the user prefers tabs over spaces", "the project entrypoint is X").
 */
import { readFile, writeFile, rename, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const MEMORY_FILE = '.emotion-memory.json';
const MAX_KEY_LENGTH = 200;
const MAX_VALUE_BYTES = 4 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;

function memoryPath(cwd) {
  return join(cwd, MEMORY_FILE);
}

function validateKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return 'key must be a non-empty string';
  }
  if (key.length > MAX_KEY_LENGTH) {
    return `key must be ${MAX_KEY_LENGTH} characters or fewer`;
  }
  if (key.includes('/') || key.includes('\\') || key.includes('\x00')) {
    return 'key must not contain path separators or null bytes';
  }
  return null;
}

async function readStore(cwd) {
  const path = memoryPath(cwd);
  if (!existsSync(path)) return {};
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(cwd, store) {
  const path = memoryPath(cwd);
  const serialized = JSON.stringify(store, null, 2);
  if (Buffer.byteLength(serialized, 'utf-8') > MAX_FILE_BYTES) {
    return { error: `memory file would exceed ${MAX_FILE_BYTES} bytes` };
  }
  const tmp = `${path}.tmp`;
  try {
    await writeFile(tmp, serialized, 'utf-8');
    await rename(tmp, path);
    return { ok: true };
  } catch (err) {
    try { await unlink(tmp); } catch { /* tmp may not exist */ }
    return { error: err.message };
  }
}

export async function memorySet({ key, value } = {}, cwd = process.cwd()) {
  const keyErr = validateKey(key);
  if (keyErr) return { error: keyErr };
  if (value === undefined || value === null) {
    return { error: 'value must not be null or undefined' };
  }
  const serializedValue = JSON.stringify(value);
  if (Buffer.byteLength(serializedValue, 'utf-8') > MAX_VALUE_BYTES) {
    return { error: `value must be ${MAX_VALUE_BYTES} bytes or fewer when JSON-serialized` };
  }
  const store = await readStore(cwd);
  store[key] = value;
  const writeResult = await writeStore(cwd, store);
  if (writeResult.error) return { error: writeResult.error };
  return { ok: true, key, stored: true };
}

export async function memoryGet({ key } = {}, cwd = process.cwd()) {
  const keyErr = validateKey(key);
  if (keyErr) return { error: keyErr };
  const store = await readStore(cwd);
  if (!(key in store)) {
    return { found: false, key };
  }
  return { found: true, key, value: store[key] };
}

export async function memoryList(_args = {}, cwd = process.cwd()) {
  const store = await readStore(cwd);
  const keys = Object.keys(store).sort();
  return { count: keys.length, keys };
}
