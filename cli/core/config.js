/**
 * CLI config: env vars + optional config file.
 * Precedence: env > config file > defaults.
 */
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const DEFAULT_AI_SERVICE = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const DEFAULT_OLLAMA = 'http://localhost:11434';

export const DEFAULT_PROVIDER_CHAIN = ['ollama', 'claude-cli', 'cursor', 'openai', 'cyrex'];

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
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
  claudeCliPath: process.env.CLAUDE_CLI_PATH || undefined,
  claudeCliModel: process.env.CLAUDE_CLI_MODEL || undefined,
  cursorPath: process.env.CURSOR_PATH || undefined,
  cursorModel: process.env.CURSOR_MODEL || undefined,
  cursorApiKey: process.env.CURSOR_API_KEY || process.env.CURSOR_AUTH_TOKEN || ''
};

/**
 * Load config from optional file then merge with env/defaults.
 * Files checked: .emotion-cli.json (cwd), ~/.config/deepiri-emotion/cli.json
 */
export async function loadConfig() {
  let fileConfig = {};
  const candidates = [
    join(process.cwd(), '.emotion-cli.json'),
    join(homedir(), '.config', 'deepiri-emotion', 'cli.json')
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const raw = await readFile(p, 'utf-8');
        fileConfig = { ...fileConfig, ...JSON.parse(raw) };
      } catch {
        // ignore invalid json
      }
      break;
    }
  }
  const merged = { ...DEFAULT_CONFIG, ...fileConfig };
  // Legacy: if user set `provider` but not `providerChain`, honor it as a single-entry chain.
  if (merged.provider && !fileConfig.providerChain) {
    merged.providerChain = [merged.provider];
  }
  return merged;
}
