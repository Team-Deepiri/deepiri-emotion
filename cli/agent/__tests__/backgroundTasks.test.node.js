/**
 * Integration tests for backgroundTasks.js. Uses constructor-injected fakes
 * for streamLLM/parseToolIntent only (same pattern as AgentWorker.test.node.js)
 * so no real LLM call happens — but maybeConfirmAndExecute is the REAL
 * confirm.js implementation, so gated tool calls (create_file) go through the
 * actual confirmation gate and actually touch a tmp workspace, proving the
 * queue/pause/resume behavior end-to-end rather than mocking it away.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  startBackgroundTask,
  listBackgroundTasks,
  getBackgroundTask,
  cancelBackgroundTask,
  respondToBackgroundConfirmation,
  _resetBackgroundTasksForTest,
} from '../backgroundTasks.js';
import { EVENTS } from '../../core/eventBus.js';

const parseJsonToolOnly = (text) => {
  try {
    const parsed = JSON.parse((text || '').trim());
    if (parsed && typeof parsed.tool === 'string' && parsed.args) return parsed;
  } catch { /* not JSON */ }
  return null;
};

function makeStreamLLM(responses) {
  let callIndex = 0;
  return async (_bus, _prompt, opts = {}) => {
    const response = responses[callIndex] ?? 'FINAL_ANSWER: done';
    callIndex++;
    if (response && typeof opts.onToken === 'function') opts.onToken(response);
  };
}

function waitFor(predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

let dir;
let bus;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bg-tasks-test-'));
  bus = new EventEmitter();
  bus.setMaxListeners(20);
  _resetBackgroundTasksForTest();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('startBackgroundTask', () => {
  it('runs a task with no tool calls to completion', async () => {
    const { id } = startBackgroundTask({
      bus,
      config: { workspaceDir: dir },
      text: 'say hi',
      deps: { streamLLM: makeStreamLLM(['FINAL_ANSWER: hello there']) },
    });

    await waitFor(() => getBackgroundTask(id)?.status === 'done');

    const task = getBackgroundTask(id);
    expect(task.output).toContain('hello there');
    expect(task.endedAt).not.toBeNull();
    expect(listBackgroundTasks().find((t) => t.id === id)?.status).toBe('done');
  });

  it('emits BACKGROUND_TASKS_CHANGED as the task progresses', async () => {
    const events = [];
    bus.on(EVENTS.BACKGROUND_TASKS_CHANGED, (payload) => events.push(payload));

    const { id } = startBackgroundTask({
      bus,
      config: { workspaceDir: dir },
      text: 'say hi',
      deps: { streamLLM: makeStreamLLM(['FINAL_ANSWER: hi']) },
    });

    await waitFor(() => getBackgroundTask(id)?.status === 'done');
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].tasks.find((t) => t.id === id).status).toBe('done');
  });

  it('pauses at awaiting_confirmation on a gated tool call, and resumes on approval', async () => {
    const createCall = JSON.stringify({ tool: 'create_file', args: { filePath: 'new.txt', content: 'hello' } });
    const { id } = startBackgroundTask({
      bus,
      config: { workspaceDir: dir },
      text: 'create a file',
      deps: {
        streamLLM: makeStreamLLM([createCall, 'FINAL_ANSWER: created it']),
        parseToolIntent: parseJsonToolOnly,
      },
    });

    await waitFor(() => getBackgroundTask(id)?.status === 'awaiting_confirmation');
    const pending = getBackgroundTask(id).pendingConfirmation;
    expect(pending.tool).toBe('create_file');
    expect(existsSync(join(dir, 'new.txt'))).toBe(false);

    const responded = respondToBackgroundConfirmation(id, 'once');
    expect(responded).toBe(true);

    await waitFor(() => getBackgroundTask(id)?.status === 'done');
    expect(existsSync(join(dir, 'new.txt'))).toBe(true);
    expect(readFileSync(join(dir, 'new.txt'), 'utf-8')).toBe('hello');
  });

  it('never writes the file when the confirmation is denied', async () => {
    const createCall = JSON.stringify({ tool: 'create_file', args: { filePath: 'denied.txt', content: 'x' } });
    const { id } = startBackgroundTask({
      bus,
      config: { workspaceDir: dir },
      text: 'create a file',
      deps: {
        streamLLM: makeStreamLLM([createCall, 'FINAL_ANSWER: ok, skipped it']),
        parseToolIntent: parseJsonToolOnly,
      },
    });

    await waitFor(() => getBackgroundTask(id)?.status === 'awaiting_confirmation');
    respondToBackgroundConfirmation(id, 'deny');

    await waitFor(() => getBackgroundTask(id)?.status === 'done');
    expect(existsSync(join(dir, 'denied.txt'))).toBe(false);
  });

  it('never auto-approves a gated tool even when modes.autoMode is true', async () => {
    const createCall = JSON.stringify({ tool: 'create_file', args: { filePath: 'auto.txt', content: 'x' } });
    const { id } = startBackgroundTask({
      bus,
      config: { workspaceDir: dir },
      text: 'create a file',
      modes: { autoMode: true, acceptEdits: true },
      deps: {
        streamLLM: makeStreamLLM([createCall, 'FINAL_ANSWER: done']),
        parseToolIntent: parseJsonToolOnly,
      },
    });

    await waitFor(() => getBackgroundTask(id)?.status === 'awaiting_confirmation');
    expect(getBackgroundTask(id).pendingConfirmation.tool).toBe('create_file');
  });

  it('respondToBackgroundConfirmation returns false when nothing is pending', () => {
    const { id } = startBackgroundTask({
      bus,
      config: { workspaceDir: dir },
      text: 'say hi',
      deps: { streamLLM: makeStreamLLM(['FINAL_ANSWER: hi']) },
    });
    expect(respondToBackgroundConfirmation(id, 'once')).toBe(false);
    expect(respondToBackgroundConfirmation('nonexistent', 'once')).toBe(false);
  });

  it('cancelBackgroundTask cancels a running task', async () => {
    const { id } = startBackgroundTask({
      bus,
      config: { workspaceDir: dir },
      text: 'say hi',
      deps: { streamLLM: makeStreamLLM(['FINAL_ANSWER: hi']) },
    });
    expect(cancelBackgroundTask(id)).toBe(true);
    await waitFor(() => getBackgroundTask(id)?.status === 'cancelled');
    expect(cancelBackgroundTask(id)).toBe(false);
  });

  it('getBackgroundTask returns null for an unknown id', () => {
    expect(getBackgroundTask('does-not-exist')).toBeNull();
  });

  it('persists a progress snapshot under .emotion-sessions/background/', async () => {
    const { id } = startBackgroundTask({
      bus,
      config: { workspaceDir: dir },
      text: 'say hi',
      deps: { streamLLM: makeStreamLLM(['FINAL_ANSWER: hi']) },
    });
    await waitFor(() => getBackgroundTask(id)?.status === 'done');
    await waitFor(() => existsSync(join(dir, '.emotion-sessions', 'background', `${id}.json`)));
    const snapshot = JSON.parse(readFileSync(join(dir, '.emotion-sessions', 'background', `${id}.json`), 'utf-8'));
    expect(snapshot.status).toBe('done');
    expect(snapshot.id).toBe(id);
  });
});
