/**
 * Cursor seat provider — subprocess wrapper around the user's local `agent --print`.
 * Auth lives in the CLI's own login (run `agent login` once). No API key required.
 *
 * Pattern adapted from caliber-ai-org/ai-setup/src/llm/cursor-acp.ts (MIT).
 * Note: we use `--print` (non-streaming) for simplicity. Cursor's stream-json
 * format with token-by-token deltas can be added as a follow-up.
 */
import { spawn, execFileSync, execSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import os from 'node:os';
import { EVENTS } from '../../core/eventBus.js';
import {
  Provider,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from './base.js';

const IS_WINDOWS = process.platform === 'win32';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const LOGIN_CHECK_TIMEOUT_MS = 5_000;

function candidateAgentPaths() {
  if (IS_WINDOWS) return [];
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return [];
  return [`${home}/.local/bin/agent`, '/usr/local/bin/agent', '/opt/homebrew/bin/agent'];
}

let _agentBin = null;
let _cachedLoggedIn = null;

export function resetCursorCache() {
  _agentBin = null;
  _cachedLoggedIn = null;
}

function resolveAgentBin(overridePath) {
  if (overridePath) return overridePath;
  if (_agentBin !== null) return _agentBin;

  try {
    const cmd = IS_WINDOWS ? 'where agent' : 'which agent';
    const out = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const first = out.split('\n')[0].trim();
    if (first) {
      _agentBin = first;
      return first;
    }
  } catch {
    // not on PATH
  }

  for (const candidate of candidateAgentPaths()) {
    try {
      accessSync(candidate, constants.X_OK);
      _agentBin = candidate;
      return candidate;
    } catch {
      // try next
    }
  }

  _agentBin = '';
  return '';
}

function checkCursorLogin(bin) {
  if (_cachedLoggedIn !== null) return _cachedLoggedIn;
  try {
    const result = execFileSync(bin, ['status'], {
      input: '',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: LOGIN_CHECK_TIMEOUT_MS,
    });
    _cachedLoggedIn = !String(result).toLowerCase().includes('not logged in');
  } catch {
    _cachedLoggedIn = false;
  }
  return _cachedLoggedIn;
}

export class CursorProvider extends Provider {
  static providerName = 'cursor';

  constructor({ binPath, model, timeoutMs, apiKey } = {}) {
    super();
    this.binPath = binPath;
    this.model = model;
    this.timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
    this.apiKey = apiKey || process.env.CURSOR_API_KEY || process.env.CURSOR_AUTH_TOKEN || '';
  }

  static async isAvailable(options = {}) {
    return Boolean(resolveAgentBin(options.binPath));
  }

  static async isAuthenticated(options = {}) {
    const bin = resolveAgentBin(options.binPath);
    if (!bin) return false;
    return checkCursorLogin(bin);
  }

  async stream(bus, prompt, opts = {}) {
    const bin = resolveAgentBin(this.binPath);
    if (!bin) throw new ProviderUnavailableError('Cursor Agent CLI not installed');

    const args = ['--print', '--trust', '--workspace', process.cwd() || os.tmpdir()];
    if (this.model) args.push('--model', this.model);
    if (this.apiKey) args.push('--api-key', this.apiKey);

    const child = spawn(bin, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Append image file paths so the cursor agent can reference them as local files.
    const attachments = Array.isArray(opts.attachments) ? opts.attachments : [];
    const attachNote = attachments.length > 0
      ? '\n\n' + attachments.map((a) => `[Attached image: ${a.path}]`).join('\n')
      : '';
    child.stdin.end(prompt + attachNote);

    return new Promise((resolve, reject) => {
      let settled = false;
      let stderrBuf = '';

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGTERM');
        reject(
          new ProviderUnavailableError(`Cursor agent timed out after ${this.timeoutMs / 1000}s`),
        );
      }, this.timeoutMs);

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString('utf-8');
        if (!opts.silent) bus.emit(EVENTS.LLM_TOKEN, { token: text });
        if (typeof opts.onToken === 'function') opts.onToken(text);
      });

      child.stderr.on('data', (chunk) => {
        stderrBuf += chunk.toString('utf-8');
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        reject(new ProviderUnavailableError(`Cursor agent spawn failed: ${err.message}`));
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        if (code === 0) {
          resolve();
          return;
        }
        const detail = stderrBuf.trim().slice(0, 200);
        const lower = detail.toLowerCase();
        if (lower.includes('not logged in') || lower.includes('unauthorized')) {
          reject(new ProviderAuthError(`Cursor agent auth failed: ${detail}`));
        } else if (lower.includes('rate') || lower.includes('limit') || lower.includes('usage')) {
          reject(new ProviderRateLimitError(`Cursor agent rate-limited: ${detail}`));
        } else {
          const base = signal ? `killed (${signal})` : `exited ${code}`;
          reject(new Error(`Cursor agent ${base}: ${detail}`));
        }
      });
    });
  }
}
