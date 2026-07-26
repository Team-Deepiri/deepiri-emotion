import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEventBus, EVENTS } from '../../core/eventBus.js';
import {
  handleModelsCommand,
  handleProviderCommand,
  handleAccountCommand,
  handleStatusCommand,
} from '../modelsCommand.js';
import { requestSelect } from '../../core/select.js';

describe('slash model commands', () => {
  let bus;
  let tokens;
  let config;

  beforeEach(() => {
    bus = createEventBus();
    tokens = [];
    bus.on(EVENTS.LLM_TOKEN, ({ token }) => tokens.push(token));
    config = {
      activeProvider: 'openai',
      openaiModel: 'gpt-4o-mini',
      openaiPlan: 'tier1',
      ollamaUrl: 'http://127.0.0.1:9',
      ollamaModel: 'llama3.2',
      providerChain: ['openai'],
      workspaceDir: process.cwd(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('/models opens interactive flow (no-TTY cancels cleanly)', async () => {
    const handled = await handleModelsCommand('/models', { bus, config });
    expect(handled).toBe(true);
    // Non-TTY: select resolves null → menu exits without error.
  });

  it('/models use <name> still works non-interactively', async () => {
    const handled = await handleModelsCommand('/models use gpt-4o', { bus, config });
    expect(handled).toBe(true);
    expect(config.openaiModel).toBe('gpt-4o');
    expect(tokens.join('')).toMatch(/Active model → openai \/ gpt-4o/);
  });

  it('/provider <name> switches without menu', async () => {
    const handled = await handleProviderCommand('/provider ollama', { bus, config });
    expect(handled).toBe(true);
    expect(config.activeProvider).toBe('ollama');
    expect(tokens.join('')).toMatch(/Provider → ollama/);
  });

  it('/account is handled', async () => {
    expect(await handleAccountCommand('/account', { bus, config })).toBe(true);
  });

  it('/status prints provider and plans', async () => {
    const handled = await handleStatusCommand('/status', { bus, config });
    expect(handled).toBe(true);
    expect(tokens.join('')).toMatch(/provider: openai/);
    expect(tokens.join('')).toMatch(/openai plan: tier1/);
  });

  it('ignores non-matching text', async () => {
    expect(await handleModelsCommand('hello', { bus, config })).toBe(false);
    expect(await handleProviderCommand('/help', { bus, config })).toBe(false);
  });
});

describe('requestSelect', () => {
  it('resolves null when not a TTY', async () => {
    const bus = createEventBus();
    const id = await requestSelect(bus, {
      title: 't',
      items: [{ id: 'a', label: 'A' }],
    });
    expect(id).toBeNull();
  });
});
