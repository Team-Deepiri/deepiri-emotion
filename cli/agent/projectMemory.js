/**
 * Project memory loader: reads EMOTION.md from the workspace root if present
 * and returns its content for injection into the agent's system context.
 * Silent no-op when the file is absent or unsafe (symlink escape, etc.).
 */
import { open } from 'fs/promises';
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

  // Stream the first MAX_CONTENT_BYTES (+1) so a 1GB file never OOMs the process.
  // The +1 lets us detect whether more content existed past the cap.
  let handle;
  try {
    handle = await open(path, 'r');
    const buffer = Buffer.alloc(MAX_CONTENT_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, MAX_CONTENT_BYTES + 1, 0);
    const truncated = bytesRead > MAX_CONTENT_BYTES;
    const sliceLen = truncated ? MAX_CONTENT_BYTES : bytesRead;
    const content = buffer.slice(0, sliceLen).toString('utf-8');
    return { found: true, path, content, truncated };
  } catch (err) {
    return { found: false, path, content: '', truncated: false, error: err.message };
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}
