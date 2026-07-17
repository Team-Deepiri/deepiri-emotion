import { describe, it, expect } from 'vitest';
import { getErrorHint } from '../errorHints.js';

describe('getErrorHint', () => {
  it('returns null for empty / missing messages', () => {
    expect(getErrorHint('')).toBeNull();
    expect(getErrorHint(null)).toBeNull();
    expect(getErrorHint(undefined)).toBeNull();
  });

  it('returns null when no pattern matches', () => {
    expect(getErrorHint('some entirely unrelated failure')).toBeNull();
  });

  it('matches provider-chain exhaustion', () => {
    expect(getErrorHint('No provider in chain could serve the request.')).toMatch(/No AI provider/i);
    expect(getErrorHint('no usable ai provider')).toMatch(/No AI provider/i);
  });

  it('matches network errors', () => {
    for (const msg of ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'network unreachable']) {
      expect(getErrorHint(msg)).toMatch(/Network issue/i);
    }
  });

  it('matches auth failures', () => {
    for (const msg of ['401', 'Unauthorized', 'invalid api key', 'not authenticated']) {
      expect(getErrorHint(msg)).toMatch(/Authentication failed/i);
    }
  });

  it('matches rate limiting', () => {
    expect(getErrorHint('rate limit exceeded')).toMatch(/Rate limited/i);
    expect(getErrorHint('429 Too Many Requests')).toMatch(/Rate limited/i);
  });

  it('matches missing ollama CLI', () => {
    expect(getErrorHint('ENOENT spawn ollama')).toMatch(/Ollama CLI not found/i);
    expect(getErrorHint('command not found: ollama')).toMatch(/Ollama CLI not found/i);
  });

  it('is case-insensitive', () => {
    expect(getErrorHint('UNAUTHORIZED')).toMatch(/Authentication failed/i);
  });
});
