/**
 * Background tasks: run a full agent turn detached from the foreground chat,
 * so a long task ("write tests for this module", "migrate these 15 files")
 * doesn't block the prompt the way every turn does today.
 *
 * Reuses the exact same engine as the interactive and headless (-p) paths —
 * an AgentWorker given a task string — just not awaited by the caller. Each
 * task gets its own isolated EventEmitter bus (same pattern delegate.js uses
 * for parallel sub-agents) so its token/step traffic never leaks into the
 * main chat UI; only status summaries cross over, via BACKGROUND_TASKS_CHANGED
 * on the real bus.
 *
 * Confirmation gate: gated tool calls (create_file, run_command, ...) still
 * go through confirm.js's normal CONFIRMATION_REQUEST/RESPONSE flow, just on
 * the task's own isolated bus, which nothing answers automatically. Rather
 * than leave that promise hanging forever (or force autoApprove, which is
 * exactly what a background task must not do unattended), we capture the
 * request and pause the task — status: 'awaiting_confirmation' — until
 * respondToBackgroundConfirmation() answers it.
 */
import { EventEmitter } from 'events';
import { writeFile, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { EVENTS } from '../core/eventBus.js';
import { AgentWorker } from './AgentWorker.js';
import { safeWorkspacePath } from './pathSafety.js';

const TASKS_SUBDIR = '.emotion-sessions/background';
const MAX_STEPS = 200;
const MAX_OUTPUT_BYTES = 64 * 1024;

// In-memory registry — background tasks are a same-session concept, like
// currentWorker in runner.js. The persisted JSON (see persist() below) is
// for visibility/audit, not for resuming a task after the CLI restarts.
const tasks = new Map();

const FINISHED_STATUSES = new Set(['done', 'error', 'cancelled']);

function summarize(record) {
  return {
    id: record.id,
    text: record.text,
    status: record.status,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    lastMessage: record.steps[record.steps.length - 1]?.message || null,
    pendingConfirmation: record.pendingConfirmation
      ? { tool: record.pendingConfirmation.tool, path: record.pendingConfirmation.path, preview: record.pendingConfirmation.preview }
      : null,
    // True once the task has finished (done/error/cancelled) and nobody has
    // looked at its detail yet — lets the footer show a "landed" indicator
    // (see StatusBar.js) without touching the main LLM_TOKEN/LLM_DONE stream,
    // which the foreground turn's own recording/dequeue logic also listens
    // to and must not be disturbed by an unrelated background task finishing.
    unseenCompletion: FINISHED_STATUSES.has(record.status) && !record.seen,
  };
}

function emitChanged(bus) {
  bus.emit(EVENTS.BACKGROUND_TASKS_CHANGED, { tasks: [...tasks.values()].map(summarize) });
}

function pushStep(record, step) {
  record.steps.push({ ...step, ts: new Date().toISOString() });
  if (record.steps.length > MAX_STEPS) record.steps.shift();
}

/** Best-effort progress snapshot to disk — mirrors session.js's atomic-write pattern. */
async function persist(record) {
  try {
    const safety = await safeWorkspacePath(TASKS_SUBDIR, record.cwd);
    if (safety.error) return;
    if (!existsSync(safety.resolved)) await mkdir(safety.resolved, { recursive: true });
    const path = join(safety.resolved, `${record.id}.json`);
    const tmp = `${path}.tmp`;
    const snapshot = {
      id: record.id,
      text: record.text,
      status: record.status,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      steps: record.steps,
      output: record.output,
      error: record.error,
    };
    await writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf-8');
    await rename(tmp, path);
  } catch { /* progress persistence must never break the task */ }
}

/**
 * Starts a background task and returns immediately with its id — the task
 * keeps running (and, on gated tool calls, may pause awaiting confirmation)
 * after this returns.
 * @returns {{ id: string }}
 */
export function startBackgroundTask({ bus, config, text, attachments = [], modes = {}, deps = {} }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const workerId = `bg-${id}`;
  const subBus = new EventEmitter();
  subBus.setMaxListeners(20);
  // Tool calls inside AgentWorker always resolve their cwd from
  // config.workspaceDir (see AgentWorker.js's maybeConfirmAndExecute call) —
  // mirrored here so persisted progress lands next to the actual files the
  // task touched, not a separately-chosen directory the task never uses.
  const cwd = config.workspaceDir || process.cwd();

  const record = {
    id, text, cwd,
    status: 'running',
    startedAt: new Date().toISOString(),
    endedAt: null,
    steps: [],
    output: '',
    error: null,
    pendingConfirmation: null,
    seen: false,
    worker: null,
    subBus,
  };
  tasks.set(id, record);

  const worker = new AgentWorker({
    id: workerId,
    bus: subBus,
    config,
    task: text,
    attachments,
    // Background tasks always gate mutating/network/MCP tools through the
    // confirmation queue below — never auto-approve, regardless of the
    // foreground session's /auto or /accept-edits state. See module docstring.
    modes: { ...modes, autoMode: false, acceptEdits: false },
    deps,
  });
  record.worker = worker;

  const relevant = (workerIdOnEvent) => workerIdOnEvent === workerId;

  subBus.on(EVENTS.LLM_TOKEN, ({ workerId: wid, token } = {}) => {
    if (!relevant(wid) || typeof token !== 'string') return;
    if (record.output.length < MAX_OUTPUT_BYTES) record.output += token;
  });

  subBus.on(EVENTS.AGENT_STEP, ({ workerId: wid, type, status, message } = {}) => {
    if (!relevant(wid)) return;
    pushStep(record, { type, status, message });
    emitChanged(bus);
    persist(record);
  });

  subBus.on(EVENTS.CONFIRMATION_REQUEST, (payload = {}) => {
    if (!relevant(payload.workerId)) return;
    record.pendingConfirmation = payload;
    record.status = 'awaiting_confirmation';
    emitChanged(bus);
    persist(record);
  });

  subBus.on(EVENTS.AGENT_ERROR, ({ workerId: wid, message } = {}) => {
    if (!relevant(wid)) return;
    record.error = message;
  });

  subBus.on(EVENTS.AGENT_CANCELLED, ({ workerId: wid } = {}) => {
    if (!relevant(wid)) return;
    record.status = 'cancelled';
    record.endedAt = new Date().toISOString();
    emitChanged(bus);
    persist(record);
  });

  subBus.on(EVENTS.LLM_DONE, ({ workerId: wid, silent } = {}) => {
    if (!relevant(wid) || silent) return;
    record.status = record.error ? 'error' : 'done';
    record.endedAt = new Date().toISOString();
    emitChanged(bus);
    persist(record);
  });

  emitChanged(bus);
  persist(record);

  worker.run().catch((err) => {
    record.status = 'error';
    record.error = err?.message || String(err);
    record.endedAt = new Date().toISOString();
    emitChanged(bus);
    persist(record);
  });

  return { id };
}

/** Summaries of every background task started this session, most-recent-last. */
export function listBackgroundTasks() {
  return [...tasks.values()].map(summarize);
}

/**
 * Full detail for one task — recent steps, buffered output, pending
 * confirmation. Marks a finished task as seen (clearing its footer "landed"
 * indicator) — pass `bus` so that clears immediately rather than waiting for
 * the next unrelated task event.
 */
export function getBackgroundTask(id, bus = null) {
  const record = tasks.get(id);
  if (!record) return null;
  if (FINISHED_STATUSES.has(record.status) && !record.seen) {
    record.seen = true;
    if (bus) emitChanged(bus);
  }
  return {
    ...summarize(record),
    output: record.output,
    steps: record.steps.slice(-20),
    pendingConfirmation: record.pendingConfirmation,
  };
}

/** Cancels a running or awaiting-confirmation task. Returns false if it's already finished or doesn't exist. */
export function cancelBackgroundTask(id) {
  const record = tasks.get(id);
  if (!record) return false;
  if (record.status === 'done' || record.status === 'error' || record.status === 'cancelled') return false;
  record.worker.cancel();
  return true;
}

/**
 * Answers a task's queued confirmation ('once' | 'always' | 'deny'), letting
 * it resume. Returns false if the task doesn't exist or isn't waiting.
 */
export function respondToBackgroundConfirmation(id, choice) {
  const record = tasks.get(id);
  if (!record || !record.pendingConfirmation) return false;
  record.pendingConfirmation = null;
  if (record.status === 'awaiting_confirmation') record.status = 'running';
  record.subBus.emit(EVENTS.CONFIRMATION_RESPONSE, { choice });
  return true;
}

/** Test-only: clears the in-memory registry between test files/cases. */
export function _resetBackgroundTasksForTest() {
  tasks.clear();
}
