import { describe, it, expect } from 'vitest';
import { mergeDelegateStep, agentLabel } from '../DelegatePanel.js';

describe('agentLabel', () => {
  it('shows role, provider and model when all are known', () => {
    expect(agentLabel({ role: 'implementer', provider: 'anthropic', model: 'claude-sonnet-5' }))
      .toBe('implementer (anthropic:claude-sonnet-5)');
  });

  it('omits the model when none was pinned', () => {
    expect(agentLabel({ role: 'reviewer', provider: 'ollama' })).toBe('reviewer (ollama)');
  });

  it('shows the role alone before a provider has been resolved', () => {
    expect(agentLabel({ role: 'architect' })).toBe('architect');
  });

  it('falls back to a generic name when the role is missing', () => {
    expect(agentLabel({})).toBe('agent');
    expect(agentLabel({ provider: 'ollama' })).toBe('agent (ollama)');
  });
});

describe('mergeDelegateStep', () => {
  it('adds a row at its index', () => {
    const rows = mergeDelegateStep([], { index: 0, role: 'implementer', status: 'running' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'implementer', status: 'running' });
  });

  it('updates a row in place rather than appending a second one', () => {
    let rows = mergeDelegateStep([], { index: 0, role: 'implementer', status: 'running' });
    rows = mergeDelegateStep(rows, { index: 0, status: 'done' });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('done');
  });

  it('keeps fields the later event did not repeat', () => {
    let rows = mergeDelegateStep([], { index: 0, role: 'reviewer', provider: 'ollama', status: 'running' });
    rows = mergeDelegateStep(rows, { index: 0, status: 'done' });
    expect(rows[0].role).toBe('reviewer');
    expect(rows[0].provider).toBe('ollama');
  });

  it('tracks several agents independently', () => {
    let rows = mergeDelegateStep([], { index: 0, role: 'implementer', status: 'running' });
    rows = mergeDelegateStep(rows, { index: 1, role: 'reviewer', status: 'running' });
    rows = mergeDelegateStep(rows, { index: 1, status: 'error', error: 'boom' });
    expect(rows[0].status).toBe('running');
    expect(rows[1]).toMatchObject({ status: 'error', error: 'boom' });
  });

  it('does not mutate the array it was given', () => {
    const before = [{ index: 0, status: 'running' }];
    const after = mergeDelegateStep(before, { index: 0, status: 'done' });
    expect(before[0].status).toBe('running');
    expect(after).not.toBe(before);
  });

  it('ignores a payload with no usable index', () => {
    const rows = [{ status: 'running' }];
    expect(mergeDelegateStep(rows, {})).toBe(rows);
    expect(mergeDelegateStep(rows, { index: -1 })).toBe(rows);
    expect(mergeDelegateStep(rows, { index: 'first' })).toBe(rows);
    expect(mergeDelegateStep(rows, { index: 1.5 })).toBe(rows);
  });

  it('handles being called with no arguments at all', () => {
    expect(mergeDelegateStep()).toEqual([]);
  });
});

describe('queued agents', () => {
  it('does not count a queued agent as finished', () => {
    let rows = mergeDelegateStep([], { index: 0, role: 'implementer', status: 'running' });
    rows = mergeDelegateStep(rows, { index: 1, role: 'reviewer', status: 'queued' });
    const settled = rows.filter((a) => a.status === 'done' || a.status === 'error');
    expect(settled).toHaveLength(0);
  });

  it('flips a queued agent to running when its wave starts', () => {
    let rows = mergeDelegateStep([], { index: 1, role: 'reviewer', status: 'queued' });
    rows = mergeDelegateStep(rows, { index: 1, role: 'reviewer', provider: 'ollama', status: 'running' });
    expect(rows[1]).toMatchObject({ status: 'running', provider: 'ollama' });
  });
});
