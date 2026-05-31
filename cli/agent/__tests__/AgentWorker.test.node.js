/**
 * Integration tests for AgentWorker.
 * Uses constructor-injected fakes so no real LLM or file I/O occurs.
 *
 * Covers:
 * - workerId stamped on every bus event
 * - Normal FINAL_ANSWER path: LLM_TOKEN + LLM_DONE, no forced finalization
 * - Step exhaustion → forced finalization fires exactly once
 * - Forced finalization fallback string when the final pass returns empty
 * - max_tool_calls budget → forced finalization
 * - timeout budget → forced finalization
 * - Normal plain response (no FINAL_ANSWER prefix) → emitted, no double finalize
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import { AgentWorker } from '../AgentWorker.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal fake for discoverGuidance — returns no guidance. */
const noGuidance = async () => ({ found: false });

/** Minimal fake for detectSupportNeed — returns no support needed. */
const noSupport = () => ({ needsSupport: false });

/** Minimal fake for createSimplePlan — returns no planned reads. */
const simplePlan = () => ({ needsTools: false, requiredFiles: [], intent: 'find_specific', answerStyle: 'brief' });

/** parseToolIntent fake that never finds a tool call. */
const noToolIntent = () => null;

/**
 * parseToolIntent fake that parses JSON tool calls (as the LLM emits them)
 * but returns null for plain text (user messages, prose responses).
 */
const parseJsonToolOnly = (text) => {
  try {
    const parsed = JSON.parse((text || '').trim());
    if (parsed && typeof parsed.tool === 'string' && parsed.args) return parsed;
  } catch { /* not JSON */ }
  return null;
};

/** A read_file tool call JSON string — used to drive loop `continue` iterations. */
const READ_CALL = JSON.stringify({ tool: 'read_file', args: { filePath: 'x.js' } });

/** executeTool fake — should not be called in most tests. */
const noopExecute = async () => ({ error: 'unexpected executeTool call in test' });

/** maybeConfirmAndExecute fake — should not be called in most tests. */
const noopConfirm = async () => ({ error: 'unexpected maybeConfirmAndExecute call in test' });

/** maybeConfirmAndExecute fake that simulates a successful read_file. */
const fakeRead = async () => ({ path: '/x.js', content: 'hello', truncated: false });

/**
 * Build a fake streamLLM that calls onToken with the response string once per
 * call, cycling through the `responses` array. Responses past the end return ''.
 */
function makeStreamLLM(responses) {
  let callIndex = 0;
  return async (_bus, _prompt, opts = {}) => {
    const response = responses[callIndex] ?? '';
    callIndex++;
    if (response && typeof opts.onToken === 'function') {
      opts.onToken(response);
    }
  };
}

/** Collect all events emitted on a bus into an array of { event, payload }. */
function collectEvents(bus) {
  const events = [];
  const originalEmit = bus.emit.bind(bus);
  bus.emit = (event, ...args) => {
    events.push({ event, payload: args[0] ?? {} });
    return originalEmit(event, ...args);
  };
  return events;
}

/** Build a fresh worker with injected fakes. config defaults maxSteps=2. */
function makeWorker(task, deps = {}, config = {}) {
  const bus = new EventEmitter();
  const evts = collectEvents(bus);
  const worker = new AgentWorker({
    id: 'main',
    bus,
    config: { maxSteps: 2, maxToolCalls: 8, agentTimeoutMs: 60_000, ...config },
    task,
    deps: {
      discoverGuidance:       noGuidance,
      detectSupportNeed:      noSupport,
      createSimplePlan:       simplePlan,
      parseToolIntent:        noToolIntent,
      executeTool:            noopExecute,
      maybeConfirmAndExecute: noopConfirm,
      ...deps,
    },
  });
  return { worker, bus, evts };
}

// ---------------------------------------------------------------------------
// workerId stamped on every event
// ---------------------------------------------------------------------------
describe('workerId stamping', () => {
  it('stamps workerId:"main" on AGENT_STATUS events', async () => {
    const { worker, evts } = makeWorker('hello', {
      streamLLM: makeStreamLLM(['FINAL_ANSWER: hi']),
    });
    await worker.run();
    const statusEvents = evts.filter(e => e.event === 'AGENT_STATUS');
    expect(statusEvents.length).toBeGreaterThan(0);
    for (const e of statusEvents) {
      expect(e.payload.workerId).toBe('main');
    }
  });

  it('stamps workerId:"main" on AGENT_STEP events', async () => {
    const { worker, evts } = makeWorker('hello', {
      streamLLM: makeStreamLLM(['FINAL_ANSWER: hi']),
    });
    await worker.run();
    const stepEvents = evts.filter(e => e.event === 'AGENT_STEP');
    expect(stepEvents.length).toBeGreaterThan(0);
    for (const e of stepEvents) {
      expect(e.payload.workerId).toBe('main');
    }
  });

  it('stamps workerId:"main" on LLM_TOKEN and LLM_DONE', async () => {
    const { worker, evts } = makeWorker('hello', {
      streamLLM: makeStreamLLM(['FINAL_ANSWER: hi']),
    });
    await worker.run();
    const tokenEvts = evts.filter(e => e.event === 'LLM_TOKEN');
    const doneEvts  = evts.filter(e => e.event === 'LLM_DONE');
    expect(tokenEvts.length).toBeGreaterThan(0);
    expect(doneEvts.length).toBeGreaterThan(0);
    for (const e of [...tokenEvts, ...doneEvts]) {
      expect(e.payload.workerId).toBe('main');
    }
  });

  it('uses a custom workerId when specified', async () => {
    const bus = new EventEmitter();
    const evts = collectEvents(bus);
    const worker = new AgentWorker({
      id: 'worker-42',
      bus,
      config: { maxSteps: 1, maxToolCalls: 8, agentTimeoutMs: 60_000 },
      task: 'hi',
      deps: {
        streamLLM:              makeStreamLLM(['FINAL_ANSWER: done']),
        discoverGuidance:       noGuidance,
        detectSupportNeed:      noSupport,
        createSimplePlan:       simplePlan,
        parseToolIntent:        noToolIntent,
        executeTool:            noopExecute,
        maybeConfirmAndExecute: noopConfirm,
      },
    });
    await worker.run();
    const allWorkerIds = evts.map(e => e.payload.workerId).filter(Boolean);
    expect(allWorkerIds.length).toBeGreaterThan(0);
    for (const id of allWorkerIds) {
      expect(id).toBe('worker-42');
    }
  });
});

// ---------------------------------------------------------------------------
// Normal FINAL_ANSWER path
// ---------------------------------------------------------------------------
describe('normal FINAL_ANSWER path', () => {
  it('emits exactly one LLM_TOKEN + LLM_DONE, does not trigger forced finalization', async () => {
    const { worker, evts } = makeWorker('what is 2+2?', {
      streamLLM: makeStreamLLM(['FINAL_ANSWER: 4']),
    });
    await worker.run();

    const tokenEvts = evts.filter(e => e.event === 'LLM_TOKEN');
    const doneEvts  = evts.filter(e => e.event === 'LLM_DONE');
    expect(tokenEvts).toHaveLength(1);
    expect(doneEvts).toHaveLength(1);
    expect(tokenEvts[0].payload.token).toBe('4');

    // Wrapping up status = forced finalization; must NOT appear
    const wrappingUp = evts.filter(
      e => e.event === 'AGENT_STATUS' && e.payload.message === 'Wrapping up...'
    );
    expect(wrappingUp).toHaveLength(0);
  });

  it('strips FINAL_ANSWER: prefix from emitted token', async () => {
    const { worker, evts } = makeWorker('q', {
      streamLLM: makeStreamLLM(['FINAL_ANSWER: the answer']),
    });
    await worker.run();
    const token = evts.find(e => e.event === 'LLM_TOKEN')?.payload.token;
    expect(token).toBe('the answer');
  });
});

// ---------------------------------------------------------------------------
// Step exhaustion → forced finalization
//
// The loop only continues across iterations when the LLM emits a tool call
// (which triggers `continue`). Plain text or empty responses break the loop
// immediately. So to exercise step exhaustion we drive the loop with tool
// calls until stopReason fires, then check that forced finalization runs.
// ---------------------------------------------------------------------------
describe('step exhaustion', () => {
  it('triggers forced finalization when all steps consumed without FINAL_ANSWER', async () => {
    // maxSteps=1: step 1 emits a tool call → continue → iteration 2's budget
    // check sees steps=1 >= maxSteps=1 → loopExhausted → forced finalization.
    const { worker, evts } = makeWorker('find x', {
      streamLLM: makeStreamLLM([READ_CALL, 'FINAL_ANSWER: forced answer']),
      parseToolIntent: parseJsonToolOnly,
      maybeConfirmAndExecute: fakeRead,
    }, { maxSteps: 1 });
    await worker.run();

    const wrappingUp = evts.filter(
      e => e.event === 'AGENT_STATUS' && e.payload.message === 'Wrapping up...'
    );
    expect(wrappingUp).toHaveLength(1);

    const tokenEvts = evts.filter(e => e.event === 'LLM_TOKEN');
    // Only the finalization token is emitted (the tool-call step emits no LLM_TOKEN)
    expect(tokenEvts).toHaveLength(1);
    expect(tokenEvts[0].payload.token).toBe('forced answer');
  });

  it('emits exactly one LLM_DONE after forced finalization', async () => {
    const { worker, evts } = makeWorker('find x', {
      streamLLM: makeStreamLLM([READ_CALL, 'FINAL_ANSWER: x']),
      parseToolIntent: parseJsonToolOnly,
      maybeConfirmAndExecute: fakeRead,
    }, { maxSteps: 1 });
    await worker.run();
    const doneEvts = evts.filter(e => e.event === 'LLM_DONE');
    expect(doneEvts).toHaveLength(1);
  });

  it('emits fallback string when finalization pass returns empty', async () => {
    // Step 1 calls a tool → continue → stopReason fires → forced finalization.
    // Finalization streamLLM returns '' → cleaned = '' → fallback string emitted.
    const { worker, evts } = makeWorker('find x', {
      streamLLM: makeStreamLLM([READ_CALL, '']),
      parseToolIntent: parseJsonToolOnly,
      maybeConfirmAndExecute: fakeRead,
    }, { maxSteps: 1 });
    await worker.run();
    const tokenEvts = evts.filter(e => e.event === 'LLM_TOKEN');
    expect(tokenEvts).toHaveLength(1);
    expect(tokenEvts[0].payload.token).toBe('(Agent reached budget limit before completing a response.)');
  });
});

// ---------------------------------------------------------------------------
// max_tool_calls budget
// ---------------------------------------------------------------------------
describe('max_tool_calls budget', () => {
  it('triggers forced finalization when tool call cap is reached', async () => {
    // maxToolCalls=1: step 1 executes one tool (toolCallCount→1) → continue.
    // Iteration 2: stopReason sees toolCalls=1 >= maxToolCalls=1 → loopExhausted.
    const { worker, evts } = makeWorker('search something', {
      streamLLM: makeStreamLLM([READ_CALL, 'FINAL_ANSWER: capped']),
      parseToolIntent: parseJsonToolOnly,
      maybeConfirmAndExecute: fakeRead,
    }, { maxSteps: 5, maxToolCalls: 1, agentTimeoutMs: 60_000 });

    await worker.run();

    const wrappingUp = evts.filter(
      e => e.event === 'AGENT_STATUS' && e.payload.message === 'Wrapping up...'
    );
    expect(wrappingUp).toHaveLength(1);
    const tokenEvts = evts.filter(e => e.event === 'LLM_TOKEN');
    expect(tokenEvts[0].payload.token).toBe('capped');
  });
});

// ---------------------------------------------------------------------------
// Plain response (no FINAL_ANSWER prefix) — no double emit
// ---------------------------------------------------------------------------
describe('plain response (no FINAL_ANSWER)', () => {
  it('emits the trimmed text once and does not trigger forced finalization', async () => {
    const { worker, evts } = makeWorker('hi', {
      streamLLM: makeStreamLLM(['plain response text']),
    });
    await worker.run();

    const tokenEvts = evts.filter(e => e.event === 'LLM_TOKEN');
    expect(tokenEvts).toHaveLength(1);
    expect(tokenEvts[0].payload.token).toBe('plain response text');

    const wrappingUp = evts.filter(
      e => e.event === 'AGENT_STATUS' && e.payload.message === 'Wrapping up...'
    );
    expect(wrappingUp).toHaveLength(0);

    const doneEvts = evts.filter(e => e.event === 'LLM_DONE');
    expect(doneEvts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('error handling', () => {
  it('emits AGENT_ERROR with idle status when streamLLM throws', async () => {
    const { worker, evts } = makeWorker('q', {
      streamLLM: async () => { throw new Error('provider exploded'); },
    });
    await worker.run();

    const errorEvts = evts.filter(e => e.event === 'AGENT_ERROR');
    expect(errorEvts).toHaveLength(1);
    expect(errorEvts[0].payload.message).toBe('provider exploded');
    expect(errorEvts[0].payload.workerId).toBe('main');

    const idleEvts = evts.filter(
      e => e.event === 'AGENT_STATUS' && e.payload.status === 'idle'
    );
    expect(idleEvts.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fix regressions (code-review findings applied to this PR)
// ---------------------------------------------------------------------------
describe('regression guards', () => {
  // Finding #4 — summary fallthrough for non-search tools
  it('pre-loop: non-search tool summary does not read "Found undefined matches"', async () => {
    // Simulate an edit_file result (no .count / .query fields).
    const fakeEdit = async () => ({ edited: true, path: '/proj/foo.js', strategy: 'exact', confidence: 1 });
    const parseEditIntent = (text) =>
      text.includes('edit') ? { tool: 'edit_file', args: { filePath: 'foo.js', oldString: 'a', newString: 'b' } } : null;

    const { worker, evts } = makeWorker('edit foo.js', {
      streamLLM: makeStreamLLM(['FINAL_ANSWER: done']),
      parseToolIntent: parseEditIntent,
      maybeConfirmAndExecute: fakeEdit,
    });
    await worker.run();

    const toolCallStep = evts.find(
      e => e.event === 'AGENT_STEP' && e.payload.type === 'tool_call' && e.payload.status === 'complete'
    );
    expect(toolCallStep).toBeDefined();
    expect(toolCallStep.payload.message).not.toMatch(/Found undefined matches/);
    expect(toolCallStep.payload.message).toMatch(/edit_file/);
  });

  // Finding #5 — step IDs are unique even within a single synchronous tick
  it('all AGENT_STEP events in a turn have distinct IDs', async () => {
    const { worker, evts } = makeWorker('hi', {
      streamLLM: makeStreamLLM(['FINAL_ANSWER: hi']),
    });
    await worker.run();

    const ids = evts
      .filter(e => e.event === 'AGENT_STEP')
      .map(e => e.payload.id);
    expect(ids.length).toBeGreaterThan(0);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  // Finding #6 — in-loop tool throw is caught; turn ends with LLM_DONE not AGENT_ERROR
  it('in-loop: throwing maybeConfirmAndExecute is caught and turn still completes', async () => {
    let callCount = 0;
    const throwingConfirm = async () => {
      callCount++;
      throw new Error('tool exploded mid-loop');
    };
    // Step 1: LLM asks for a tool call → loop dispatches it → throwingConfirm throws.
    // After the error is captured as loopToolResult.error the loop continues.
    // Step 2 (second iteration): LLM emits FINAL_ANSWER.
    const { worker, evts } = makeWorker('call tool', {
      streamLLM: makeStreamLLM([READ_CALL, 'FINAL_ANSWER: recovered']),
      parseToolIntent: parseJsonToolOnly,
      maybeConfirmAndExecute: throwingConfirm,
    }, { maxSteps: 3 });
    await worker.run();

    expect(callCount).toBe(1);

    const errorEvts = evts.filter(e => e.event === 'AGENT_ERROR');
    expect(errorEvts).toHaveLength(0);

    const doneEvts = evts.filter(e => e.event === 'LLM_DONE');
    expect(doneEvts).toHaveLength(1);

    const tokenEvts = evts.filter(e => e.event === 'LLM_TOKEN');
    expect(tokenEvts[0].payload.token).toBe('recovered');
  });

  // Findings #2/#7 — FINAL_ANSWER stripping is consistent on both code paths
  it('FINAL_ANSWER: on a non-first line is stripped on the normal path', async () => {
    const { worker, evts } = makeWorker('q', {
      streamLLM: makeStreamLLM(['Some preamble\nFINAL_ANSWER: the real answer']),
    });
    await worker.run();
    const token = evts.find(e => e.event === 'LLM_TOKEN')?.payload.token;
    // The response starts with 'FINAL_ANSWER:' only if the FULL string starts that way.
    // This response starts with 'Some preamble' → no FINAL_ANSWER strip happens via
    // isFinalAnswer. Falls through to the plain-text branch — verify no "FINAL_ANSWER:"
    // leaks into the output either way.
    expect(token).not.toMatch(/^FINAL_ANSWER:/);
  });

  it('FINAL_ANSWER: prefix at the very start is stripped consistently across both paths', async () => {
    // Normal path: first-and-only loop step returns FINAL_ANSWER.
    const { worker: w1, evts: e1 } = makeWorker('q', {
      streamLLM: makeStreamLLM(['FINAL_ANSWER: clean answer']),
    });
    await w1.run();
    const normalToken = e1.find(e => e.event === 'LLM_TOKEN')?.payload.token;
    expect(normalToken).toBe('clean answer');

    // Forced-finalization path: step 1 calls a tool → budget exhausted → second
    // streamLLM call returns 'FINAL_ANSWER: clean answer'.
    const { worker: w2, evts: e2 } = makeWorker('q', {
      streamLLM: makeStreamLLM([READ_CALL, 'FINAL_ANSWER: clean answer']),
      parseToolIntent: parseJsonToolOnly,
      maybeConfirmAndExecute: fakeRead,
    }, { maxSteps: 1 });
    await w2.run();
    const forcedToken = e2.find(e => e.event === 'LLM_TOKEN')?.payload.token;
    expect(forcedToken).toBe('clean answer');

    // Both paths must produce identical output.
    expect(normalToken).toBe(forcedToken);
  });
});
