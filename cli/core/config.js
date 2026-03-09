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

export const DEFAULT_CONFIG = {
  provider: 'cyrex', // 'openai' | 'cyrex' | 'ollama'
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  aiServiceUrl: DEFAULT_AI_SERVICE,
  ollamaUrl: process.env.OLLAMA_HOST || DEFAULT_OLLAMA,
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2'
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
  return { ...DEFAULT_CONFIG, ...fileConfig };
}
