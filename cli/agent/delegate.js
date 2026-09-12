/**
 * Parallel delegation: fan work out to several sub-agents at once, each
 * running a full tool loop rather than a raw completion.
 *
 * Two shapes of fan-out share this path:
 *  - comparison — the same prompt to several provider/model targets
 *    ("ask ollama:gemma2 and anthropic:claude-sonnet-5 in parallel")
 *  - specialization — different roles working different pieces of one job,
 *    each with its own charter and its own restricted tool set (see roles.js)
 *
 * A role decides what the sub-agent is told it is for, which tools it can
 * reach, and — via its tier — which provider runs it when the caller didn't
 * name one. Read-only roles (architect, reviewer, security) keep the old
 * `readOnly` gate; roles that must write run with autoApprove, because a
 * sub-agent's bus has no user on it to answer a confirmation prompt.
 *
 * Each sub-agent gets its own isolated EventEmitter bus so its step/token
 * traffic never leaks into the main chat UI — only the final text (or error)
 * is returned to the caller, which folds it back into its own context.
 */
import { EventEmitter } from 'events';
import { AgentWorker } from './AgentWorker.js';
import { EVENTS } from '../core/eventBus.js';
import { PROVIDER_MODEL_CONFIG_KEY } from './providers/registry.js';
import { getRole, WRITE_TOOLS } from './roles.js';

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

/** Tools whose use implies this role needs to mutate the workspace. */
const MUTATING_ROLE_TOOLS = new Set([...WRITE_TOOLS, 'run_command']);

/** True if the role is allowed to change anything on disk. */
function roleMutates(role) {
  return role.allowedTools.some((t) => MUTATING_ROLE_TOOLS.has(t));
}

/**
 * Pick the provider for a target. An explicit provider on the target always
 * wins — the user asking for a specific model must not be second-guessed by a
 * role's tier preference. Otherwise the role's tier is mapped through
 * `delegateTierProviders` (e.g. { strong: 'anthropic', cheap: 'ollama' }),
 * falling back to the first enabled delegation provider and finally to the
 * parent's own provider chain.
 *
 * Roles deliberately do not name providers themselves: pinning
 * architect -> anthropic would fail outright for anyone whose
 * delegateProviders allowlist doesn't include it.
 */
function resolveProvider(target, role, config) {
  if (target.provider) return target.provider;

  const enabled = config.delegateProviders || [];
  const preferred = (config.delegateTierProviders || {})[role.preferredTier];
  if (preferred && (enabled.length === 0 || enabled.includes(preferred))) return preferred;
  if (enabled.length > 0) return enabled[0];
  return config.providerChain?.[0] || null;
}

/** Upstream output is trimmed to this before being fed to a dependent task. */
const MAX_UPSTREAM_CHARS = 4000;

/** Trim for a model-supplied string field; non-strings become undefined. */
function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Coerce a model-produced `tasks` array into targets delegateTasks can trust.
 *
 * Everything here arrives as free-form JSON the LLM wrote, so each field is
 * treated as a suggestion rather than a guarantee: a task that is not an
 * object, a role that does not exist, a dependsOn that is a bare string
 * instead of an array. Rather than rejecting the whole delegation over one
 * malformed entry — which would waste the turn — each field is repaired to
 * something runnable, and only entries with no usable content at all are
 * dropped.
 *
 * @param {unknown} raw — whatever the model put in args.tasks
 * @returns {Array<object>} normalized targets, safe to hand to planWaves
 */
export function normalizeTargets(raw) {
  if (!Array.isArray(raw)) return [];

  const seenIds = new Set();
  const normalized = [];

  for (const [i, entry] of raw.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;

    // Unique ids matter: dependsOn resolves by id, and a duplicate would let
    // one task silently satisfy another task's dependency.
    let id = cleanString(entry.id) || `task-${i + 1}`;
    while (seenIds.has(id)) id = `${id}-${i + 1}`;
    seenIds.add(id);

    // A bare string is the common malformed shape ("dependsOn": "build"),
    // and is worth accepting rather than discarding the ordering entirely.
    const rawDeps = typeof entry.dependsOn === 'string' ? [entry.dependsOn] : entry.dependsOn;
    const dependsOn = (Array.isArray(rawDeps) ? rawDeps : [])
      .map(cleanString)
      .filter((d) => d && d !== id); // self-dependency would only ever deadlock

    normalized.push({
      id,
      role: getRole(entry.role).name,
      ...(cleanString(entry.provider) ? { provider: cleanString(entry.provider) } : {}),
      ...(cleanString(entry.model) ? { model: cleanString(entry.model) } : {}),
      ...(cleanString(entry.prompt) ? { prompt: cleanString(entry.prompt) } : {}),
      ...(dependsOn.length ? { dependsOn } : {}),
    });
  }

  return normalized;
}

/**
 * Order targets into waves that can each run in parallel.
 *
 * A flat Promise.all can't express "review what the implementer wrote" — the
 * reviewer would run against nothing. Tasks may therefore declare `dependsOn`,
 * and everything with its dependencies met runs together in one wave before
 * the next wave starts.
 *
 * Two defensive choices, both because these ids come from model output rather
 * than a trusted caller:
 *  - a dependency on an id that doesn't exist is treated as already satisfied,
 *    so one hallucinated id can't strand a task forever
 *  - a dependency cycle doesn't hard-fail; the tasks still caught in it run
 *    together as a final wave, losing their ordering but not the work
 *
 * @param {Array<object>} targets
 * @returns {Array<Array<object>>} waves, each an array of targets to run together
 */
export function planWaves(targets) {
  const byId = new Map();
  const prepared = targets.map((t, i) => {
    const id = typeof t.id === 'string' && t.id ? t.id : `task-${i + 1}`;
    const prep = { ...t, id, order: i };
    byId.set(id, prep);
    return prep;
  });

  const waves = [];
  const completed = new Set();
  let remaining = prepared;

  while (remaining.length > 0) {
    const ready = remaining.filter((t) => {
      const deps = Array.isArray(t.dependsOn) ? t.dependsOn : [];
      return deps.every((d) => !byId.has(d) || completed.has(d));
    });

    if (ready.length === 0) {
      waves.push(remaining);
      break;
    }

    waves.push(ready);
    for (const t of ready) completed.add(t.id);
    const readySet = new Set(ready);
    remaining = remaining.filter((t) => !readySet.has(t));
  }

  return waves;
}

/**
 * Build the prompt for a task, prefixing whatever its dependencies produced.
 * Without this a dependent task runs in the same blind state as a parallel
 * one and the ordering buys nothing.
 */
function promptWithUpstream(target, defaultPrompt, resultsById) {
  const base = target.prompt || defaultPrompt;
  const deps = Array.isArray(target.dependsOn) ? target.dependsOn : [];
  const upstream = deps
    .map((id) => resultsById.get(id))
    .filter((r) => r && r.text && !r.error)
    .map((r) => `[Output from the ${r.role} agent]\n${r.text.slice(0, MAX_UPSTREAM_CHARS)}`);

  if (upstream.length === 0) return base;
  return `${base}\n\n${upstream.join('\n\n')}`;
}

/** Total budget for everything delegation feeds back into the parent's context. */
const MAX_SYNTHESIS_CHARS = 6000;

/**
 * Split a character budget across texts, smallest first.
 *
 * An even split wastes budget: three agents where two answered in a sentence
 * and one wrote at length would truncate the long one at a third of the
 * budget while the short ones leave most of theirs unused. Giving each text
 * the smaller of {its length, an even share of what's left} lets the unused
 * remainder flow to whoever actually needs it.
 *
 * @param {string[]} texts
 * @param {number} total
 * @returns {number[]} per-text character limits, in the original order
 */
function allocateBudget(texts, total) {
  const limits = new Array(texts.length).fill(0);
  const bySize = texts
    .map((t, i) => ({ i, len: t.length }))
    .sort((a, b) => a.len - b.len);

  let remaining = total;
  let left = bySize.length;
  for (const { i, len } of bySize) {
    const share = Math.floor(remaining / left);
    limits[i] = Math.min(len, share);
    remaining -= limits[i];
    left--;
  }
  return limits;
}

/**
 * Render delegation results as context for the parent agent to synthesize.
 *
 * Previously this was JSON.stringify(results).slice(0, 6000) — which could cut
 * mid-string and hand the model malformed JSON, and gave it no instruction
 * beyond the raw array, so the natural thing to do was concatenate the pieces.
 * Attributing each section by role and stating the job explicitly is what
 * turns a pile of answers into one answer.
 *
 * @param {Array<{role?: string, provider?: string, text?: string, error?: string}>} results
 * @returns {string}
 */
export function formatDelegationResults(results = []) {
  const succeeded = results.filter((r) => !r.error && r.text);
  const failed = results.filter((r) => r.error);
  const silent = results.filter((r) => !r.error && !r.text);

  const limits = allocateBudget(succeeded.map((r) => r.text), MAX_SYNTHESIS_CHARS);
  const sections = succeeded.map((r, i) => {
    const label = r.provider ? `${r.role || 'agent'} (${r.provider})` : (r.role || 'agent');
    const truncated = r.text.length > limits[i];
    const body = truncated ? `${r.text.slice(0, limits[i])}\n… (truncated)` : r.text;
    return `--- ${label} ---\n${body}`;
  });

  for (const r of failed) {
    sections.push(`--- ${r.role || 'agent'}${r.provider ? ` (${r.provider})` : ''}: FAILED ---\n${r.error}`);
  }
  for (const r of silent) {
    sections.push(`--- ${r.role || 'agent'}: returned nothing ---`);
  }

  const count = results.length;
  return `[Delegation results — ${count} agent${count === 1 ? '' : 's'}]

${sections.join('\n\n')}

[Synthesis]
The sections above are separate agents' work on different parts of one task.
Combine them into a single coherent answer for the user:
- do NOT concatenate the sections or report them one agent at a time
- the user does not care which agent said what — drop the attributions
- where agents disagree, resolve it and say which you went with and why
- where an agent failed or returned nothing, say plainly what is missing
  rather than implying that part of the work was done`;
}

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
  const { model } = target;
  const role = getRole(target.role);
  const name = target.provider;
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

  // A role that may write needs its writes to actually go through: a sub-agent
  // runs on an isolated bus with nobody to answer a confirmation prompt, so
  // without autoApprove the first edit would block until the timeout kills it.
  // Mutations are still checkpointed (see confirm.js recordCheckpoint), so the
  // turn stays rewindable. Read-only roles keep the old readOnly gate, which
  // refuses gated tools outright rather than auto-running them.
  const mutates = roleMutates(role);

  const worker = new AgentWorker({
    id: workerId,
    bus: subBus,
    config: subConfig,
    task: target.prompt || prompt,
    attachments,
    modes: {
      ...modes,
      readOnly: !mutates,
      autoMode: mutates,
      allowedTools: role.allowedTools,
      rolePrompt: role.systemPrompt,
    },
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
        role: role.name,
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
 * @param {Array<{role?: string, provider?: string, model?: string, prompt?: string,
 *                id?: string, dependsOn?: string[]}>} targets
 *   — `role` selects the sub-agent's charter and tool allowlist (see roles.js);
 *     an unknown or missing role falls back to the generalist. `provider` is
 *     optional: without one it is resolved from the role's tier. `dependsOn`
 *     names other targets' `id`s; a task runs only after those finish, and
 *     receives their output. Independent tasks still run in parallel.
 * @param {string} defaultPrompt — used for any target that doesn't specify its own prompt
 * @param {object} config — CLI config (API keys, etc.)
 * @param {{attachments?: Array, signal?: AbortSignal, modes?: object,
 *          onProgress?: (update: {index: number, role: string, provider: string|null,
 *                                 model: string|null, status: string}) => void}} opts
 *   — onProgress fires as each wave begins, so a caller can show which agents
 *     are actually working rather than marking them all running up front.
 * @returns {Promise<Array<{role: string, provider: string, model: string|null, text?: string, error?: string}>>}
 */
export async function delegateTasks(rawTargets, defaultPrompt, config = {}, opts = {}) {
  // Normalized here rather than only at the call site so every caller gets the
  // same guarantees — these targets originate in model output regardless of
  // which path reached us.
  const targets = normalizeTargets(rawTargets);
  if (targets.length === 0) {
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
      role: getRole(target.role).name,
      provider: target.provider || null,
      model: target.model || null,
      error: `Delegation depth limit reached (${limit}) — sub-agents cannot delegate further`,
    }));
  }

  // One task per id, so a dependent task can find what it depends on, and the
  // original order can be restored at the end — callers (and the UI) index
  // results positionally against the targets they passed in.
  const resultsById = new Map();
  const ordered = [];

  const runTarget = (target) => {
    const role = getRole(target.role);
    // Resolved up front so the provider is settled before any of the checks
    // below report on it — a target that named no provider still needs a
    // concrete one in its result row.
    const provider = resolveProvider(target, role, config);

    if (!provider) {
      return Promise.resolve({
        role: role.name,
        provider: null,
        model: target.model || null,
        error: 'No provider available for delegation',
      });
    }
    if (allowed.size > 0 && !allowed.has(provider)) {
      return Promise.resolve({
        role: role.name,
        provider,
        model: target.model || null,
        error: `Provider "${provider}" is not enabled for delegation`,
      });
    }
    return runOne(
      { ...target, provider, prompt: promptWithUpstream(target, defaultPrompt, resultsById) },
      defaultPrompt,
      config,
      opts,
    );
  };

  // Waves run in sequence; everything inside a wave runs in parallel. With no
  // dependsOn anywhere this collapses to a single wave — the original flat
  // fan-out, unchanged.
  for (const wave of planWaves(capped)) {
    // Announced as the wave starts, not when the fan-out was requested: a task
    // waiting on an earlier wave is queued, not running, and saying otherwise
    // makes the progress view describe work that has not begun.
    if (typeof opts.onProgress === 'function') {
      for (const t of wave) {
        opts.onProgress({
          index: t.order,
          role: getRole(t.role).name,
          provider: resolveProvider(t, getRole(t.role), config),
          model: t.model || null,
          status: 'running',
        });
      }
    }

    const waveResults = await Promise.all(wave.map(runTarget));
    wave.forEach((target, i) => {
      resultsById.set(target.id, waveResults[i]);
      ordered.push({ order: target.order, result: waveResults[i] });
    });
  }

  return ordered.sort((a, b) => a.order - b.order).map((e) => e.result);
}
