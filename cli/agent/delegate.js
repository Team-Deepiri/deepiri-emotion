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
 * How many levels of delegation are allowed. 1 means the main agent may
 * delegate but its sub-agents may not — the default, since every role's tool
 * allowlist already excludes `delegate`.
 *
 * This bound exists because the other two limits don't constrain depth:
 * maxTargets caps breadth at a single level, and the per-agent timeout caps
 * one agent's runtime. Without a depth bound, 5 sub-agents that each spawn 5
 * more is geometric growth on a single prompt — real money, and no cap in
 * sight from either of the existing guards.
 */
const DEFAULT_MAX_DEPTH = 1;

/** How many delegation levels deep the agent holding this config already is. */
function currentDepth(config = {}) {
  const depth = Number(config.delegationDepth);
  return Number.isFinite(depth) && depth > 0 ? depth : 0;
}

/** The configured depth limit, defaulting to one level of fan-out. */
function maxDepth(config = {}) {
  const limit = Number(config.delegateMaxDepth);
  return Number.isFinite(limit) && limit >= 0 ? limit : DEFAULT_MAX_DEPTH;
}

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
    // Stamped into the sub-agent's own config so that if it ever reaches
    // delegateTasks again, that call knows how deep it already is. Config is
    // the only channel that survives the AgentWorker boundary.
    delegationDepth: currentDepth(config) + 1,
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

  // Depth bound, enforced here rather than only at the prompt/tool layer: this
  // is the one point every delegation funnels through, so a sub-agent that
  // talks its way past its tool allowlist still cannot recurse.
  const depth = currentDepth(config);
  const limit = maxDepth(config);
  if (depth >= limit) {
    return capped.map((target) => ({
      provider: target.provider,
      model: target.model || null,
      error: `Delegation depth limit reached (${limit}) — sub-agents cannot delegate further`,
    }));
  }

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
