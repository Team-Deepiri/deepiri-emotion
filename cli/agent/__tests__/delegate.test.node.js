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

import { delegateTasks, planWaves, normalizeTargets } from '../delegate.js';
import { getRole } from '../roles.js';

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

  it('honors config.delegateMaxTargets when capping parallel targets', async () => {
    runMock.mockImplementation(makeRunImpl());
    const targets = Array.from({ length: 8 }, (_, i) => ({ provider: 'ollama', model: `m${i}` }));
    const results = await delegateTasks(
      targets,
      'p',
      { delegateProviders: ['ollama'], delegateMaxTargets: 3 },
    );
    expect(results).toHaveLength(3);
  });

  it('stamps an incremented delegation depth into each sub-agent config', async () => {
    runMock.mockImplementation(makeRunImpl());
    await delegateTasks([{ provider: 'ollama' }], 'p', { delegateProviders: ['ollama'] });
    expect(lastWorkerArgs.config.delegationDepth).toBe(1);
  });

  it('refuses to delegate once the depth limit is reached', async () => {
    const results = await delegateTasks(
      [{ provider: 'ollama' }],
      'p',
      { delegateProviders: ['ollama'], delegationDepth: 1 },
    );
    expect(results[0].error).toMatch(/Delegation depth limit reached/);
    expect(runMock).not.toHaveBeenCalled();
  });

  it('reports the depth limit once per target rather than silently dropping them', async () => {
    const results = await delegateTasks(
      [{ provider: 'ollama' }, { provider: 'anthropic' }],
      'p',
      { delegateProviders: ['ollama', 'anthropic'], delegationDepth: 1 },
    );
    expect(results).toHaveLength(2);
    for (const r of results) expect(r.error).toMatch(/depth limit/);
  });

  it('still caps target count when refusing on depth', async () => {
    const targets = Array.from({ length: 8 }, () => ({ provider: 'ollama' }));
    const results = await delegateTasks(targets, 'p', {
      delegateProviders: ['ollama'],
      delegationDepth: 1,
    });
    expect(results).toHaveLength(5);
  });

  it('honors a configured delegateMaxDepth above the default', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks(
      [{ provider: 'ollama' }],
      'p',
      { delegateProviders: ['ollama'], delegationDepth: 1, delegateMaxDepth: 2 },
    );
    expect(results[0].error).toBeUndefined();
    expect(lastWorkerArgs.config.delegationDepth).toBe(2);
  });

  it('refuses all delegation when delegateMaxDepth is 0', async () => {
    const results = await delegateTasks(
      [{ provider: 'ollama' }],
      'p',
      { delegateProviders: ['ollama'], delegateMaxDepth: 0 },
    );
    expect(results[0].error).toMatch(/depth limit/);
    expect(runMock).not.toHaveBeenCalled();
  });

  it('treats a malformed delegationDepth as depth zero', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks(
      [{ provider: 'ollama' }],
      'p',
      { delegateProviders: ['ollama'], delegationDepth: 'lots' },
    );
    expect(results[0].error).toBeUndefined();
    expect(lastWorkerArgs.config.delegationDepth).toBe(1);
  });

  it('gives the sub-agent its role charter and tool allowlist', async () => {
    runMock.mockImplementation(makeRunImpl());
    await delegateTasks(
      [{ provider: 'ollama', role: 'reviewer' }],
      'p',
      { delegateProviders: ['ollama'] },
    );
    expect(lastWorkerArgs.modes.rolePrompt).toContain('REVIEWER');
    expect(lastWorkerArgs.modes.allowedTools).toEqual(getRole('reviewer').allowedTools);
  });

  it('reports the resolved role back on the result', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks(
      [{ provider: 'ollama', role: 'security' }],
      'p',
      { delegateProviders: ['ollama'] },
    );
    expect(results[0].role).toBe('security');
  });

  it('falls back to the generalist for an unknown role', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks(
      [{ provider: 'ollama', role: 'wizard' }],
      'p',
      { delegateProviders: ['ollama'] },
    );
    expect(results[0].role).toBe('generalist');
  });

  it('keeps a read-only role read-only and never auto-approves for it', async () => {
    runMock.mockImplementation(makeRunImpl());
    await delegateTasks(
      [{ provider: 'ollama', role: 'reviewer' }],
      'p',
      { delegateProviders: ['ollama'] },
    );
    expect(lastWorkerArgs.modes.readOnly).toBe(true);
    expect(lastWorkerArgs.modes.autoMode).toBe(false);
  });

  it('auto-approves for a writing role, whose bus has no user to confirm', async () => {
    runMock.mockImplementation(makeRunImpl());
    await delegateTasks(
      [{ provider: 'ollama', role: 'implementer' }],
      'p',
      { delegateProviders: ['ollama'] },
    );
    expect(lastWorkerArgs.modes.readOnly).toBe(false);
    expect(lastWorkerArgs.modes.autoMode).toBe(true);
  });

  it('defaults a target with no role at all to the generalist', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks([{ provider: 'ollama' }], 'p', {
      delegateProviders: ['ollama'],
    });
    expect(results[0].role).toBe('generalist');
    expect(lastWorkerArgs.modes.readOnly).toBe(true);
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

describe('provider resolution by role tier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastWorkerArgs = null;
  });

  it('maps a role tier onto a provider when the target names none', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks(
      [{ role: 'architect' }],
      'p',
      {
        delegateProviders: ['ollama', 'anthropic'],
        delegateTierProviders: { strong: 'anthropic', cheap: 'ollama' },
      },
    );
    expect(results[0].provider).toBe('anthropic');
  });

  it('sends a cheap-tier role to the cheap provider', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks(
      [{ role: 'tester' }],
      'p',
      {
        delegateProviders: ['ollama', 'anthropic'],
        delegateTierProviders: { strong: 'anthropic', cheap: 'ollama' },
      },
    );
    expect(results[0].provider).toBe('ollama');
  });

  it('lets an explicit provider beat the role tier', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks(
      [{ role: 'architect', provider: 'ollama' }],
      'p',
      {
        delegateProviders: ['ollama', 'anthropic'],
        delegateTierProviders: { strong: 'anthropic' },
      },
    );
    expect(results[0].provider).toBe('ollama');
  });

  it('ignores a tier provider the user has not enabled', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks(
      [{ role: 'architect' }],
      'p',
      {
        delegateProviders: ['ollama'],
        delegateTierProviders: { strong: 'anthropic' },
      },
    );
    expect(results[0].provider).toBe('ollama');
    expect(results[0].error).toBeUndefined();
  });

  it('falls back to the parent provider chain when nothing else is configured', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks([{ role: 'reviewer' }], 'p', {
      providerChain: ['gemini'],
    });
    expect(results[0].provider).toBe('gemini');
  });

  it('reports an error when no provider can be resolved at all', async () => {
    const results = await delegateTasks([{ role: 'reviewer' }], 'p', {});
    expect(results[0].error).toMatch(/No provider available/);
    expect(runMock).not.toHaveBeenCalled();
  });
});

describe('planWaves', () => {
  const ids = (waves) => waves.map((w) => w.map((t) => t.id));

  it('puts everything in one wave when nothing declares a dependency', () => {
    expect(ids(planWaves([{ id: 'a' }, { id: 'b' }, { id: 'c' }]))).toEqual([['a', 'b', 'c']]);
  });

  it('assigns ids to targets that do not supply one', () => {
    expect(ids(planWaves([{}, {}]))).toEqual([['task-1', 'task-2']]);
  });

  it('orders a dependent task into a later wave', () => {
    const waves = planWaves([
      { id: 'review', dependsOn: ['build'] },
      { id: 'build' },
    ]);
    expect(ids(waves)).toEqual([['build'], ['review']]);
  });

  it('keeps independent tasks together in the same wave', () => {
    const waves = planWaves([
      { id: 'build' },
      { id: 'review', dependsOn: ['build'] },
      { id: 'security', dependsOn: ['build'] },
    ]);
    expect(ids(waves)).toEqual([['build'], ['review', 'security']]);
  });

  it('handles a chain of three', () => {
    const waves = planWaves([
      { id: 'c', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'a' },
    ]);
    expect(ids(waves)).toEqual([['a'], ['b'], ['c']]);
  });

  it('treats a dependency on an unknown id as already satisfied', () => {
    expect(ids(planWaves([{ id: 'a', dependsOn: ['ghost'] }]))).toEqual([['a']]);
  });

  it('breaks a dependency cycle into a final wave rather than hanging', () => {
    const waves = planWaves([
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
    ]);
    expect(ids(waves)).toEqual([['a', 'b']]);
  });

  it('still schedules the acyclic part before breaking a cycle', () => {
    const waves = planWaves([
      { id: 'free' },
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
    ]);
    expect(ids(waves)).toEqual([['free'], ['a', 'b']]);
  });

  it('returns no waves for no targets', () => {
    expect(planWaves([])).toEqual([]);
  });
});

describe('wave execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastWorkerArgs = null;
  });

  it('runs a dependent task only after its dependency finished', async () => {
    const startOrder = [];
    runMock.mockImplementation((args) => {
      startOrder.push(args.task);
      return makeRunImpl({ tokens: ['out'] })(args);
    });
    await delegateTasks(
      [
        { id: 'review', role: 'reviewer', prompt: 'review it', dependsOn: ['build'] },
        { id: 'build', role: 'implementer', prompt: 'build it' },
      ],
      'p',
      { delegateProviders: ['ollama'], providerChain: ['ollama'] },
    );
    expect(startOrder[0]).toContain('build it');
    expect(startOrder[1]).toContain('review it');
  });

  it('feeds a dependency output into the dependent task prompt', async () => {
    const tasks = [];
    runMock.mockImplementation((args) => {
      tasks.push(args.task);
      return makeRunImpl({ tokens: ['THE DIFF'] })(args);
    });
    await delegateTasks(
      [
        { id: 'build', role: 'implementer', prompt: 'build it' },
        { id: 'review', role: 'reviewer', prompt: 'review it', dependsOn: ['build'] },
      ],
      'p',
      { delegateProviders: ['ollama'], providerChain: ['ollama'] },
    );
    const reviewPrompt = tasks.find((t) => t.includes('review it'));
    expect(reviewPrompt).toContain('THE DIFF');
    expect(reviewPrompt).toContain('implementer');
  });

  it('does not forward a failed dependency output', async () => {
    const tasks = [];
    runMock
      .mockImplementationOnce((args) => {
        tasks.push(args.task);
        return makeRunImpl({ errorMessage: 'boom' })(args);
      })
      .mockImplementationOnce((args) => {
        tasks.push(args.task);
        return makeRunImpl({ tokens: ['ok'] })(args);
      });
    await delegateTasks(
      [
        { id: 'build', role: 'implementer', prompt: 'build it' },
        { id: 'review', role: 'reviewer', prompt: 'review it', dependsOn: ['build'] },
      ],
      'p',
      { delegateProviders: ['ollama'], providerChain: ['ollama'] },
    );
    const reviewPrompt = tasks.find((t) => t.includes('review it'));
    expect(reviewPrompt).not.toContain('Output from');
  });

  it('returns results in the order the targets were given, not wave order', async () => {
    runMock.mockImplementation(makeRunImpl({ tokens: ['x'] }));
    const results = await delegateTasks(
      [
        { id: 'review', role: 'reviewer', dependsOn: ['build'] },
        { id: 'build', role: 'implementer' },
      ],
      'p',
      { delegateProviders: ['ollama'], providerChain: ['ollama'] },
    );
    expect(results.map((r) => r.role)).toEqual(['reviewer', 'implementer']);
  });

  it('still caps total targets across all waves', async () => {
    runMock.mockImplementation(makeRunImpl());
    const targets = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, role: 'reviewer' }));
    const results = await delegateTasks(targets, 'p', {
      delegateProviders: ['ollama'],
      providerChain: ['ollama'],
    });
    expect(results).toHaveLength(5);
  });
});

describe('normalizeTargets', () => {
  it('returns nothing for input that is not an array', () => {
    expect(normalizeTargets(undefined)).toEqual([]);
    expect(normalizeTargets(null)).toEqual([]);
    expect(normalizeTargets('implementer')).toEqual([]);
    expect(normalizeTargets({ role: 'implementer' })).toEqual([]);
  });

  it('drops entries that are not objects', () => {
    expect(normalizeTargets(['build', 42, null, ['x'], { role: 'tester' }])).toHaveLength(1);
  });

  it('assigns an id to a task that has none', () => {
    expect(normalizeTargets([{ role: 'tester' }])[0].id).toBe('task-1');
  });

  it('keeps an explicit id', () => {
    expect(normalizeTargets([{ id: 'build', role: 'tester' }])[0].id).toBe('build');
  });

  it('makes duplicate ids unique so dependsOn cannot resolve ambiguously', () => {
    const ids = normalizeTargets([
      { id: 'build', role: 'implementer' },
      { id: 'build', role: 'tester' },
    ]).map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('replaces an unknown role with the generalist', () => {
    expect(normalizeTargets([{ role: 'wizard' }])[0].role).toBe('generalist');
    expect(normalizeTargets([{ role: 42 }])[0].role).toBe('generalist');
  });

  it('accepts dependsOn given as a bare string', () => {
    expect(normalizeTargets([{ id: 'r', dependsOn: 'build' }])[0].dependsOn).toEqual(['build']);
  });

  it('drops a self-dependency, which could only deadlock', () => {
    expect(normalizeTargets([{ id: 'a', dependsOn: ['a'] }])[0].dependsOn).toBeUndefined();
  });

  it('discards non-string entries inside dependsOn', () => {
    expect(normalizeTargets([{ id: 'r', dependsOn: ['build', 7, null, ''] }])[0].dependsOn)
      .toEqual(['build']);
  });

  it('omits blank prompts, providers and models rather than passing empties through', () => {
    const t = normalizeTargets([{ role: 'tester', prompt: '   ', provider: '', model: null }])[0];
    expect(t.prompt).toBeUndefined();
    expect(t.provider).toBeUndefined();
    expect(t.model).toBeUndefined();
  });

  it('trims surrounding whitespace on string fields', () => {
    const t = normalizeTargets([{ role: 'tester', prompt: '  do it  ', provider: ' ollama ' }])[0];
    expect(t.prompt).toBe('do it');
    expect(t.provider).toBe('ollama');
  });

  it('is idempotent, since both the worker and delegateTasks normalize', () => {
    const once = normalizeTargets([{ id: 'a', role: 'reviewer', dependsOn: 'b' }]);
    expect(normalizeTargets(once)).toEqual(once);
  });
});

describe('delegateTasks input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastWorkerArgs = null;
  });

  it('reports no targets when every entry was malformed', async () => {
    const results = await delegateTasks([null, 'x', 5], 'p', { delegateProviders: ['ollama'] });
    expect(results).toEqual([{ error: 'No delegation targets provided' }]);
    expect(runMock).not.toHaveBeenCalled();
  });

  it('runs the valid tasks and ignores the malformed ones', async () => {
    runMock.mockImplementation(makeRunImpl());
    const results = await delegateTasks(
      [null, { role: 'reviewer' }, 'nope'],
      'p',
      { delegateProviders: ['ollama'], providerChain: ['ollama'] },
    );
    expect(results).toHaveLength(1);
    expect(results[0].role).toBe('reviewer');
  });
});
