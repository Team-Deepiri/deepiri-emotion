/**
 * Provider registry — name → class + per-provider config mapping.
 */
import { OllamaProvider } from './ollama.js';
import { ClaudeCliProvider } from './claude-cli.js';
import { CursorProvider } from './cursor.js';
import { OpenAICompatProvider } from './openai-compat.js';
import { CyrexProvider } from './cyrex.js';

export const PROVIDER_REGISTRY = {
  ollama: OllamaProvider,
  'claude-cli': ClaudeCliProvider,
  cursor: CursorProvider,
  openai: OpenAICompatProvider,
  cyrex: CyrexProvider,
};

export function getProviderClass(name) {
  return PROVIDER_REGISTRY[name] || null;
}

/** Map the CLI config object to the options each provider's constructor wants. */
export function configFor(name, config = {}) {
  switch (name) {
    case 'ollama':
      return { baseUrl: config.ollamaUrl, model: config.ollamaModel };
    case 'claude-cli':
      return { binPath: config.claudeCliPath, model: config.claudeCliModel };
    case 'cursor':
      return {
        binPath: config.cursorPath,
        model: config.cursorModel,
        apiKey: config.cursorApiKey,
      };
    case 'openai':
      return {
        apiKey: config.openaiApiKey,
        baseUrl: config.openaiBaseUrl,
        model: config.openaiModel,
      };
    case 'cyrex':
      return { baseUrl: config.aiServiceUrl };
    default:
      return {};
  }
}
