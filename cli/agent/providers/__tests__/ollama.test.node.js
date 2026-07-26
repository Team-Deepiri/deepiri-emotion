import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  modelMatches,
  resolveOllamaModel,
  listOllamaModels,
} from '../ollama.js';
import { ProviderUnavailableError } from '../base.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('modelMatches', () => {
  it('matches exact names', () => {
    expect(modelMatches('llama3.2', 'llama3.2')).toBe(true);
    expect(modelMatches('phi4:14b', 'phi4:14b')).toBe(true);
  });

  it('matches base name to tagged install', () => {
    expect(modelMatches('llama3.2:latest', 'llama3.2')).toBe(true);
    expect(modelMatches('phi4:14b', 'phi4')).toBe(true);
  });

  it('rejects unrelated models', () => {
    expect(modelMatches('phi4:14b', 'llama3.2')).toBe(false);
    expect(modelMatches('gemma2:9b', 'qwen2.5')).toBe(false);
  });
});

describe('resolveOllamaModel', () => {
  it('returns the preferred model when installed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        models: [
          { name: 'phi4:14b', size: 9_000_000_000 },
          { name: 'llama3.2:latest', size: 2_000_000_000 },
        ],
      }),
    })));

    await expect(resolveOllamaModel('http://localhost:11434', 'llama3.2')).resolves.toBe('llama3.2:latest');
  });

  it('falls back to the smallest installed model when preferred is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        models: [
          { name: 'phi4:14b', size: 9_000_000_000 },
          { name: 'gemma2:9b', size: 5_000_000_000 },
          { name: 'qwen3-coder:30b', size: 18_000_000_000 },
        ],
      }),
    })));

    await expect(resolveOllamaModel('http://localhost:11434', 'llama3.2')).resolves.toBe('gemma2:9b');
  });

  it('throws ProviderUnavailableError when no models are installed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [] }),
    })));

    await expect(resolveOllamaModel('http://localhost:11434', 'llama3.2'))
      .rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('listOllamaModels', () => {
  it('returns empty list on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }));
    await expect(listOllamaModels('http://localhost:11434')).resolves.toEqual([]);
  });
});
