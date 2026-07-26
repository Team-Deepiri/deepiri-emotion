import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EVENTS } from '../../core/eventBus.js';

const runMock = vi.fn();
let lastWorkerArgs = null;

vi.mock('../AgentWorker.js', () => ({
  AgentWorker: class {
    constructor(args) {
      lastWorkerArgs = args;
      this._args = args;
    }
    run() { return runMock(this._args); }
    cancel() {}
  },
}));

import { delegateTasks } from '../delegate.js';

/** Simulates a sub-agent emitting tokens then finishing, on its own isolated bus. */
function makeRunImpl({ tokens = ['hello'], errorMessage = null, cancelled = false } = {}) {
  return (args) => {
    const { bus, id } = args;
    for (const t of tokens) bus.emit(EVENTS.LLM_TOKEN, { workerId: id, token: t });
    if (errorMessage) bus.emit(EVENTS.AGENT_ERROR, { workerId: id, message: errorMessage });
    if (cancelled) {
      bus.emit(EVENTS.AGENT_CANCELLED, { workerId: id });
    } else {
      bus.emit(EVENTS.LLM_DONE, { workerId: id });
    }
    return Promise.resolve();
  };
}

describe('delegateTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastWorkerArgs = null;
  });

  it('returns an error entry when no targets are given', async () => {
    const result = await delegateTasks([], 'prompt', {});
    expect(result).toEqual([{ error: 'No delegation targets provided' }]);
  });

  it('runs multiple targets in parallel and collects their text', async () => {
    runMock
      .mockImplementationOnce(makeRunImpl({ tokens: ['hello'] }))
      .mockImplementationOnce(makeRunImpl({ tokens: ['world'] }));

    const results = await delegateTasks(
      [{ provider: 'ollama' }, { provider: 'anthropic' }],
      'shared prompt',
      { delegateProviders: ['ollama', 'anthropic'] },
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ provider: 'ollama', text: 'hello' });
    expect(results[1]).toMatchObject({ provider: 'anthropic', text: 'world' });
  });

  it('spawns each sub-agent in read-only mode', async () => {
    runMock.mockImplementation(makeRunImpl());
    await delegateTasks([{ provider: 'ollama' }], 'p', { delegateProviders: ['ollama'] });
    expect(lastWorkerArgs.modes.readOnly).toBe(true);
  });

  it('sets a single-provider chain and overrides the model config key', async () => {
    runMock.mockImplementation(makeRunImpl());
    await delegateTasks(
      [{ provider: 'ollama', model: 'gemma2:9b' }],
      'p',
      { delegateProviders: ['ollama'] },
    );
    expect(lastWorkerArgs.config.providerChain).toEqual(['ollama']);
    expect(lastWorkerArgs.config.ollamaModel).toBe('gemma2:9b');
  });

  it('captures an error emitted before completion', async () => {
    runMock.mockImplementation(makeRunImpl({ errorMessage: 'boom' }));
    const results = await delegateTasks([{ provider: 'ollama' }], 'p', { delegateProviders: ['ollama'] });
    expect(results[0].error).toBe('boom');
  });

  it('captures a run() rejection', async () => {
    runMock.mockImplementation(() => Promise.reject(new Error('crashed')));
    const results = await delegateTasks([{ provider: 'ollama' }], 'p', { delegateProviders: ['ollama'] });
    expect(results[0].error).toBe('crashed');
  });

  it('reports cancellation as an error', async () => {
    runMock.mockImplementation(makeRunImpl({ cancelled: true }));
    const results = await delegateTasks([{ provider: 'ollama' }], 'p', { delegateProviders: ['ollama'] });
    expect(results[0].error).toMatch(/Timed out or cancelled/);
  });

  it('rejects providers not in the delegateProviders allowlist', async () => {
    const results = await delegateTasks([{ provider: 'blocked' }], 'p', { delegateProviders: ['other'] });
    expect(results[0].error).toMatch(/not enabled for delegation/);
    expect(runMock).not.toHaveBeenCalled();
  });

  it('caps the number of parallel targets', async () => {
    runMock.mockImplementation(makeRunImpl());
    const targets = Array.from({ length: 8 }, (_, i) => ({ provider: 'ollama', model: `m${i}` }));
    const results = await delegateTasks(targets, 'p', { delegateProviders: ['ollama'] });
    expect(results).toHaveLength(5);
  });

  it('lets a per-target prompt override the shared default prompt', async () => {
    runMock.mockImplementation(makeRunImpl());
    await delegateTasks(
      [{ provider: 'ollama', prompt: 'custom prompt' }],
      'default prompt',
      { delegateProviders: ['ollama'] },
    );
    expect(lastWorkerArgs.task).toBe('custom prompt');
  });
});
