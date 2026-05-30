/**
 * Claude Code seat provider — subprocess wrapper around the user's local `claude -p`.
 * Auth lives in the CLI's own login (run `claude` once interactively). No API key.
 *
 * Pattern adapted from caliber-ai-org/ai-setup/src/llm/claude-cli.ts (MIT).
 * Anthropic documents the headless `-p` mode at https://code.claude.com/docs/en/headless.
 */
import { spawn, execFileSync, execSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
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

// Env vars Claude Code sets when spawning subprocesses. Passing these through
// triggers its own anti-recursion detection — masquerades as "Not logged in".
const ANTI_RECURSION_ENV_VARS = new Set([
  'CLAUDECODE',
  'CLAUDE_CODE_SIMPLE',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_EXECPATH',
]);

function candidateClaudePaths() {
  if (IS_WINDOWS) return [];
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return [];
  return [
    `${home}/.local/bin/claude`,
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];
}

let _claudeBin = null;
let _cachedLoggedIn = null;

export function resetClaudeCliCache() {
  _claudeBin = null;
  _cachedLoggedIn = null;
}

function resolveClaudeBin(overridePath) {
  if (overridePath) return overridePath;
  if (_claudeBin !== null) return _claudeBin;

  try {
    const cmd = IS_WINDOWS ? 'where claude' : 'which claude';
    const out = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const first = out.split('\n')[0].trim();
    if (first) {
      _claudeBin = first;
      return first;
    }
  } catch {
    // not on PATH — fall through to well-known paths
  }

  for (const candidate of candidateClaudePaths()) {
    try {
      accessSync(candidate, constants.X_OK);
      _claudeBin = candidate;
      return candidate;
    } catch {
      // not executable / not present — try next
    }
  }

  _claudeBin = '';
  return '';
}

function cleanClaudeEnv() {
  const env = { ...process.env };
  for (const key of ANTI_RECURSION_ENV_VARS) delete env[key];
  return env;
}

function checkClaudeLogin(bin) {
  if (_cachedLoggedIn !== null) return _cachedLoggedIn;
  try {
    const result = execFileSync(bin, ['auth', 'status'], {
      input: '',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: LOGIN_CHECK_TIMEOUT_MS,
      env: cleanClaudeEnv(),
    });
    const output = String(result).trim();
    try {
      const parsed = JSON.parse(output);
      _cachedLoggedIn = parsed.loggedIn === true;
    } catch {
      _cachedLoggedIn = !output.toLowerCase().includes('not logged in');
    }
  } catch {
    _cachedLoggedIn = false;
  }
  return _cachedLoggedIn;
}

export class ClaudeCliProvider extends Provider {
  static providerName = 'claude-cli';

  constructor({ binPath, model, timeoutMs } = {}) {
    super();
    this.binPath = binPath;
    this.model = model;
    this.timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  static async isAvailable(options = {}) {
    return Boolean(resolveClaudeBin(options.binPath));
  }

  static async isAuthenticated(options = {}) {
    const bin = resolveClaudeBin(options.binPath);
    if (!bin) return false;
    return checkClaudeLogin(bin);
  }

  async stream(bus, prompt, opts = {}) {
    const bin = resolveClaudeBin(this.binPath);
    if (!bin) throw new ProviderUnavailableError('Claude Code CLI not installed');

    const args = ['-p'];
    if (this.model) args.push('--model', this.model);

    const child = spawn(bin, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: cleanClaudeEnv(),
    });

    child.stdin.end(prompt);

    return new Promise((resolve, reject) => {
      let settled = false;
      let stderrBuf = '';

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGTERM');
        reject(
          new ProviderUnavailableError(`Claude CLI timed out after ${this.timeoutMs / 1000}s`),
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
        reject(new ProviderUnavailableError(`Claude CLI spawn failed: ${err.message}`));
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
          reject(new ProviderAuthError(`Claude CLI auth failed: ${detail}`));
        } else if (lower.includes('usage') || lower.includes('rate limit')) {
          reject(new ProviderRateLimitError(`Claude CLI rate-limited: ${detail}`));
        } else {
          const base = signal ? `killed (${signal})` : `exited ${code}`;
          reject(new Error(`Claude CLI ${base}: ${detail}`));
        }
      });
    });
  }
}
