import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { OpenAICompatProvider } from '../openai-compat.js';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderUnavailableError,
} from '../base.js';

let originalFetch;

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

function makeStreamResponse(deltas) {
  const encoder = new TextEncoder();
  const lines = deltas.map(
    (d) => `data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n`
  );
  lines.push('data: [DONE]\n');
  let idx = 0;
  const chunks = lines.map((l) => encoder.encode(l));
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        async read() {
          if (idx >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: chunks[idx++] };
        },
      }),
    },
  };
}

describe('OpenAICompatProvider', () => {
  it('hits the custom baseUrl when one is provided', async () => {
    let calledUrl = null;
    global.fetch = async (url) => {
      calledUrl = url;
      return makeStreamResponse(['hi']);
    };
    const provider = new OpenAICompatProvider({
      apiKey: 'sk-test',
      baseUrl: 'https://custom.example.com/v1',
    });
    await provider.stream(new EventEmitter(), 'hello');
    expect(calledUrl).toBe('https://custom.example.com/v1/chat/completions');
  });

  it('emits streamed tokens on the bus', async () => {
    global.fetch = async () => makeStreamResponse(['hel', 'lo']);
    const bus = new EventEmitter();
    const tokens = [];
    bus.on('LLM_TOKEN', ({ token }) => tokens.push(token));
    const provider = new OpenAICompatProvider({ apiKey: 'sk' });
    await provider.stream(bus, 'hi');
    expect(tokens.join('')).toBe('hello');
  });

  it('honors opts.silent and opts.onToken', async () => {
    global.fetch = async () => makeStreamResponse(['x']);
    const bus = new EventEmitter();
    const seenOnBus = [];
    bus.on('LLM_TOKEN', ({ token }) => seenOnBus.push(token));
    let seenInCallback = '';
    const provider = new OpenAICompatProvider({ apiKey: 'sk' });
    await provider.stream(bus, 'hi', {
      silent: true,
      onToken: (t) => (seenInCallback += t),
    });
    expect(seenOnBus).toEqual([]);
    expect(seenInCallback).toBe('x');
  });

  it('throws ProviderAuthError on 401', async () => {
    global.fetch = async () => ({ ok: false, status: 401, text: async () => 'invalid key' });
    const provider = new OpenAICompatProvider({ apiKey: 'sk-bad' });
    await expect(provider.stream(new EventEmitter(), 'hi')).rejects.toBeInstanceOf(ProviderAuthError);
  });

  it('throws ProviderRateLimitError on 429', async () => {
    global.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited' });
    const provider = new OpenAICompatProvider({ apiKey: 'sk' });
    await expect(provider.stream(new EventEmitter(), 'hi')).rejects.toBeInstanceOf(ProviderRateLimitError);
  });

  it('throws ProviderUnavailableError on 5xx', async () => {
    global.fetch = async () => ({ ok: false, status: 503, text: async () => 'down' });
    const provider = new OpenAICompatProvider({ apiKey: 'sk' });
    await expect(provider.stream(new EventEmitter(), 'hi')).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('throws ProviderAuthError when no apiKey is configured', async () => {
    const provider = new OpenAICompatProvider({});
    await expect(provider.stream(new EventEmitter(), 'hi')).rejects.toBeInstanceOf(ProviderAuthError);
  });

  it('isAuthenticated only returns true when apiKey is set', async () => {
    expect(await OpenAICompatProvider.isAuthenticated({ apiKey: 'sk' })).toBe(true);
    expect(await OpenAICompatProvider.isAuthenticated({})).toBe(false);
  });
});
