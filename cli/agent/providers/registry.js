/**
 * Provider registry — name → class + per-provider config mapping.
 */
import { OllamaProvider } from './ollama.js';
import { ClaudeCliProvider } from './claude-cli.js';
import { CursorProvider } from './cursor.js';
import { OpenAICompatProvider } from './openai-compat.js';
import { CyrexProvider } from './cyrex.js';
import { AnthropicProvider } from './anthropic.js';

export const PROVIDER_REGISTRY = {
  ollama: OllamaProvider,
  'claude-cli': ClaudeCliProvider,
  cursor: CursorProvider,
  openai: OpenAICompatProvider,
  cyrex: CyrexProvider,
  anthropic: AnthropicProvider,
  // Gemini and OpenRouter both speak the OpenAI chat-completions wire format —
  // reuse OpenAICompatProvider with their base URLs rather than duplicating it.
  gemini: OpenAICompatProvider,
  openrouter: OpenAICompatProvider,
};

export function getProviderClass(name) {
  return PROVIDER_REGISTRY[name] || null;
}

/** Config field each provider reads its model from — used to override per-target model for delegation. */
export const PROVIDER_MODEL_CONFIG_KEY = {
  ollama: 'ollamaModel',
  'claude-cli': 'claudeCliModel',
  cursor: 'cursorModel',
  openai: 'openaiModel',
  anthropic: 'anthropicModel',
  gemini: 'geminiModel',
  openrouter: 'openrouterModel',
};

/** Map the CLI config object to the options each provider's constructor wants. */
export function configFor(name, config = {}) {
  switch (name) {
    case 'ollama':
      return {
        baseUrl: config.ollamaUrl,
        model: config.ollamaModel,
        minNumCtx: config.ollamaMinNumCtx,
        temperature: config.ollamaTemperature,
      };
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
    case 'anthropic':
      return {
        apiKey: config.anthropicApiKey,
        baseUrl: config.anthropicBaseUrl,
        model: config.anthropicModel,
      };
    case 'gemini':
      return {
        apiKey: config.geminiApiKey,
        baseUrl: config.geminiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: config.geminiModel,
      };
    case 'openrouter':
      return {
        apiKey: config.openrouterApiKey,
        baseUrl: config.openrouterBaseUrl || 'https://openrouter.ai/api/v1',
        model: config.openrouterModel,
      };
    default:
      return {};
  }
}
