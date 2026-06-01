/**
 * Project memory loader: reads EMOTION.md from the workspace root if present
 * and returns its content for injection into the agent's system context.
 * Silent no-op when the file is absent.
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const PROJECT_MEMORY_FILE = 'EMOTION.md';
const MAX_CONTENT_BYTES = 16 * 1024; // 16KB

export async function loadProjectMemory(cwd = process.cwd()) {
  const path = join(cwd, PROJECT_MEMORY_FILE);
  if (!existsSync(path)) {
    return { found: false, path, content: '', truncated: false };
  }
  try {
    const raw = await readFile(path, 'utf-8');
    const truncated = raw.length > MAX_CONTENT_BYTES;
    const content = truncated ? raw.slice(0, MAX_CONTENT_BYTES) : raw;
    return { found: true, path, content, truncated };
  } catch (err) {
    return { found: false, path, content: '', truncated: false, error: err.message };
  }
}
