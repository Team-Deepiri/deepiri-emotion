/**
 * /connect — BYOK setup for native API-key cloud providers.
 * Complements /account (subscription-style linking for openai/claude-cli/cursor/cyrex)
 * with a dedicated flow for providers that are pure "paste an API key" — including
 * anthropic, gemini, and openrouter, which /account has no entry for at all.
 */
import { EVENTS } from '../core/eventBus.js';
import { saveUserConfig } from '../core/config.js';
import { requestSelect, requestTextInput, openBrowser } from '../core/select.js';

function say(bus, token) {
  bus.emit(EVENTS.LLM_TOKEN, { token });
}

function done(bus) {
  bus.emit(EVENTS.LLM_DONE, {});
}

export const BYOK_PROVIDERS = {
  openai: {
    label: 'OpenAI',
    keyField: 'openaiApiKey',
    modelField: 'openaiModel',
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    label: 'Anthropic (native API)',
    keyField: 'anthropicApiKey',
    modelField: 'anthropicModel',
    keysUrl: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    label: 'Google Gemini',
    keyField: 'geminiApiKey',
    modelField: 'geminiModel',
    keysUrl: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    label: 'OpenRouter',
    keyField: 'openrouterApiKey',
    modelField: 'openrouterModel',
    keysUrl: 'https://openrouter.ai/keys',
  },
};

function statusFor(config, meta) {
  return config[meta.keyField] ? '✓ key saved' : 'not connected';
}

async function activateBYOK(bus, config, name) {
  const rest = Array.isArray(config.providerChain) ? config.providerChain.filter((p) => p !== name) : [];
  const providerChain = [name, ...rest];
  config.provider = name;
  config.providerChain = providerChain;
  config.activeProvider = name;
  await saveUserConfig(config, { provider: name, providerChain }).catch(() => {});
  const meta = BYOK_PROVIDERS[name];
  bus.emit(EVENTS.PROVIDER_SELECTED, { provider: name });
  bus.emit(EVENTS.PROVIDER_RESOLVED, { provider: name, model: config[meta.modelField] || null });
  say(bus, `Provider → ${name} (moved to front of fallback chain)`);
}

async function connectProvider(bus, config, name) {
  const meta = BYOK_PROVIDERS[name];
  if (!meta) {
    say(bus, `Unknown provider "${name}". Choose: ${Object.keys(BYOK_PROVIDERS).join(', ')}`);
    return;
  }
  while (true) {
    const hasKey = Boolean(config[meta.keyField]);
    const choice = await requestSelect(bus, {
      title: `Connect ${meta.label}`,
      subtitle: hasKey ? '✓ API key saved' : 'No API key saved yet',
      items: [
        { id: 'open', label: 'Open API keys page', description: meta.keysUrl },
        {
          id: 'paste',
          label: hasKey ? 'Replace API key' : 'Paste API key',
          description: 'saved to ~/.config/deepiri-emotion/cli.json',
        },
        hasKey
          ? { id: 'activate', label: 'Use as active provider now', description: 'moves to front of provider chain' }
          : null,
        { id: 'done', label: 'Done' },
      ].filter(Boolean),
    });
    if (!choice || choice === 'done') return;

    if (choice === 'open') {
      const ok = await openBrowser(meta.keysUrl);
      say(bus, ok ? `Opened ${meta.keysUrl}` : `Could not open browser. Visit:\n${meta.keysUrl}`);
      continue;
    }
    if (choice === 'paste') {
      const value = await requestTextInput(bus, {
        title: `Paste ${meta.label} API key`,
        placeholder: 'sk-… · Enter to save',
        secret: true,
      });
      if (value) {
        await saveUserConfig(config, { [meta.keyField]: value.trim() });
        say(bus, `Saved ${meta.keyField}.`);
      }
      continue;
    }
    if (choice === 'activate') {
      await activateBYOK(bus, config, name);
      return;
    }
  }
}

export async function runConnectInteractive(bus, config) {
  const choice = await requestSelect(bus, {
    title: 'Connect a provider (BYOK)',
    subtitle: 'Bring your own API key for a cloud provider',
    items: [
      ...Object.entries(BYOK_PROVIDERS).map(([id, meta]) => ({
        id,
        label: meta.label,
        description: statusFor(config, meta),
      })),
      { id: 'done', label: 'Done' },
    ],
  });
  if (!choice || choice === 'done') return;
  await connectProvider(bus, config, choice);
}

export async function handleConnectCommand(text, { bus, config }) {
  const match = text.trim().match(/^\/connect(?:\s+(\S+))?$/i);
  if (!match) return false;
  try {
    const name = match[1]?.toLowerCase();
    if (!name) {
      await runConnectInteractive(bus, config);
    } else if (!BYOK_PROVIDERS[name]) {
      say(bus, `Unknown provider "${name}". Choose: ${Object.keys(BYOK_PROVIDERS).join(', ')}`);
    } else {
      await connectProvider(bus, config, name);
    }
    done(bus);
    return true;
  } catch (err) {
    bus.emit(EVENTS.AGENT_ERROR, { message: err.message || String(err) });
    done(bus);
    return true;
  }
}
