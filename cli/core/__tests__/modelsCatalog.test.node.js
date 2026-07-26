import { describe, it, expect } from 'vitest';
import { categorizeModel, setupTier, rankOllamaCatalog, OLLAMA_CATALOG } from '../ollamaCatalog.js';
import { getCloudCatalog, listCloudPlanNames } from '../cloudModels.js';

describe('ollamaCatalog (ported from cyrex)', () => {
  it('includes mistral:7b and gemma2:9b from the cyrex MODEL_LIST', () => {
    const names = OLLAMA_CATALOG.map((m) => m.name);
    expect(names).toContain('mistral:7b');
    expect(names).toContain('gemma2:9b');
    expect(OLLAMA_CATALOG.length).toBeGreaterThan(50);
  });

  it('setupTier treats high VRAM as setup5', () => {
    expect(setupTier(16, 16)).toBe('setup5');
    expect(setupTier(32, 8)).toBe('setup3');
  });

  it('recommends small models on modest hardware', () => {
    expect(categorizeModel('llama3.2:1b', 16, 8)).toBe('recommended');
    expect(categorizeModel('mistral:7b', 16, 8)).toBe('recommended');
  });

  it('rejects 70B without huge VRAM', () => {
    expect(categorizeModel('llama3.1:70b', 64, 16)).toBe('no');
    expect(categorizeModel('llama3.1:70b', 64, 48)).toBe('marginal');
  });

  it('rankOllamaCatalog marks installed models', () => {
    const ranked = rankOllamaCatalog(['gemma2:9b'], { ramGb: 32, vramGb: 16 });
    const hit = ranked.groups.recommended.find((m) => m.name === 'gemma2:9b')
      || ranked.groups.usable.find((m) => m.name === 'gemma2:9b');
    expect(hit?.installed).toBe(true);
  });
});

describe('cloudModels', () => {
  it('returns openai tier1 models by default', () => {
    const cat = getCloudCatalog('openai', {});
    expect(cat.plan).toBe('tier1');
    expect(cat.models.map((m) => m.id)).toContain('gpt-4o');
  });

  it('honors openaiPlan free', () => {
    const cat = getCloudCatalog('openai', { openaiPlan: 'free' });
    expect(cat.plan).toBe('free');
    expect(cat.models.every((m) => m.id !== 'o3')).toBe(true);
  });

  it('lists claude-cli / cursor plan names', () => {
    expect(listCloudPlanNames('claude-cli')).toContain('pro');
    expect(listCloudPlanNames('cursor')).toContain('ultra');
  });
});
