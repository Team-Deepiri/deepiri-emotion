/**
 * CLI config: env vars + optional config file.
 * Precedence: env > config file > defaults.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const DEFAULT_AI_SERVICE = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const DEFAULT_OLLAMA = 'http://localhost:11434';

export const DEFAULT_PROVIDER_CHAIN = ['ollama', 'claude-cli', 'cursor', 'openai', 'cyrex'];

export function userConfigPath() {
  return join(homedir(), '.config', 'deepiri-emotion', 'cli.json');
}

export function projectConfigPath(cwd = process.cwd()) {
  return join(cwd, '.emotion-cli.json');
}

export const DEFAULT_CONFIG = {
  // Legacy single-provider override. If set, translates to a one-entry chain.
  provider: null,
  // The router walks this chain in order; first one that's available + authed + works wins.
  providerChain: DEFAULT_PROVIDER_CHAIN,
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  aiServiceUrl: DEFAULT_AI_SERVICE,
  ollamaUrl: process.env.OLLAMA_HOST || DEFAULT_OLLAMA,
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2', // preferred; Ollama auto-picks an installed model if missing
  // Floor for num_ctx regardless of prompt size — raise this on hardware that can
  // hold more than the smallest sufficient ladder rung (see chooseNumCtx in ollama.js).
  ollamaMinNumCtx: Number(process.env.OLLAMA_MIN_NUM_CTX) || null,
  // Cloud plans — null means "not chosen yet" (first-run / /account will ask).
  // Env still wins when set.
  openaiPlan: process.env.OPENAI_PLAN || null,
  anthropicPlan: process.env.ANTHROPIC_PLAN || process.env.CLAUDE_PLAN || null,
  cursorPlan: process.env.CURSOR_PLAN || null,
  onboardingComplete: false,
  // Agent loop budgets — override via env or .emotion-cli.json
  maxSteps: Number(process.env.AGENT_MAX_STEPS) || 5,
  maxToolCalls: Number(process.env.AGENT_MAX_TOOL_CALLS) || 8,
  agentTimeoutMs: Number(process.env.AGENT_TIMEOUT_MS) || 60_000,
  // Voice-of-reason supervisor — set SUPERVISOR_ENABLED=false or supervisorEnabled:false to disable
  supervisorEnabled: process.env.SUPERVISOR_ENABLED !== 'false',
  claudeCliPath: process.env.CLAUDE_CLI_PATH || undefined,
  claudeCliModel: process.env.CLAUDE_CLI_MODEL || undefined,
  cursorPath: process.env.CURSOR_PATH || undefined,
  cursorModel: process.env.CURSOR_MODEL || undefined,
  cursorApiKey: process.env.CURSOR_API_KEY || process.env.CURSOR_AUTH_TOKEN || '',
  // Native API keys for delegation targets (parallel fan-out to other providers).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiBaseUrl: process.env.GEMINI_BASE_URL || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3-flash',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || '',
  openrouterModel: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  // Providers a delegate task may target, checked against KNOWN_TOOLS' delegate
  // arg validation before any sub-agent is spawned.
  delegateProviders: ['ollama', 'anthropic', 'openai', 'gemini', 'openrouter', 'claude-cli', 'cursor', 'cyrex'],
};

/**
 * Load config from optional file then merge with env/defaults.
 * Files checked: .emotion-cli.json (cwd), ~/.config/deepiri-emotion/cli.json
 * Both are merged when present (project overrides user for overlapping keys).
 */
export async function loadConfig() {
  let userConfig = {};
  let projectConfig = {};
  const userPath = userConfigPath();
  const projectPath = projectConfigPath();

  if (existsSync(userPath)) {
    try {
      userConfig = JSON.parse(await readFile(userPath, 'utf-8'));
    } catch {
      userConfig = {};
    }
  }
  if (existsSync(projectPath)) {
    try {
      projectConfig = JSON.parse(await readFile(projectPath, 'utf-8'));
    } catch {
      projectConfig = {};
    }
  }

  const fileConfig = { ...userConfig, ...projectConfig };
  const merged = { ...DEFAULT_CONFIG, ...fileConfig };

  // Env always wins for secrets / explicit overrides when set.
  if (process.env.OPENAI_API_KEY) merged.openaiApiKey = process.env.OPENAI_API_KEY;
  if (process.env.OPENAI_PLAN) merged.openaiPlan = process.env.OPENAI_PLAN;
  if (process.env.ANTHROPIC_PLAN || process.env.CLAUDE_PLAN) {
    merged.anthropicPlan = process.env.ANTHROPIC_PLAN || process.env.CLAUDE_PLAN;
  }
  if (process.env.CURSOR_PLAN) merged.cursorPlan = process.env.CURSOR_PLAN;
  if (process.env.OLLAMA_HOST) merged.ollamaUrl = process.env.OLLAMA_HOST;
  if (process.env.OLLAMA_MODEL) merged.ollamaModel = process.env.OLLAMA_MODEL;

  // Legacy: if user set `provider` but not `providerChain`, honor it as a single-entry chain.
  if (merged.provider && !fileConfig.providerChain) {
    merged.providerChain = [merged.provider];
  }

  merged._configSources = {
    userPath: existsSync(userPath) ? userPath : null,
    projectPath: existsSync(projectPath) ? projectPath : null,
  };
  return merged;
}

/**
 * Merge keys into ~/.config/deepiri-emotion/cli.json and update `config` in memory.
 * @param {Record<string, unknown>} config
 * @param {Record<string, unknown>} partial
 */
export async function saveUserConfig(config, partial) {
  const path = userConfigPath();
  let existing = {};
  if (existsSync(path)) {
    try {
      existing = JSON.parse(await readFile(path, 'utf-8'));
    } catch {
      existing = {};
    }
  }
  const next = { ...existing, ...partial };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  Object.assign(config, partial);
  return path;
}

/**
 * Merge keys into cwd `.emotion-cli.json` (project-local prefs like model).
 */
export async function saveProjectConfig(config, partial, cwd = process.cwd()) {
  const path = projectConfigPath(cwd);
  let existing = {};
  if (existsSync(path)) {
    try {
      existing = JSON.parse(await readFile(path, 'utf-8'));
    } catch {
      existing = {};
    }
  }
  const next = { ...existing, ...partial };
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  Object.assign(config, partial);
  return path;
}

/** True when we should run the first-run account/plan wizard. */
export function needsOnboarding(config = {}) {
  if (config.onboardingComplete) return false;
  // Existing installs (any config file) — don't nag; use /account to link later.
  if (config._configSources?.userPath || config._configSources?.projectPath) return false;
  return true;
}
