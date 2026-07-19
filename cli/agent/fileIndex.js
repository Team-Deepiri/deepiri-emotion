/**
 * Lazily-built, cached index of workspace files for @-mention autocomplete.
 * Walks the tree once per workspace root, respecting the same blocked
 * dirs/name patterns as pathSafety.js, and skips dotfiles/dotdirs.
 */
import { readdir } from 'fs/promises';
import { join, relative } from 'path';
import { BLOCKED_DIRS, isBlockedPathPart } from './pathSafety.js';

const MAX_FILES = 5000;

let cache = null; // { cwd, files: string[] }

async function walk(dir, cwd, results) {
  if (results.length >= MAX_FILES) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (results.length >= MAX_FILES) return;
    const name = entry.name;
    if (name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (BLOCKED_DIRS.has(name.toLowerCase())) continue;
      await walk(join(dir, name), cwd, results);
    } else if (entry.isFile()) {
      if (isBlockedPathPart(name)) continue;
      results.push(relative(cwd, join(dir, name)));
    }
  }
}

/** Builds (or returns the cached) file list for `cwd`. */
export async function buildFileIndex(cwd) {
  if (cache && cache.cwd === cwd) return cache.files;
  const results = [];
  await walk(cwd, cwd, results);
  cache = { cwd, files: results };
  return results;
}

/** Drops the cache — call if the workspace changes underneath a long-running session. */
export function invalidateFileIndex() {
  cache = null;
}

/**
 * Subsequence fuzzy match: every char of `query` must appear in order within
 * `target`. Lower score = tighter match (fewer/smaller gaps between matched chars).
 */
function fuzzyScore(query, target) {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (lastMatch !== -1) score += ti - lastMatch - 1;
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : null;
}

/** Fuzzy-searches the (cached) workspace file index for `query`. */
export async function fuzzyFind(query, cwd, limit = 20) {
  const files = await buildFileIndex(cwd);
  if (!query) return files.slice(0, limit);

  const scored = [];
  for (const file of files) {
    const score = fuzzyScore(query, file);
    if (score !== null) scored.push({ file, score });
  }
  scored.sort((a, b) => a.score - b.score || a.file.length - b.file.length);
  return scored.slice(0, limit).map((s) => s.file);
}
