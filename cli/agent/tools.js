/**
 * CLI tools: read_file, search, run_command, create_file, write_file, edit_file,
 * git_status, git_diff, thoughts, memory_set, memory_get, memory_list.
 * Used by runner to emit TOOL_START/TOOL_END.
 */
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { createFileTool, writeFileTool, editFileTool } from './fileEdit.js';
import { gitStatus, gitDiff } from './gitTools.js';
import { thoughtsTool } from './thoughtsTool.js';
import { memorySet, memoryGet, memoryList } from './memoryTools.js';
import { validateToolCall } from './loopGuards.js';
import { safeWorkspacePath } from './pathSafety.js';

const DEFAULT_CWD = process.cwd();
const RUN_TIMEOUT_MS = 30_000;
const RUN_MAX_OUTPUT = 16_000;

/**
 * Read a file (path relative to cwd or absolute). Max length capped for display.
 * Path is validated for containment, blocked patterns (.env, secrets, keys),
 * and symlink-escape before any read.
 */
export async function readFileTool(filePath, cwd = DEFAULT_CWD) {
  const safety = await safeWorkspacePath(filePath, cwd);
  if (safety.error) return { error: safety.error };
  const resolved = safety.resolved;
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
      // Skip all dotfiles (includes .env — never let secrets reach the LLM),
      // and skip heavy directories that don't contain user source code.
      if (e.name.startsWith('.')) continue;
      if (e.name === 'node_modules' || e.name === '.git') continue;
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
 * Path is validated for containment, blocked patterns, and symlink-escape
 * before any directory read. Dotfiles are still filtered from the output.
 */
export async function listFilesTool(dirPath = '.', cwd = DEFAULT_CWD) {
  const safety = await safeWorkspacePath(dirPath, cwd);
  if (safety.error) return { error: safety.error };
  const resolved = safety.resolved;

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
function tryValidateJson(str) {
  try {
    const parsed = JSON.parse(str.trim());
    return validateToolCall(parsed) || null;
  } catch {
    return null;
  }
}

export function parseToolIntent(text) {
  // Strip thinking/reasoning blocks emitted by Qwen3, DeepSeek-R1, etc.
  let raw = (text || '').trim().replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 1. Direct JSON parse (clean output)
  const direct = tryValidateJson(raw);
  if (direct) return direct;

  // 2. JSON inside markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenceMatch) {
    const fenced = tryValidateJson(fenceMatch[1]);
    if (fenced) return fenced;
  }

  // 3. Bare JSON object containing a "tool" key embedded in prose
  const jsonMatch = /(\{[^{}]*"tool"\s*:[\s\S]*?\})/m.exec(raw);
  if (jsonMatch) {
    const embedded = tryValidateJson(jsonMatch[1]);
    if (embedded) return embedded;
  }

  // 4. Natural language fallback — preserves original-case for paths/commands.
  const readMatch =
    /read\s+file\s+([^\s,]+)/i.exec(raw) ||
    /read\s+([^\s,]+\.\w+)/i.exec(raw);
  if (readMatch) {
    return { tool: 'read_file', args: { filePath: readMatch[1].trim() } };
  }
  const searchMatch =
    /search\s+(?:for\s+)?["']?([^"']+)["']?/i.exec(raw) ||
    /search\s+(.+)/i.exec(raw);
  if (searchMatch) {
    return { tool: 'search', args: { query: searchMatch[1].trim() } };
  }
  const listFilesMatch =
    /list\s+files\s+(.+)/i.exec(raw) ||
    /list\s+(.+)/i.exec(raw);
  if (listFilesMatch) {
    return { tool: 'list_files', args: { dirPath: listFilesMatch[1].trim() } };
  }
  const runMatch = /^run\s+(.+)/i.exec(raw);
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

  if (tool === 'git_status') {
    return gitStatus(cwd);
  }

  if (tool === 'git_diff') {
    return gitDiff(cwd, { staged: args.staged === true, path: args.path ?? null });
  }

  if (tool === 'thoughts') {
    return thoughtsTool(args);
  }

  if (tool === 'memory_set') {
    return memorySet(args, cwd);
  }

  if (tool === 'memory_get') {
    return memoryGet(args, cwd);
  }

  if (tool === 'memory_list') {
    return memoryList(args, cwd);
  }

  return { error: `Unknown tool: ${tool}` };
}
