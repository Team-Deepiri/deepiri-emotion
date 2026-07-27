/**
 * Parallel delegation: fan a single task out to multiple provider/model
 * targets at once (e.g. "ask ollama:gemma2 and anthropic:claude-sonnet-5 in
 * parallel"), each running as a full sub-agent — same tool loop, same tool
 * set as the parent (read-only subset; see AgentWorker's `readOnly` mode) —
 * not just a raw completion. Used both for explicit user-requested
 * delegation and for the main agent's own judgment call on very complex
 * tasks that benefit from multiple models working the same prompt
 * concurrently.
 *
 * Each sub-agent gets its own isolated EventEmitter bus so its step/token
 * traffic never leaks into the main chat UI — only the final text (or error)
 * is returned to the caller, which folds it back into its own context.
 */
import { EventEmitter } from 'events';
import { AgentWorker } from './AgentWorker.js';
import { EVENTS } from '../core/eventBus.js';
import { PROVIDER_MODEL_CONFIG_KEY } from './providers/registry.js';

const DEFAULT_MAX_TARGETS = 5;
const DELEGATE_TIMEOUT_MS = 45_000;

/**
 * Run one delegated sub-agent to completion on its own isolated bus.
 * Never throws — errors are captured in the result so Promise.all over
 * multiple targets can't have one failure take down the rest.
 */
function runOne(target, prompt, config, { attachments = [], signal, modes = {} } = {}) {
  const { provider: name, model } = target;
  const modelKey = PROVIDER_MODEL_CONFIG_KEY[name];
  const subConfig = {
    ...config,
    providerChain: [name],
    ...(modelKey && model ? { [modelKey]: model } : {}),
  };

  const subBus = new EventEmitter();
  subBus.setMaxListeners(20);
  const workerId = `delegate-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const worker = new AgentWorker({
    id: workerId,
    bus: subBus,
    config: subConfig,
    task: target.prompt || prompt,
    attachments,
    modes: { ...modes, readOnly: true },
  });

  return new Promise((resolve) => {
    let text = '';
    let errorMsg = null;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      worker.cancel();
    }, DELEGATE_TIMEOUT_MS);

    const onAbort = () => worker.cancel();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    function cleanup() {
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      subBus.removeAllListeners();
    }

    function finish(extraError) {
      if (settled) return;
      cleanup();
      resolve({
        provider: name,
        model: subConfig[modelKey] || null,
        text: text.trim(),
        ...(errorMsg || extraError ? { error: errorMsg || extraError } : {}),
      });
    }

    subBus.on(EVENTS.LLM_TOKEN, ({ workerId: wid, token } = {}) => {
      if (wid === workerId) text += token;
    });
    subBus.on(EVENTS.AGENT_ERROR, ({ workerId: wid, message } = {}) => {
      if (wid === workerId) errorMsg = message;
    });
    subBus.on(EVENTS.LLM_DONE, ({ workerId: wid } = {}) => {
      if (wid === workerId) finish();
    });
    subBus.on(EVENTS.AGENT_CANCELLED, ({ workerId: wid } = {}) => {
      if (wid === workerId) finish('Timed out or cancelled');
    });

    worker.run().catch((err) => finish(err.message));
  });
}

/**
 * Fan a prompt out to multiple provider/model targets in parallel, each as a
 * full tool-using sub-agent.
 * @param {Array<{provider: string, model?: string, prompt?: string}>} targets
 * @param {string} defaultPrompt — used for any target that doesn't specify its own prompt
 * @param {object} config — CLI config (API keys, etc.)
 * @param {{attachments?: Array, signal?: AbortSignal, modes?: object}} opts
 * @returns {Promise<Array<{provider: string, model: string|null, text?: string, error?: string}>>}
 */
export async function delegateTasks(targets, defaultPrompt, config = {}, opts = {}) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return [{ error: 'No delegation targets provided' }];
  }

  const allowed = new Set(config.delegateProviders || []);
  const maxTargets = Number(config.delegateMaxTargets) > 0
    ? Number(config.delegateMaxTargets)
    : DEFAULT_MAX_TARGETS;
  const capped = targets.slice(0, maxTargets);

  return Promise.all(
    capped.map((target) => {
      if (allowed.size > 0 && !allowed.has(target.provider)) {
        return Promise.resolve({
          provider: target.provider,
          model: target.model || null,
          error: `Provider "${target.provider}" is not enabled for delegation`,
        });
      }
      return runOne(target, defaultPrompt, config, opts);
    }),
  );
}
