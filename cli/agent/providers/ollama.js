/**
 * Ollama provider — local model server, NDJSON streaming on /api/chat.
 * First entry in the default chain because it's free and local.
 *
 * If the configured model isn't installed, we pick an installed one from
 * /api/tags instead of failing with a cryptic HTTP 404.
 *
 * Context: Ollama often loads big models with a tiny default num_ctx (e.g. 4096).
 * Emotion's agent prompt alone is ~3–5k tokens, so we raise num_ctx per request
 * and emit LLM_PROGRESS so the TUI can show prompt/ctx/reasoning/tok-s.
 */
import { EVENTS } from '../../core/eventBus.js';
import { estimateTokens, formatTokenCount } from '../../core/tokens.js';
import { Provider, ProviderUnavailableError } from './base.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';
const AVAILABILITY_TIMEOUT_MS = 800;
const TAGS_TIMEOUT_MS = 2500;
const RESERVE_OUTPUT_TOKENS = 1024;
const NUM_CTX_LADDER = [4096, 8192, 12288, 16384, 24576, 32768];
// Ollama's own default (0.8) is tuned for free-form chat. Agentic tool-use turns need
// the model to stay close to its tool results and emit strict JSON, not get creative —
// small models especially drift into hallucination/format errors at higher temperatures.
const DEFAULT_TEMPERATURE = 0.2;

function trimSlash(url) {
  return (url || DEFAULT_BASE_URL).replace(/\/$/, '');
}

/**
 * Fetch installed models from Ollama (`/api/tags`).
 * @returns {Promise<Array<{ name: string, size: number }>>}
 */
export async function listOllamaModels(baseUrl, { signal } = {}) {
  const base = trimSlash(baseUrl);
  const controller = signal ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), TAGS_TIMEOUT_MS) : null;
  try {
    const res = await fetch(`${base}/api/tags`, {
      method: 'GET',
      signal: signal || controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const models = Array.isArray(data?.models) ? data.models : [];
    return models
      .map((m) => ({
        name: m?.name || m?.model,
        size: typeof m?.size === 'number' ? m.size : Number.POSITIVE_INFINITY,
      }))
      .filter((m) => typeof m.name === 'string' && m.name.length > 0);
  } catch {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * True when an installed name matches the preferred tag
 * (exact, or `name` / `name:tag` vs preferred without/with tag).
 */
export function modelMatches(installed, preferred) {
  if (!installed || !preferred) return false;
  if (installed === preferred) return true;
  const instBase = installed.split(':')[0];
  const prefBase = preferred.split(':')[0];
  if (instBase === preferred || installed === prefBase) return true;
  return instBase === prefBase && !preferred.includes(':');
}

/**
 * Pick which Ollama model to use.
 * Prefers an exact/fuzzy match for `preferred`, else the smallest installed
 * model (faster cold start than grabbing whatever was pulled last).
 */
export async function resolveOllamaModel(baseUrl, preferred = DEFAULT_MODEL) {
  const installed = await listOllamaModels(baseUrl);
  if (installed.length === 0) {
    throw new ProviderUnavailableError(
      `Ollama is running but has no models. Pull one with e.g. \`ollama pull ${preferred || DEFAULT_MODEL}\`.`
    );
  }
  const want = (preferred || DEFAULT_MODEL).trim();
  const match = installed.find((m) => modelMatches(m.name, want));
  if (match) return match.name;
  const smallest = [...installed].sort((a, b) => a.size - b.size)[0];
  return smallest.name;
}

/** Currently loaded model runtime info from `/api/ps` (context_length, etc.). */
export async function getOllamaRuntimeInfo(baseUrl, modelName) {
  const base = trimSlash(baseUrl);
  try {
    const res = await fetch(`${base}/api/ps`, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const models = Array.isArray(data?.models) ? data.models : [];
    const hit = models.find((m) => modelMatches(m?.name || m?.model, modelName))
      || models[0]
      || null;
    if (!hit) return null;
    return {
      name: hit.name || hit.model,
      contextLength: typeof hit.context_length === 'number' ? hit.context_length : null,
      sizeVram: hit.size_vram ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Choose an Ollama num_ctx that fits the prompt (+ reserve) without jumping
 * straight to the model's theoretical max (VRAM blowups). `minNumCtx` sets a
 * floor for hardware that can comfortably hold more than the smallest rung
 * that would technically fit — otherwise the ladder always picks the
 * cheapest sufficient step, which reads as "stuck low" on beefier setups.
 */
export function chooseNumCtx(promptTokens, explicitNumCtx, minNumCtx) {
  if (Number.isFinite(explicitNumCtx) && explicitNumCtx > 0) return explicitNumCtx;
  const need = Math.max(0, promptTokens) + RESERVE_OUTPUT_TOKENS;
  for (const step of NUM_CTX_LADDER) {
    if (step >= need) {
      return Number.isFinite(minNumCtx) && minNumCtx > step ? minNumCtx : step;
    }
  }
  const max = NUM_CTX_LADDER[NUM_CTX_LADDER.length - 1];
  return Number.isFinite(minNumCtx) && minNumCtx > max ? minNumCtx : max;
}

function parseContextError(body) {
  try {
    const outer = JSON.parse(body);
    const innerRaw = typeof outer?.error === 'string' ? outer.error : null;
    const inner = innerRaw ? JSON.parse(innerRaw) : outer;
    const err = inner?.error || inner;
    if (err?.type === 'exceed_context_size_error' || /exceed_context_size/i.test(body)) {
      return {
        promptTokens: err.n_prompt_tokens,
        numCtx: err.n_ctx,
        message: err.message || body,
      };
    }
  } catch {
    // fall through
  }
  if (/exceed_context_size|exceeds the available context/i.test(body || '')) {
    return { message: body };
  }
  return null;
}

export class OllamaProvider extends Provider {
  static providerName = 'ollama';

  constructor({ baseUrl, model, minNumCtx, temperature, maxPredictTokens } = {}) {
    super();
    this.baseUrl = trimSlash(baseUrl);
    this.model = model || DEFAULT_MODEL;
    this.minNumCtx = Number.isFinite(minNumCtx) && minNumCtx > 0 ? minNumCtx : null;
    this.temperature = Number.isFinite(temperature) ? temperature : DEFAULT_TEMPERATURE;
    this.maxPredictTokens = Number.isFinite(maxPredictTokens) && maxPredictTokens > 0
      ? maxPredictTokens
      : null;
  }

  /** Cheap probe: GET the root and see if Ollama answers within ~1s. */
  static async isAvailable(options = {}) {
    const base = trimSlash(options.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT_MS);
    try {
      const res = await fetch(base, { method: 'GET', signal: controller.signal });
      return res.ok || res.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Resolve a concrete installed model before the router advertises it in the UI.
   * Falls through (unavailable) when the daemon has zero models.
   */
  static async resolveOptions(options = {}) {
    const baseUrl = trimSlash(options.baseUrl);
    try {
      const model = await resolveOllamaModel(baseUrl, options.model || DEFAULT_MODEL);
      return { ...options, baseUrl, model };
    } catch (err) {
      if (err instanceof ProviderUnavailableError) throw err;
      throw new ProviderUnavailableError(err?.message || String(err));
    }
  }

  async stream(bus, prompt, opts = {}) {
    const model = await resolveOllamaModel(this.baseUrl, this.model);
    this.model = model;

    const attachments = Array.isArray(opts.attachments) ? opts.attachments : [];
    const userMessage = attachments.length > 0
      ? { role: 'user', content: prompt, images: attachments.map((a) => a.base64) }
      : { role: 'user', content: prompt };

    const promptTokens = estimateTokens(prompt);
    const userOptions = (opts.ollamaOptions && typeof opts.ollamaOptions === 'object')
      ? { ...opts.ollamaOptions }
      : {};
    const numCtx = chooseNumCtx(promptTokens, userOptions.num_ctx, this.minNumCtx);
    userOptions.num_ctx = numCtx;
    if (!Number.isFinite(userOptions.temperature)) {
      userOptions.temperature = this.temperature;
    }
    if (!Number.isFinite(userOptions.num_predict) && this.maxPredictTokens != null) {
      userOptions.num_predict = this.maxPredictTokens;
    }

    const runtime = await getOllamaRuntimeInfo(this.baseUrl, model);
    bus.emit(EVENTS.LLM_PROGRESS, {
      provider: 'ollama',
      model,
      phase: 'request',
      promptTokens,
      numCtx,
      loadedCtx: runtime?.contextLength ?? null,
      message: `ollama ${model} · prompt ~${formatTokenCount(promptTokens)} / ctx ${formatTokenCount(numCtx)}`
        + (runtime?.contextLength && runtime.contextLength < numCtx
          ? ` (reload from ${formatTokenCount(runtime.contextLength)})`
          : ''),
    });
    bus.emit(EVENTS.TOKEN_USAGE_CHANGED, {
      used: promptTokens,
      limit: numCtx,
    });

    const startedAt = Date.now();
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [userMessage],
        stream: true,
        keep_alive: opts.keepAlive ?? '30m',
        options: userOptions,
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const ctxErr = parseContextError(body);
      if (ctxErr) {
        const msg = `Ollama context overflow: prompt ~${formatTokenCount(ctxErr.promptTokens || promptTokens)} `
          + `> ctx ${formatTokenCount(ctxErr.numCtx || numCtx)}. `
          + `Raise num_ctx or shorten the agent prompt.`;
        bus.emit(EVENTS.LLM_PROGRESS, {
          provider: 'ollama',
          model,
          phase: 'error',
          promptTokens: ctxErr.promptTokens || promptTokens,
          numCtx: ctxErr.numCtx || numCtx,
          message: msg,
        });
        throw new Error(msg);
      }
      if (res.status === 404 && /model/i.test(body)) {
        const installed = await listOllamaModels(this.baseUrl);
        const names = installed.map((m) => m.name);
        const hint = names.length
          ? ` Available: ${names.slice(0, 8).join(', ')}. Set ollamaModel in .emotion-cli.json or OLLAMA_MODEL.`
          : ` Pull a model with \`ollama pull ${DEFAULT_MODEL}\`.`;
        throw new Error(`Ollama model '${model}' not found.${hint}`);
      }
      if (res.status >= 500) throw new ProviderUnavailableError(`Ollama ${res.status}: ${body}`);
      throw new Error(`Ollama HTTP ${res.status}: ${body}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let contentChars = 0;
    let thinkingChars = 0;
    let lastProgressAt = 0;
    let inThink = false;

    const emitProgress = (phase, extra = {}) => {
      const now = Date.now();
      if (phase === 'generating' || phase === 'reasoning') {
        if (now - lastProgressAt < 300 && !extra.force) return;
      }
      lastProgressAt = now;
      const elapsed = Math.max(0.001, (now - startedAt) / 1000);
      const outTok = estimateTokens('x'.repeat(contentChars + thinkingChars));
      bus.emit(EVENTS.LLM_PROGRESS, {
        provider: 'ollama',
        model,
        phase,
        promptTokens,
        numCtx,
        contentChars,
        thinkingChars,
        tokensPerSec: Math.round(outTok / elapsed),
        message: phase === 'reasoning'
          ? `Reasoning… ${formatTokenCount(thinkingChars)} chars`
          : phase === 'generating'
            ? `Generating… ${formatTokenCount(contentChars)} chars · ~${Math.round(outTok / elapsed)} tok/s`
            : extra.message,
        ...extra,
      });
    };

    bus.emit(EVENTS.LLM_PROGRESS, {
      provider: 'ollama',
      model,
      phase: 'waiting',
      promptTokens,
      numCtx,
      message: `Waiting on ollama (${model})…`,
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);

          // Newer Ollama reasoning models stream thinking separately.
          const thinkingPiece = json?.message?.thinking;
          if (typeof thinkingPiece === 'string' && thinkingPiece) {
            thinkingChars += thinkingPiece.length;
            if (typeof opts.onThinking === 'function') opts.onThinking(thinkingPiece);
            emitProgress('reasoning');
          }

          const content = json?.message?.content;
          if (content) {
            if (/<think>/i.test(content)) inThink = true;
            const wasThinking = inThink;
            if (inThink && /<\/think>/i.test(content)) inThink = false;

            if (wasThinking) {
              thinkingChars += content.length;
              emitProgress('reasoning');
            } else {
              contentChars += content.length;
              emitProgress('generating');
            }

            // Always forward raw chunks to onToken (AgentWorker strips <think>).
            // Only mirror to the UI stream when not silent and not inside a think block.
            if (typeof opts.onToken === 'function') opts.onToken(content);
            if (!opts.silent && !wasThinking) {
              bus.emit(EVENTS.LLM_TOKEN, { token: content });
            }
          }

          if (json?.done) {
            const promptEval = json.prompt_eval_count;
            const evalCount = json.eval_count;
            const evalDurationNs = json.eval_duration;
            const tokPerSec = evalDurationNs > 0 && evalCount
              ? Math.round(evalCount / (evalDurationNs / 1e9))
              : null;
            bus.emit(EVENTS.LLM_PROGRESS, {
              provider: 'ollama',
              model,
              phase: 'done',
              promptTokens: promptEval || promptTokens,
              numCtx,
              contentChars,
              thinkingChars,
              evalCount: evalCount ?? null,
              tokensPerSec: tokPerSec,
              message: tokPerSec
                ? `Done · ${formatTokenCount(evalCount)} tok @ ${tokPerSec}/s`
                : 'Done',
            });
            if (promptEval || numCtx) {
              bus.emit(EVENTS.TOKEN_USAGE_CHANGED, {
                used: (promptEval || promptTokens) + (evalCount || 0),
                limit: numCtx,
              });
            }
            reader.cancel().catch(() => {});
            return;
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  }
}
