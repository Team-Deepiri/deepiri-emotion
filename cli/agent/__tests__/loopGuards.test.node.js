/**
 * Tests for cli/agent/loopGuards.js — pure functions, no mocks required.
 */
import { describe, it, expect } from 'vitest';
import { toolCallKey, stopReason, validateToolCall, KNOWN_TOOLS } from '../loopGuards.js';

const BASE_CONFIG = { maxSteps: 5, maxToolCalls: 8, agentTimeoutMs: 60_000 };

// ---------------------------------------------------------------------------
// toolCallKey
// ---------------------------------------------------------------------------
describe('toolCallKey', () => {
  it('produces a string from tool + args', () => {
    const key = toolCallKey({ tool: 'read_file', args: { filePath: 'cli/index.js' } });
    expect(typeof key).toBe('string');
    expect(key).toContain('read_file');
  });

  it('same args in same order → same key', () => {
    const a = toolCallKey({ tool: 'search', args: { query: 'hello' } });
    const b = toolCallKey({ tool: 'search', args: { query: 'hello' } });
    expect(a).toBe(b);
  });

  it('different args → different key', () => {
    const a = toolCallKey({ tool: 'read_file', args: { filePath: 'a.js' } });
    const b = toolCallKey({ tool: 'read_file', args: { filePath: 'b.js' } });
    expect(a).not.toBe(b);
  });

  it('different tool names → different key even with same args', () => {
    const a = toolCallKey({ tool: 'search', args: { query: 'x' } });
    const b = toolCallKey({ tool: 'read_file', args: { query: 'x' } });
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// stopReason
// ---------------------------------------------------------------------------
describe('stopReason', () => {
  const base = { steps: 0, toolCalls: 0, startTime: 0, now: 0, config: BASE_CONFIG };

  it('returns null when all budgets are fine', () => {
    expect(stopReason(base)).toBeNull();
  });

  it('returns max_steps when steps >= maxSteps', () => {
    expect(stopReason({ ...base, steps: 5 })).toBe('max_steps');
    expect(stopReason({ ...base, steps: 6 })).toBe('max_steps');
  });

  it('returns null when steps is one below limit', () => {
    expect(stopReason({ ...base, steps: 4 })).toBeNull();
  });

  it('returns max_tool_calls when toolCalls >= maxToolCalls', () => {
    expect(stopReason({ ...base, toolCalls: 8 })).toBe('max_tool_calls');
    expect(stopReason({ ...base, toolCalls: 99 })).toBe('max_tool_calls');
  });

  it('returns null when toolCalls is one below limit', () => {
    expect(stopReason({ ...base, toolCalls: 7 })).toBeNull();
  });

  it('returns timeout when elapsed >= agentTimeoutMs', () => {
    expect(stopReason({ ...base, startTime: 0, now: 60_000 })).toBe('timeout');
    expect(stopReason({ ...base, startTime: 0, now: 61_000 })).toBe('timeout');
  });

  it('returns null when elapsed is one ms below timeout', () => {
    expect(stopReason({ ...base, startTime: 0, now: 59_999 })).toBeNull();
  });

  it('max_steps takes precedence over max_tool_calls when both trip', () => {
    const reason = stopReason({ ...base, steps: 5, toolCalls: 8 });
    expect(reason).toBe('max_steps');
  });
});

// ---------------------------------------------------------------------------
// validateToolCall
// ---------------------------------------------------------------------------
describe('validateToolCall', () => {
  it('accepts a valid read_file call', () => {
    const result = validateToolCall({ tool: 'read_file', args: { filePath: 'package.json' } });
    expect(result).toEqual({ tool: 'read_file', args: { filePath: 'package.json' } });
  });

  it('accepts a valid search call', () => {
    const result = validateToolCall({ tool: 'search', args: { query: 'startup' } });
    expect(result).toEqual({ tool: 'search', args: { query: 'startup' } });
  });

  it('accepts list_files with no required args', () => {
    const result = validateToolCall({ tool: 'list_files', args: {} });
    expect(result).not.toBeNull();
  });

  it('accepts explain with required concept+explanation', () => {
    const result = validateToolCall({
      tool: 'explain',
      args: { concept: 'event bus', explanation: 'decouples producers from consumers' }
    });
    expect(result).not.toBeNull();
  });

  it('accepts create_file with filePath+content', () => {
    const result = validateToolCall({ tool: 'create_file', args: { filePath: 'x.js', content: '// hi' } });
    expect(result).not.toBeNull();
  });

  it('accepts edit_file with all three required args', () => {
    const result = validateToolCall({
      tool: 'edit_file',
      args: { filePath: 'a.js', oldString: 'old', newString: 'new' }
    });
    expect(result).not.toBeNull();
  });

  it('rejects an unknown tool name', () => {
    expect(validateToolCall({ tool: 'delete_file', args: { filePath: 'x' } })).toBeNull();
  });

  it('rejects missing required arg (read_file without filePath)', () => {
    expect(validateToolCall({ tool: 'read_file', args: { path: 'x' } })).toBeNull();
  });

  it('rejects missing required arg (explain without explanation)', () => {
    expect(validateToolCall({ tool: 'explain', args: { concept: 'event bus' } })).toBeNull();
  });

  it('rejects when args is null', () => {
    expect(validateToolCall({ tool: 'search', args: null })).toBeNull();
  });

  it('rejects when args is an array', () => {
    expect(validateToolCall({ tool: 'search', args: ['query'] })).toBeNull();
  });

  it('rejects non-object input', () => {
    expect(validateToolCall(null)).toBeNull();
    expect(validateToolCall('not an object')).toBeNull();
    expect(validateToolCall(42)).toBeNull();
  });

  it('rejects when tool key is missing', () => {
    expect(validateToolCall({ args: { filePath: 'x' } })).toBeNull();
  });

  it('rejects when tool is a KNOWN_TOOLS name but args key is missing entirely', () => {
    expect(validateToolCall({ tool: 'run_command' })).toBeNull();
  });

  it('KNOWN_TOOLS covers exactly the expected set', () => {
    const expected = [
      'read_file', 'search', 'list_files', 'run_command',
      'explain', 'create_file', 'write_file', 'edit_file'
    ];
    expect([...KNOWN_TOOLS].sort()).toEqual(expected.sort());
  });
});
