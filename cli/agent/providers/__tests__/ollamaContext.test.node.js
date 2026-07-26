import { describe, it, expect } from 'vitest';
import { chooseNumCtx, modelMatches } from '../ollama.js';
import { estimateTokens, fitTextToTokenBudget, formatTokenCount } from '../../../core/tokens.js';

describe('chooseNumCtx', () => {
  it('honors an explicit num_ctx', () => {
    expect(chooseNumCtx(50_000, 8192)).toBe(8192);
  });

  it('picks the smallest ladder step that fits prompt + reserve', () => {
    // ~5054 prompt tokens (the real deepseek failure) needs > 4096+reserve
    expect(chooseNumCtx(5054, undefined)).toBe(8192);
    expect(chooseNumCtx(100, undefined)).toBe(4096);
    expect(chooseNumCtx(20_000, undefined)).toBe(24576);
  });
});

describe('token helpers', () => {
  it('formats counts', () => {
    expect(formatTokenCount(76)).toBe('76');
    expect(formatTokenCount(5054)).toBe('5.1k');
  });

  it('fits text into a token budget', () => {
    const long = 'a'.repeat(10_000);
    const fitted = fitTextToTokenBudget(long, 100);
    expect(estimateTokens(fitted)).toBeLessThanOrEqual(110);
    expect(fitted).toContain('truncated');
  });
});

describe('modelMatches still works after ollama rewrite', () => {
  it('matches tagged installs', () => {
    expect(modelMatches('deepseek-r1:32b', 'deepseek-r1')).toBe(true);
  });
});
