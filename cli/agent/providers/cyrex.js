/**
 * Cyrex provider — Deepiri's existing backend.
 * Single POST to /agent/chat, then emit the reply as tokens for TUI effect.
 * Kept as the tail of the default chain so existing users see no regression.
 */
import { EVENTS } from '../../core/eventBus.js';
import { Provider, ProviderUnavailableError } from './base.js';

const DEFAULT_BASE_URL = 'http://localhost:8000';
const SIMULATED_TOKEN_DELAY_MS = 20;

function trimSlash(url) {
  return (url || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export class CyrexProvider extends Provider {
  static providerName = 'cyrex';

  constructor({ baseUrl } = {}) {
    super();
    this.baseUrl = trimSlash(baseUrl);
  }

  async stream(bus, prompt, opts = {}) {
    let res;
    try {
      res = await fetch(`${this.baseUrl}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context: '', file_content: '', selection: null }),
      });
    } catch (err) {
      throw new ProviderUnavailableError(`Cyrex unreachable: ${err.message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status >= 500) throw new ProviderUnavailableError(`Cyrex ${res.status}: ${body}`);
      throw new Error(`Cyrex HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();
    const reply =
      data?.reply ?? data?.content ?? data?.message ?? (typeof data === 'string' ? data : '');

    for (const char of String(reply)) {
      if (!opts.silent) bus.emit(EVENTS.LLM_TOKEN, { token: char });
      if (typeof opts.onToken === 'function') opts.onToken(char);
      await new Promise((r) => setTimeout(r, SIMULATED_TOKEN_DELAY_MS));
    }
  }
}
