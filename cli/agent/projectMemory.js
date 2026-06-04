/**
 * Project memory loader: reads EMOTION.md from the workspace root if present
 * and returns its content for injection into the agent's system context.
 * Silent no-op when the file is absent or unsafe (symlink escape, etc.).
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { safeWorkspacePath } from './pathSafety.js';

const PROJECT_MEMORY_FILE = 'EMOTION.md';
const MAX_CONTENT_BYTES = 16 * 1024; // 16KB

export async function loadProjectMemory(cwd = process.cwd()) {
  const fallbackPath = join(cwd, PROJECT_MEMORY_FILE);

  // Verify the path is safe before reading (symlink-escape protection).
  const safety = await safeWorkspacePath(PROJECT_MEMORY_FILE, cwd);
  if (safety.error) {
    return { found: false, path: fallbackPath, content: '', truncated: false };
  }
  const path = safety.resolved;

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
