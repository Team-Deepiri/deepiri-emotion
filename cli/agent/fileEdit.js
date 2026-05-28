/**
 * Safe file editing tools: create_file, write_file, edit_file.
 * All paths are validated against the workspace root before any I/O.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, isAbsolute, relative, sep, dirname } from 'path';

const DEFAULT_CWD = process.cwd();

const BLOCKED_NAME_PATTERNS = [
  /^\.env$/i,
  /^\.env\./i,
  /secret/i,
  /credential/i,
  /private[_-]?key/i,
  /\.pem$/i,
  /\.key$/i,
];

const BLOCKED_DIR_NAMES = new Set(['.git', 'node_modules']);

function checkPathSafety(filePath, cwd) {
  const resolvedCwd = resolve(cwd);
  const resolved = isAbsolute(filePath) ? resolve(filePath) : resolve(cwd, filePath);

  const cwdWithSep = resolvedCwd.endsWith(sep) ? resolvedCwd : resolvedCwd + sep;
  if (!resolved.startsWith(cwdWithSep) && resolved !== resolvedCwd) {
    return { error: `Path resolves outside workspace: ${filePath}` };
  }

  const rel = relative(resolvedCwd, resolved);
  for (const part of rel.split(sep)) {
    if (BLOCKED_DIR_NAMES.has(part)) {
      return { error: `Editing inside ${part} is not allowed` };
    }
    for (const pattern of BLOCKED_NAME_PATTERNS) {
      if (pattern.test(part)) {
        return { error: `File path matches a blocked pattern: ${part}` };
      }
    }
  }

  return { resolved };
}

function countOccurrences(text, pattern) {
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(pattern, idx)) !== -1) {
    count++;
    idx += pattern.length;
  }
  return count;
}

function generateDiffPreview(filePath, oldString, newString) {
  const MAX_LINES = 8;
  const oldLines = oldString.split('\n').slice(0, MAX_LINES);
  const newLines = newString.split('\n').slice(0, MAX_LINES);
  return [
    `--- ${filePath}`,
    `+++ ${filePath}`,
    '@@ edit @@',
    ...oldLines.map((l) => `-${l}`),
    ...newLines.map((l) => `+${l}`),
  ].join('\n');
}

export async function createFileTool(filePath, content, cwd = DEFAULT_CWD) {
  const safety = checkPathSafety(filePath, cwd);
  if (safety.error) return { error: safety.error };
  const { resolved } = safety;

  if (existsSync(resolved)) {
    return { error: `File already exists: ${resolved}. Use write_file to overwrite an existing file.` };
  }

  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, String(content ?? ''), 'utf-8');

  return {
    path: resolved,
    created: true,
    bytes: Buffer.byteLength(String(content ?? ''), 'utf-8'),
  };
}

export async function writeFileTool(filePath, content, cwd = DEFAULT_CWD, allowOverwrite = false) {
  const safety = checkPathSafety(filePath, cwd);
  if (safety.error) return { error: safety.error };
  const { resolved } = safety;

  const existed = existsSync(resolved);
  if (existed && !allowOverwrite) {
    return { error: `File already exists: ${resolved}. Refusing to overwrite without explicit overwrite approval.` };
  }

  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, String(content ?? ''), 'utf-8');

  return {
    path: resolved,
    overwritten: existed,
    bytes: Buffer.byteLength(String(content ?? ''), 'utf-8'),
    message: existed ? 'File overwritten.' : 'File written.',
  };
}

export async function editFileTool(filePath, oldString, newString, cwd = DEFAULT_CWD) {
  const safety = checkPathSafety(filePath, cwd);
  if (safety.error) return { error: safety.error };
  const { resolved } = safety;

  if (!oldString) return { error: 'oldString must not be empty' };
  if (newString === undefined || newString === null) return { error: 'newString must be provided (use empty string to delete text)' };

  if (!existsSync(resolved)) {
    return { error: `File not found: ${resolved}` };
  }

  const content = await readFile(resolved, 'utf-8');
  const occurrences = countOccurrences(content, oldString);

  if (occurrences === 0) {
    return { error: `oldString not found in ${filePath}. No changes made.` };
  }
  if (occurrences > 1) {
    return {
      error: `oldString appears ${occurrences} times in ${filePath}. Provide more surrounding context to make it unique.`,
    };
  }

  const idx = content.indexOf(oldString);
  const newContent = content.slice(0, idx) + newString + content.slice(idx + oldString.length);
  await writeFile(resolved, newContent, 'utf-8');

  return {
    path: resolved,
    edited: true,
    diff: generateDiffPreview(filePath, oldString, newString),
  };
}
