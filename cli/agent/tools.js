/**
 * CLI tools: read_file, search, run_command, create_file, write_file, edit_file,
 * thoughts.
 * Used by runner to emit TOOL_START/TOOL_END.
 */
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { createFileTool, writeFileTool, editFileTool } from './fileEdit.js';
import { thoughtsTool } from './thoughtsTool.js';
import { validateToolCall } from './loopGuards.js';

const DEFAULT_CWD = process.cwd();
const RUN_TIMEOUT_MS = 30_000;
const RUN_MAX_OUTPUT = 16_000;

/**
 * Read a file (path relative to cwd or absolute). Max length capped for display.
 */
export async function readFileTool(filePath, cwd = DEFAULT_CWD) {
  const resolved = filePath.startsWith('/') ? filePath : join(cwd, filePath);
  if (!existsSync(resolved)) return { error: `File not found: ${resolved}` };
  const content = await readFile(resolved, 'utf-8').catch((e) => e.message);
  const max = 8000;
  const truncated = typeof content === 'string' && content.length > max;
  return {
    path: resolved,
    content: typeof content === 'string' ? content.slice(0, max) : content,
    truncated: !!truncated
  };
}

/**
 * Simple search: list files under dir and grep for query in content (plain string match).
 */
export async function searchTool(query, dir = DEFAULT_CWD, limit = 20) {
  if (!query || !query.trim()) return { error: 'Empty query' };
  const q = query.trim().toLowerCase();
  const results = [];
  async function walk(d, depth) {
    if (depth > 4 || results.length >= limit) return;
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.env') continue;
      const full = join(d, e.name);
      if (e.isDirectory()) {
        await walk(full, depth + 1);
      } else if (e.isFile()) {
        try {
          const content = await readFile(full, 'utf-8');
          if (content.toLowerCase().includes(q)) {
            results.push({ path: full, snippet: content.slice(0, 200) });
          }
        } catch {
          // skip binary / unreadable
        }
      }
    }
  }
  await walk(dir, 0);
  return { query: q, count: results.length, results };
}

/**
 * List files and folders in a directory.
 */
export async function listFilesTool(dirPath = '.', cwd = DEFAULT_CWD) {
  const resolved = dirPath.startsWith('/') ? dirPath : join(cwd, dirPath);

  if (!existsSync(resolved)) {
    return { error: `Directory not found: ${resolved}` };
  }

  let entries;
  try {
    entries = await readdir(resolved, { withFileTypes: true });
  } catch (err) {
    return { error: err.message };
  }

  const items = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map(async (entry) => {
        const fullPath = join(resolved, entry.name);
        const info = await stat(fullPath);

        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isFile() ? info.size : null
        };
      })
  );

  return {
    path: resolved,
    count: items.length,
    items
  };
}

/**
 * Run a shell command (cwd), timeout 30s. Returns { stdout, stderr, exitCode, error? }.
 */
export function runCommandTool(command, cwd = DEFAULT_CWD) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    const child = spawn(command, { shell: true, cwd });
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        error: `Command timed out after ${RUN_TIMEOUT_MS / 1000}s`,
        stdout: out.slice(0, RUN_MAX_OUTPUT),
        stderr: err.slice(0, RUN_MAX_OUTPUT),
        exitCode: null
      });
    }, RUN_TIMEOUT_MS);

    child.stdout?.on('data', (d) => { out += String(d); });
    child.stderr?.on('data', (d) => { err += String(d); });
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      resolve({
        stdout: out.slice(0, RUN_MAX_OUTPUT),
        stderr: err.slice(0, RUN_MAX_OUTPUT),
        exitCode: code ?? (signal ? -1 : 0),
        truncated: out.length > RUN_MAX_OUTPUT || err.length > RUN_MAX_OUTPUT
      });
    });
    child.on('error', (e) => {
      clearTimeout(timeout);
      resolve({ error: e.message, stdout: out, stderr: err, exitCode: -1 });
    });
  });
}

/**
 * Parse user message for simple tool intent. Returns { tool, args } or null.
 * JSON path: validates tool name and required args via loopGuards.validateToolCall.
 * Regex path: unchanged fallback for natural-language commands.
 */
export function parseToolIntent(text) {
  // Try parsing structured JSON tool call first; reject unknown/malformed calls.
  try {
    const parsed = JSON.parse(text.trim());
    const validated = validateToolCall(parsed);
    if (validated) return validated;
  } catch {
    // Not JSON, continue to regex parsing
  }
  const raw = (text || '').trim();
  const t = raw.toLowerCase();
  // const readMatch = t.match(/read\s+file\s+(.+)/) || t.match(/read\s+(.+\.\w+)/);
  const readMatch =
  t.match(/read\s+file\s+([^\s,]+)/) ||
  t.match(/read\s+([^\s,]+\.\w+)/);
  if (readMatch) {
    return { tool: 'read_file', args: { filePath: readMatch[1].trim() } };
  }
  const searchMatch = t.match(/search\s+(?:for\s+)?["']?([^"']+)["']?/) || t.match(/search\s+(.+)/);
  if (searchMatch) {
    return { tool: 'search', args: { query: searchMatch[1].trim() } };
  }

  const listFilesMatch =
  t.match(/list\s+files\s+(.+)/) ||
  t.match(/list\s+(.+)/);

  if (listFilesMatch) {
    return {
      tool: 'list_files',
      args: { dirPath: listFilesMatch[1].trim() }
    };
  }

  const runMatch = t.match(/^run\s+(.+)/);
  if (runMatch) {
    return { tool: 'run_command', args: { command: runMatch[1].trim() } };
  }
  return null;
}

/**
 * Explain tool: returns structured educational content.
 * The LLM calls this in teach mode to surface reasoning, concepts, or best practices.
 * No side effects — just returns the args as a structured object.
 */
export function explainTool({ concept, explanation, example = null, category = 'code_concept' }) {
  return { concept, explanation, example, category };
}

/**
 * Execute a tool by name.
 */
export async function executeTool(tool, args = {}, cwd = DEFAULT_CWD) {
  if (tool === 'read_file') {
    return readFileTool(args.filePath, cwd);
  }

  if (tool === 'search') {
    return searchTool(args.query, cwd);
  }

  if (tool === 'list_files') {
    return listFilesTool(args.dirPath || '.', cwd);
  }

  if (tool === 'run_command') {
    return runCommandTool(args.command, cwd);
  }

  if (tool === 'explain') {
    return explainTool(args);
  }

  if (tool === 'create_file') {
    return createFileTool(args.filePath, args.content, cwd);
  }

  if (tool === 'write_file') {
    return writeFileTool(args.filePath, args.content, cwd, args.allowOverwrite === true);
  }

  if (tool === 'edit_file') {
    return editFileTool(args.filePath, args.oldString, args.newString, cwd);
  }

  if (tool === 'thoughts') {
    return thoughtsTool(args);
  }

  return { error: `Unknown tool: ${tool}` };
}
