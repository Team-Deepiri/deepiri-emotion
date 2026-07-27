/**
 * CLI tools: read_file, search, run_command, create_file, write_file, edit_file,
 * git_status, git_diff, thoughts, memory_set, memory_get, memory_list, web_search,
 * web_fetch.
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
import { safeWorkspacePath, isBlockedDir, isBlockedName } from './pathSafety.js';

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
      // Block secrets/credentials by name (.env*, keys, etc.) and heavy/VCS
      // directories, but otherwise allow dotfiles — .gitignore, .eslintrc,
      // .prettierrc and similar are useful search targets.
      if (isBlockedName(e.name)) continue;
      if (e.isDirectory() && isBlockedDir(e.name)) continue;
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

const WEB_TIMEOUT_MS = 15_000;
const WEB_FETCH_MAX_BYTES = 500_000; // raw bytes read off the wire before stripping tags
const WEB_MAX_CONTENT = 8000; // matches readFileTool's cap, so timelines/context stay consistent
const WEB_USER_AGENT = 'Mozilla/5.0 (compatible; EmotionCLI/1.0)';

const HTML_ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decodeHtmlEntities(s) {
  // Single pass so a decoded '&' (from &amp;) can't be re-scanned and
  // matched against &lt;/&gt;/etc — chained sequential replaces would
  // double-decode e.g. "&amp;lt;" into "<" instead of the literal "&lt;".
  return s.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => HTML_ENTITIES[m]);
}

function stripHtml(html) {
  const withoutTags = html
    .replace(/<script\b[\s\S]*?<\/script\b[^>]*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\b[^>]*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withoutTags)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Fetch a URL with a timeout and a hard cap on bytes read off the wire, so a
 * huge or slow-streaming page can't hang the tool loop or blow up memory.
 */
async function fetchWithLimit(url, { timeoutMs = WEB_TIMEOUT_MS, maxBytes = WEB_FETCH_MAX_BYTES } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': WEB_USER_AGENT } });
    if (!res.ok) return { error: `HTTP ${res.status}` };

    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return { text: text.slice(0, maxBytes) };
    }
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      text += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    return { text: text.slice(0, maxBytes) };
  } catch (err) {
    if (err.name === 'AbortError') return { error: `Request timed out after ${timeoutMs / 1000}s` };
    return { error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

function extractDdgUrl(href) {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

/**
 * Web search via DuckDuckGo's HTML endpoint — no API key required, so the
 * tool works out of the box the same way the rest of the CLI defaults to
 * zero-config local/free options first.
 */
export async function webSearchTool(query, limit = 8) {
  if (!query || !query.trim()) return { error: 'Empty query' };
  const q = query.trim();
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;

  const fetched = await fetchWithLimit(endpoint);
  if (fetched.error) return { query: q, error: fetched.error };

  const blocks = fetched.text.split('<div class="result ').slice(1);
  const results = [];
  for (const block of blocks) {
    if (results.length >= limit) break;
    const titleMatch = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!titleMatch) continue;
    const url = extractDdgUrl(titleMatch[1]);
    const title = decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, '')).trim();
    if (!url || !title) continue;
    const snippetMatch = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    const snippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, '')).trim() : '';
    results.push({ title, url, snippet });
  }

  return { query: q, count: results.length, results };
}

/**
 * Fetch a page and return its extracted text content, truncated the same
 * way readFileTool truncates file contents.
 */
export async function webFetchTool(url) {
  if (!url || typeof url !== 'string') return { error: 'url is required' };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { error: `Invalid URL: ${url}` };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: `Unsupported URL scheme: ${parsed.protocol}` };
  }

  const fetched = await fetchWithLimit(parsed.toString());
  if (fetched.error) return { url: parsed.toString(), error: fetched.error };

  const content = stripHtml(fetched.text);
  const truncated = content.length > WEB_MAX_CONTENT;
  return {
    url: parsed.toString(),
    content: content.slice(0, WEB_MAX_CONTENT),
    truncated,
  };
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

/**
 * Find a `{"tool": ...}` object embedded in prose and return its exact
 * substring, respecting brace nesting and quoted strings. A regex with a
 * non-greedy `\}` (the previous approach) stops at the FIRST closing brace,
 * which truncates any tool call whose args is itself an object (create_file,
 * write_file, edit_file, delegate — i.e. most mutating tools) before the
 * real closing brace, so it never parses as valid JSON.
 */
function extractEmbeddedToolJson(raw) {
  const start = raw.search(/\{\s*"tool"\s*:/);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
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
  const embeddedRaw = extractEmbeddedToolJson(raw);
  if (embeddedRaw) {
    const embedded = tryValidateJson(embeddedRaw);
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

  if (tool === 'web_search') {
    return webSearchTool(args.query, args.limit);
  }

  if (tool === 'web_fetch') {
    return webFetchTool(args.url);
  }

  return { error: `Unknown tool: ${tool}` };
}
