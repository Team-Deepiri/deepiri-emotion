import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Provider, ProviderUnavailableError } from '../base.js';
import { PROVIDER_REGISTRY } from '../registry.js';
import { streamWithFallback, DEFAULT_CHAIN } from '../router.js';

function makeProvider({ available = true, authed = true, behavior = 'success' } = {}) {
  return class TestProvider extends Provider {
    static async isAvailable() {
      return available;
    }
    static async isAuthenticated() {
      return authed;
    }
    async stream(bus) {
      if (behavior === 'success') {
        bus.emit('LLM_TOKEN', { token: 'ok' });
        return;
      }
      if (behavior === 'fallthrough') throw new ProviderUnavailableError('temp down');
      if (behavior === 'fatal') throw new Error('fatal error');
      throw new Error(`unknown behavior: ${behavior}`);
    }
  };
}

const TEST_NAMES = ['test-a', 'test-b', 'test-c'];
const saved = {};

beforeEach(() => {
  for (const name of TEST_NAMES) saved[name] = PROVIDER_REGISTRY[name];
});

afterEach(() => {
  for (const name of TEST_NAMES) {
    if (saved[name] === undefined) delete PROVIDER_REGISTRY[name];
    else PROVIDER_REGISTRY[name] = saved[name];
    delete saved[name];
  }
});

describe('streamWithFallback', () => {
  it('returns the first available + authed provider that succeeds', async () => {
    PROVIDER_REGISTRY['test-a'] = makeProvider({ behavior: 'success' });
    const winner = await streamWithFallback(new EventEmitter(), 'hi', {}, {
      providerChain: ['test-a'],
    });
    expect(winner).toBe('test-a');
  });

  it('skips an unavailable provider and uses the next', async () => {
    PROVIDER_REGISTRY['test-a'] = makeProvider({ available: false });
    PROVIDER_REGISTRY['test-b'] = makeProvider({ behavior: 'success' });
    const winner = await streamWithFallback(new EventEmitter(), 'hi', {}, {
      providerChain: ['test-a', 'test-b'],
    });
    expect(winner).toBe('test-b');
  });

  it('skips an unauthenticated provider and uses the next', async () => {
    PROVIDER_REGISTRY['test-a'] = makeProvider({ authed: false });
    PROVIDER_REGISTRY['test-b'] = makeProvider({ behavior: 'success' });
    const winner = await streamWithFallback(new EventEmitter(), 'hi', {}, {
      providerChain: ['test-a', 'test-b'],
    });
    expect(winner).toBe('test-b');
  });

  it('falls through on a fall-through error and uses the next', async () => {
    PROVIDER_REGISTRY['test-a'] = makeProvider({ behavior: 'fallthrough' });
    PROVIDER_REGISTRY['test-b'] = makeProvider({ behavior: 'success' });
    const winner = await streamWithFallback(new EventEmitter(), 'hi', {}, {
      providerChain: ['test-a', 'test-b'],
    });
    expect(winner).toBe('test-b');
  });

  it('surfaces non-fall-through errors instead of trying the next', async () => {
    PROVIDER_REGISTRY['test-a'] = makeProvider({ behavior: 'fatal' });
    PROVIDER_REGISTRY['test-b'] = makeProvider({ behavior: 'success' });
    await expect(
      streamWithFallback(new EventEmitter(), 'hi', {}, {
        providerChain: ['test-a', 'test-b'],
      })
    ).rejects.toThrow(/fatal error/);
  });

  it('skips an unknown provider name without aborting the chain', async () => {
    PROVIDER_REGISTRY['test-a'] = makeProvider({ behavior: 'success' });
    const winner = await streamWithFallback(new EventEmitter(), 'hi', {}, {
      providerChain: ['definitely-not-real', 'test-a'],
    });
    expect(winner).toBe('test-a');
  });

  it('throws providerChainExhausted when nothing in chain works', async () => {
    PROVIDER_REGISTRY['test-a'] = makeProvider({ available: false });
    PROVIDER_REGISTRY['test-b'] = makeProvider({ authed: false });
    await expect(
      streamWithFallback(new EventEmitter(), 'hi', {}, {
        providerChain: ['test-a', 'test-b'],
      })
    ).rejects.toMatchObject({ providerChainExhausted: true });
  });

  it('falls back to DEFAULT_CHAIN when no providerChain is set', () => {
    expect(Array.isArray(DEFAULT_CHAIN)).toBe(true);
    expect(DEFAULT_CHAIN[0]).toBe('ollama');
    expect(DEFAULT_CHAIN).toContain('claude-cli');
    expect(DEFAULT_CHAIN).toContain('cursor');
  });
});
