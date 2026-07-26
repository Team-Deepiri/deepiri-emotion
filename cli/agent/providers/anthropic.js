/**
 * Native Anthropic Messages API provider (SSE streaming). Distinct from
 * claude-cli.js, which shells out to the local `claude` binary — this one
 * hits api.anthropic.com directly with an API key, for contexts (like
 * parallel delegation) where spawning a subprocess per call isn't practical.
 */
import { EVENTS } from '../../core/eventBus.js';
import {
  Provider,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from './base.js';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-sonnet-5';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicProvider extends Provider {
  static providerName = 'anthropic';

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

    const attachments = Array.isArray(opts.attachments) ? opts.attachments : [];
    const content = attachments.length > 0
      ? [
          { type: 'text', text: prompt },
          ...attachments.map((a) => ({
            type: 'image',
            source: { type: 'base64', media_type: a.mime, data: a.base64 },
          })),
        ]
      : prompt;

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
        stream: true,
      }),
      signal: opts.signal,
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
        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            const chunk = json.delta.text;
            if (chunk) {
              if (!opts.silent) bus.emit(EVENTS.LLM_TOKEN, { token: chunk });
              if (typeof opts.onToken === 'function') opts.onToken(chunk);
            }
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  }
}
