/**
 * Ollama provider — local model server, NDJSON streaming on /api/chat.
 * First entry in the default chain because it's free and local.
 */
import { EVENTS } from '../../core/eventBus.js';
import { Provider, ProviderUnavailableError } from './base.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';
const AVAILABILITY_TIMEOUT_MS = 800;

function trimSlash(url) {
  return (url || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export class OllamaProvider extends Provider {
  static providerName = 'ollama';

  constructor({ baseUrl, model } = {}) {
    super();
    this.baseUrl = trimSlash(baseUrl);
    this.model = model || DEFAULT_MODEL;
  }

  /** Cheap probe: HEAD the root and see if Ollama answers within ~1s. */
  static async isAvailable(options = {}) {
    const base = trimSlash(options.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT_MS);
    try {
      const res = await fetch(base, { method: 'GET', signal: controller.signal });
      return res.ok || res.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async stream(bus, prompt, opts = {}) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status >= 500) throw new ProviderUnavailableError(`Ollama ${res.status}: ${body}`);
      throw new Error(`Ollama HTTP ${res.status}: ${body}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const content = json?.message?.content;
          if (content) {
            if (!opts.silent) bus.emit(EVENTS.LLM_TOKEN, { token: content });
            if (typeof opts.onToken === 'function') opts.onToken(content);
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  }
}
