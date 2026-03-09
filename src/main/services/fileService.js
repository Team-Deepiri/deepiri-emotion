/**
 * File service: open, save, list, create, delete, rename, search.
 */
import { readFile, writeFile, readdir, mkdir, unlink, rm, stat } from 'fs/promises';
import { IPC } from '../../shared/ipcChannels.js';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { listWorkspaceFiles, parseExcludePatterns } from '../../indexing.js';
import { SEARCH_MAX_RESULTS } from '../../shared/constants.js';

const SKIP_DIRS = parseExcludePatterns();
const TEXT_EXT = new Set(['js', 'jsx', 'ts', 'tsx', 'json', 'md', 'html', 'css', 'scss', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'yaml', 'yml', 'sh', 'bash', 'sql', 'xml', 'txt', 'log', 'env']);

async function searchInFolderRecursive(rootDir, query, opts, results, maxResults = SEARCH_MAX_RESULTS) {
  if (results.length >= maxResults) return;
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  const caseSensitive = opts?.caseSensitive ?? false;
  const wholeWord = opts?.wholeWord ?? false;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = wholeWord
    ? new RegExp(`\\b${escaped}\\b`, caseSensitive ? 'g' : 'gi')
    : new RegExp(escaped, caseSensitive ? 'g' : 'gi');

  for (const e of entries) {
    if (results.length >= maxResults) break;
    const fullPath = join(rootDir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await searchInFolderRecursive(fullPath, query, opts, results, maxResults);
    } else {
      const ext = e.name.split('.').pop()?.toLowerCase();
      if (!ext || !TEXT_EXT.has(ext)) continue;
      let content;
      try {
        content = await readFile(fullPath, 'utf-8');
      } catch {
        continue;
      }
      const lines = content.split('\n');
      for (let i = 0; i < lines.length && results.length < maxResults; i++) {
        const line = lines[i];
        let match;
        while ((match = re.exec(line)) !== null) {
          results.push({
            path: fullPath,
            name: e.name,
            line: i + 1,
            column: match.index + 1,
            text: line.trim().slice(0, 100)
          });
        }
      }
    }
  }
}

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} _deps
 */
export function registerFileService(ipcMain, _deps) {
  ipcMain.handle(IPC.OPEN_FILE, async (_event, path) => {
    try {
      return await readFile(path, 'utf-8');
    } catch (error) {
      throw new Error(error.message || 'Failed to open file');
    }
  });

  ipcMain.handle(IPC.SAVE_FILE, async (_event, { path, content }) => {
    try {
      await writeFile(path, content, 'utf-8');
      return { success: true };
    } catch (error) {
      throw new Error(error.message || 'Failed to save file');
    }
  });

  ipcMain.handle(IPC.SEARCH_IN_FOLDER, async (_event, rootDir, query, opts = {}) => {
    const results = [];
    if (!rootDir || !query?.trim()) return results;
    await searchInFolderRecursive(rootDir, query.trim(), opts, results);
    return results;
  });

  ipcMain.handle(IPC.LIST_WORKSPACE_FILES, async (_event, rootDir, excludePatterns) => {
    return listWorkspaceFiles(rootDir, excludePatterns);
  });

  ipcMain.handle(IPC.LIST_DIRECTORY, async (_event, dirPath) => {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      return entries.map((e) => ({
        name: e.name,
        path: join(dirPath, e.name),
        isDirectory: e.isDirectory()
      }));
    } catch (error) {
      throw new Error(error.message || 'Failed to list directory');
    }
  });

  ipcMain.handle(IPC.CREATE_FILE, async (_event, { dirPath, name }) => {
    const fullPath = join(dirPath, name);
    if (existsSync(fullPath)) throw new Error('File already exists');
    const parent = dirname(fullPath);
    await mkdir(parent, { recursive: true });
    await writeFile(fullPath, '', 'utf-8');
    return { path: fullPath };
  });

  ipcMain.handle(IPC.CREATE_FOLDER, async (_event, { dirPath, name }) => {
    const fullPath = join(dirPath, name);
    if (existsSync(fullPath)) throw new Error('Folder already exists');
    await mkdir(fullPath, { recursive: true });
    return { path: fullPath };
  });

  ipcMain.handle(IPC.DELETE_PATH, async (_event, targetPath) => {
    const s = await stat(targetPath);
    if (s.isDirectory()) {
      await rm(targetPath, { recursive: true });
    } else {
      await unlink(targetPath);
    }
    return { success: true };
  });

  ipcMain.handle(IPC.RENAME_PATH, async (_event, { oldPath, newName }) => {
    const parent = dirname(oldPath);
    const newPath = join(parent, newName);
    if (existsSync(newPath)) throw new Error('Target already exists');
    const { rename } = await import('fs/promises');
    await rename(oldPath, newPath);
    return { path: newPath };
  });
}
