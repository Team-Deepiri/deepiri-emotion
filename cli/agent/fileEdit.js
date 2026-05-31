/**
 * Safe file editing tools: create_file, write_file, edit_file.
 * All paths are validated against the workspace root before any I/O.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, isAbsolute, relative, sep, dirname } from 'path';
import { findMatch } from './fileEditMatch.js';

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
  const match = findMatch(content, oldString);
  if (match.error) {
    return { error: `${match.error} (file: ${filePath})` };
  }

  const newContent = content.slice(0, match.index) + newString + content.slice(match.index + match.length);
  await writeFile(resolved, newContent, 'utf-8');

  return {
    path: resolved,
    edited: true,
    strategy: match.strategy,
    confidence: match.confidence,
    diff: generateDiffPreview(filePath, oldString, newString),
  };
}

const MAX_PREVIEW_LINES = 12;
const MAX_PREVIEW_CHARS = 800;

function previewContent(content) {
  const text = String(content ?? '');
  const clipped = text.split('\n').slice(0, MAX_PREVIEW_LINES).join('\n').slice(0, MAX_PREVIEW_CHARS);
  return clipped.length < text.length ? `${clipped}\n… (truncated)` : clipped;
}

/**
 * Compute what a mutating tool WOULD do, without writing to disk.
 * Runs the same safety + validity checks as the real tools so a preview that
 * succeeds guarantees the subsequent write succeeds.
 * Returns { path, action, preview, overwrite?, error? }.
 */
export async function previewMutation(tool, args = {}, cwd = DEFAULT_CWD) {
  const { filePath } = args;
  if (!filePath) return { error: 'filePath is required' };

  const safety = checkPathSafety(filePath, cwd);
  if (safety.error) return { error: safety.error };
  const { resolved } = safety;

  if (tool === 'create_file') {
    if (existsSync(resolved)) {
      return { error: `File already exists: ${resolved}. Use write_file to overwrite an existing file.` };
    }
    return { path: resolved, action: 'create', preview: previewContent(args.content) };
  }

  if (tool === 'write_file') {
    const existed = existsSync(resolved);
    if (existed && args.allowOverwrite !== true) {
      return { error: `File already exists: ${resolved}. Refusing to overwrite without explicit overwrite approval.` };
    }
    return {
      path: resolved,
      action: existed ? 'overwrite' : 'create',
      overwrite: existed,
      preview: previewContent(args.content),
    };
  }

  if (tool === 'edit_file') {
    const { oldString, newString } = args;
    if (!oldString) return { error: 'oldString must not be empty' };
    if (newString === undefined || newString === null) {
      return { error: 'newString must be provided (use empty string to delete text)' };
    }
    if (!existsSync(resolved)) return { error: `File not found: ${resolved}` };

    const content = await readFile(resolved, 'utf-8');
    const match = findMatch(content, oldString);
    if (match.error) return { error: `${match.error} (file: ${filePath})` };

    return {
      path: resolved,
      action: 'edit',
      preview: generateDiffPreview(filePath, oldString, newString),
      strategy: match.strategy,
      confidence: match.confidence,
    };
  }

  return { error: `Not a mutating tool: ${tool}` };
}
