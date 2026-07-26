/**
 * Ollama provider — local model server, NDJSON streaming on /api/chat.
 * First entry in the default chain because it's free and local.
 *
 * If the configured model isn't installed, we pick an installed one from
 * /api/tags instead of failing with a cryptic HTTP 404.
 */
import { EVENTS } from '../../core/eventBus.js';
import { Provider, ProviderUnavailableError } from './base.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';
const AVAILABILITY_TIMEOUT_MS = 800;
const TAGS_TIMEOUT_MS = 2500;

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

export class OllamaProvider extends Provider {
  static providerName = 'ollama';

  constructor({ baseUrl, model } = {}) {
    super();
    this.baseUrl = trimSlash(baseUrl);
    this.model = model || DEFAULT_MODEL;
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
    // Prefer an already-resolved model from resolveOptions; otherwise resolve now.
    const model = await resolveOllamaModel(this.baseUrl, this.model);
    this.model = model;

    // Ollama vision: include base64 images in the `images` field of the user message.
    // Requires a vision-capable model (e.g. llava, bakllava). Text models ignore images.
    const attachments = Array.isArray(opts.attachments) ? opts.attachments : [];
    const userMessage = attachments.length > 0
      ? { role: 'user', content: prompt, images: attachments.map((a) => a.base64) }
      : { role: 'user', content: prompt };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [userMessage],
        stream: true,
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
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
          const content = json?.message?.content;
          if (content) {
            if (!opts.silent) bus.emit(EVENTS.LLM_TOKEN, { token: content });
            if (typeof opts.onToken === 'function') opts.onToken(content);
          }
          // Ollama keeps the socket open until we notice the terminal chunk.
          if (json?.done) {
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
