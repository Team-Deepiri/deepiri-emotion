import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEventBus, EVENTS } from '../../core/eventBus.js';
import { handleConnectCommand, BYOK_PROVIDERS } from '../connectCommand.js';

describe('/connect', () => {
  let bus;
  let tokens;
  let config;

  beforeEach(() => {
    bus = createEventBus();
    tokens = [];
    bus.on(EVENTS.LLM_TOKEN, ({ token }) => tokens.push(token));
    config = { providerChain: ['ollama'] };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores non-matching text', async () => {
    expect(await handleConnectCommand('hello', { bus, config })).toBe(false);
  });

  it('/connect opens the interactive picker (no-TTY cancels cleanly)', async () => {
    expect(await handleConnectCommand('/connect', { bus, config })).toBe(true);
  });

  it('/connect <provider> opens that provider directly (no-TTY cancels cleanly)', async () => {
    expect(await handleConnectCommand('/connect anthropic', { bus, config })).toBe(true);
  });

  it('/connect <unknown> reports an error without throwing', async () => {
    const handled = await handleConnectCommand('/connect nope', { bus, config });
    expect(handled).toBe(true);
    expect(tokens.join('')).toMatch(/Unknown provider "nope"/);
  });

  it('covers openai, anthropic, gemini, and openrouter', () => {
    expect(Object.keys(BYOK_PROVIDERS).sort()).toEqual(['anthropic', 'gemini', 'openai', 'openrouter']);
  });
});
