/**
 * Generic OpenAI-compatible provider (chat completions + SSE streaming).
 * Works for OpenAI itself and any service that implements the same wire format
 * (MiniMax, Groq, Together, etc.) — just pass a different baseUrl.
 */
import { EVENTS } from '../../core/eventBus.js';
import {
  Provider,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from './base.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

export class OpenAICompatProvider extends Provider {
  static providerName = 'openai-compat';

  constructor({ apiKey, baseUrl, model } = {}) {
    super();
    this.apiKey = apiKey || '';
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.model = model || DEFAULT_MODEL;
  }

  static async isAvailable(_options) {
    return true;
  }

  static async isAuthenticated(options = {}) {
    return Boolean(options.apiKey);
  }

  async stream(bus, prompt, opts = {}) {
    if (!this.apiKey) {
      throw new ProviderAuthError('No API key configured');
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 401) throw new ProviderAuthError(`Auth failed: ${body || 'invalid key'}`);
      if (res.status === 429) throw new ProviderRateLimitError(`Rate limited: ${body || res.status}`);
      if (res.status >= 500) throw new ProviderUnavailableError(`Upstream ${res.status}: ${body}`);
      throw new Error(`HTTP ${res.status}: ${body}`);
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
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const content = json?.choices?.[0]?.delta?.content;
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
