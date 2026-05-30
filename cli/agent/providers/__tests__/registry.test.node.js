import { describe, it, expect } from 'vitest';
import { PROVIDER_REGISTRY, getProviderClass, configFor } from '../registry.js';

describe('PROVIDER_REGISTRY', () => {
  it('contains every provider the roadmap promises', () => {
    expect(PROVIDER_REGISTRY).toHaveProperty('ollama');
    expect(PROVIDER_REGISTRY).toHaveProperty('claude-cli');
    expect(PROVIDER_REGISTRY).toHaveProperty('cursor');
    expect(PROVIDER_REGISTRY).toHaveProperty('openai');
    expect(PROVIDER_REGISTRY).toHaveProperty('cyrex');
  });
});

describe('getProviderClass', () => {
  it('returns the class for a known provider', () => {
    expect(getProviderClass('ollama')).toBe(PROVIDER_REGISTRY.ollama);
  });

  it('returns null for an unknown provider name', () => {
    expect(getProviderClass('nope')).toBe(null);
  });
});

describe('configFor', () => {
  it('maps ollama options from CLI config', () => {
    expect(configFor('ollama', { ollamaUrl: 'http://x', ollamaModel: 'm' })).toEqual({
      baseUrl: 'http://x',
      model: 'm',
    });
  });

  it('maps claude-cli options from CLI config', () => {
    expect(
      configFor('claude-cli', { claudeCliPath: '/bin/c', claudeCliModel: 'sonnet' })
    ).toEqual({ binPath: '/bin/c', model: 'sonnet' });
  });

  it('maps cursor options from CLI config', () => {
    expect(
      configFor('cursor', { cursorPath: '/bin/a', cursorModel: 'auto', cursorApiKey: 'k' })
    ).toEqual({ binPath: '/bin/a', model: 'auto', apiKey: 'k' });
  });

  it('maps openai options from CLI config', () => {
    expect(
      configFor('openai', {
        openaiApiKey: 'sk',
        openaiBaseUrl: 'https://b',
        openaiModel: 'gpt-4o-mini',
      })
    ).toEqual({ apiKey: 'sk', baseUrl: 'https://b', model: 'gpt-4o-mini' });
  });

  it('maps cyrex options from CLI config', () => {
    expect(configFor('cyrex', { aiServiceUrl: 'http://localhost:8000' })).toEqual({
      baseUrl: 'http://localhost:8000',
    });
  });

  it('returns an empty object for unknown providers', () => {
    expect(configFor('???', { foo: 'bar' })).toEqual({});
  });
});
