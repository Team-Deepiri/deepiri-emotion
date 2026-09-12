/**
 * Role-scoped tool access on AgentWorker (modes.allowedTools).
 *
 * A sub-agent spawned with a role may call only the tools that role declares.
 * These tests drive the worker with injected fakes — no real LLM or file I/O —
 * and assert on whether the execution path was reached at all, since a refused
 * tool must never make it as far as the confirm/execute layer.
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { AgentWorker } from '../AgentWorker.js';

const noGuidance = async () => ({ found: false });
const noSupport = () => ({ needsSupport: false });
const simplePlan = () => ({ needsTools: false, requiredFiles: [], intent: 'find_specific', answerStyle: 'brief' });

/** Parses the JSON tool calls the LLM emits; plain prose returns null. */
const parseJsonToolOnly = (text) => {
  try {
    const parsed = JSON.parse((text || '').trim());
    if (parsed && typeof parsed.tool === 'string' && parsed.args) return parsed;
  } catch { /* not JSON */ }
  return null;
};

function toolCall(tool, args = {}) {
  return JSON.stringify({ tool, args });
}

/** streamLLM fake that replays `responses` in order and records each prompt. */
function makeStreamLLM(responses, prompts = []) {
  let i = 0;
  return async (_bus, prompt, opts = {}) => {
    prompts.push(prompt);
    const response = responses[i] ?? 'FINAL_ANSWER: done';
    i++;
    if (response && typeof opts.onToken === 'function') opts.onToken(response);
  };
}

/** Build a worker with injected fakes and a given modes object. */
function makeWorker(task, { modes = {}, responses = [], deps = {} } = {}) {
  const bus = new EventEmitter();
  const prompts = [];
  const worker = new AgentWorker({
    id: 'sub',
    bus,
    config: { maxSteps: 3, maxToolCalls: 8, agentTimeoutMs: 60_000 },
    task,
    modes,
    deps: {
      discoverGuidance: noGuidance,
      detectSupportNeed: noSupport,
      createSimplePlan: simplePlan,
      parseToolIntent: parseJsonToolOnly,
      streamLLM: makeStreamLLM(responses, prompts),
      ...deps,
    },
  });
  return { worker, bus, prompts };
}

describe('modes.allowedTools gating', () => {
  it('refuses a tool outside the allowlist without reaching the execute layer', async () => {
    const confirmExec = vi.fn(async () => ({ ok: true }));
    const { worker } = makeWorker('write something', {
      modes: { allowedTools: ['read_file', 'search'] },
      responses: [toolCall('write_file', { filePath: 'a.js', content: 'x' })],
      deps: { maybeConfirmAndExecute: confirmExec, executeTool: vi.fn() },
    });
    await worker.run();
    expect(confirmExec).not.toHaveBeenCalled();
  });

  it('tells the agent which tools it does have when refusing', async () => {
    const prompts = [];
    const { worker } = makeWorker('write something', {
      modes: { allowedTools: ['read_file', 'search'] },
      responses: [toolCall('write_file', { filePath: 'a.js', content: 'x' })],
      deps: {
        maybeConfirmAndExecute: vi.fn(),
        executeTool: vi.fn(),
        streamLLM: makeStreamLLM([toolCall('write_file', { filePath: 'a.js', content: 'x' })], prompts),
      },
    });
    await worker.run();
    const refusal = prompts.find((p) => p.includes('is not available to you in this role'));
    expect(refusal).toBeDefined();
    expect(refusal).toContain('read_file, search');
  });

  it('still runs a tool that is in the allowlist', async () => {
    const confirmExec = vi.fn(async () => ({ path: '/x.js', content: 'hi' }));
    const { worker } = makeWorker('read something', {
      modes: { allowedTools: ['read_file'] },
      responses: [toolCall('read_file', { filePath: 'x.js' })],
      deps: { maybeConfirmAndExecute: confirmExec, executeTool: vi.fn() },
    });
    await worker.run();
    expect(confirmExec).toHaveBeenCalled();
    expect(confirmExec.mock.calls[0][1]).toBe('read_file');
  });

  it('leaves an agent with no allowlist unrestricted', async () => {
    const confirmExec = vi.fn(async () => ({ ok: true }));
    const { worker } = makeWorker('write something', {
      modes: {},
      responses: [toolCall('write_file', { filePath: 'a.js', content: 'x' })],
      deps: { maybeConfirmAndExecute: confirmExec, executeTool: vi.fn() },
    });
    await worker.run();
    expect(confirmExec).toHaveBeenCalled();
  });

  it('accepts the allowlist as a Set as well as an array', async () => {
    const confirmExec = vi.fn(async () => ({ path: '/x.js', content: 'hi' }));
    const { worker } = makeWorker('read something', {
      modes: { allowedTools: new Set(['read_file']) },
      responses: [toolCall('read_file', { filePath: 'x.js' })],
      deps: { maybeConfirmAndExecute: confirmExec, executeTool: vi.fn() },
    });
    await worker.run();
    expect(confirmExec).toHaveBeenCalled();
  });
});

describe('allowlist covers the inline tool branches', () => {
  it('blocks delegate when it is not in the allowlist', async () => {
    const delegateTasks = vi.fn(async () => []);
    const { worker } = makeWorker('fan this out', {
      modes: { allowedTools: ['read_file'] },
      responses: [toolCall('delegate', { tasks: [{ provider: 'ollama' }] })],
      deps: { delegateTasks, maybeConfirmAndExecute: vi.fn(), executeTool: vi.fn() },
    });
    await worker.run();
    expect(delegateTasks).not.toHaveBeenCalled();
  });

  it('blocks explain when it is not in the allowlist', async () => {
    const executeTool = vi.fn(async () => ({ concept: 'c', explanation: 'e' }));
    const { worker } = makeWorker('teach me', {
      modes: { allowedTools: ['read_file'] },
      responses: [toolCall('explain', { concept: 'c', explanation: 'e' })],
      deps: { executeTool, maybeConfirmAndExecute: vi.fn() },
    });
    await worker.run();
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('still allows delegate when the allowlist includes it', async () => {
    const delegateTasks = vi.fn(async () => [{ provider: 'ollama', text: 'hi' }]);
    const { worker } = makeWorker('fan this out', {
      modes: { allowedTools: ['delegate'] },
      responses: [toolCall('delegate', { tasks: [{ provider: 'ollama' }] })],
      deps: { delegateTasks, maybeConfirmAndExecute: vi.fn(), executeTool: vi.fn() },
    });
    await worker.run();
    expect(delegateTasks).toHaveBeenCalled();
  });
});

describe('allowlist is stated in the system prompt', () => {
  it('lists the available tools for a scoped agent', async () => {
    const { worker, prompts } = makeWorker('do a thing', {
      modes: { allowedTools: ['read_file', 'search'] },
      responses: ['FINAL_ANSWER: ok'],
      deps: { maybeConfirmAndExecute: vi.fn(), executeTool: vi.fn() },
    });
    await worker.run();
    expect(prompts[0]).toContain('[Your Tools]');
    expect(prompts[0]).toContain('read_file, search');
  });

  it('omits the section entirely for an unscoped agent', async () => {
    const { worker, prompts } = makeWorker('do a thing', {
      modes: {},
      responses: ['FINAL_ANSWER: ok'],
      deps: { maybeConfirmAndExecute: vi.fn(), executeTool: vi.fn() },
    });
    await worker.run();
    expect(prompts[0]).not.toContain('[Your Tools]');
  });
});
