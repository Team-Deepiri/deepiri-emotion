/**
 * LLM streaming entry point. Thin shim over the provider gateway.
 * All provider-specific logic lives in ./providers/.
 *
 * Public contract preserved for runner.js:
 *   await streamLLM(bus, prompt, { config, silent, onToken })
 * Emits EVENTS.LLM_TOKEN per chunk (from the underlying provider) and EVENTS.LLM_DONE on completion.
 */
import { EVENTS } from '../core/eventBus.js';
import { streamWithFallback } from './providers/router.js';
import { getErrorHint } from '../core/errorHints.js';

export async function streamLLM(bus, prompt, opts = {}) {
  try {
    await streamWithFallback(bus, prompt, opts, opts.config || {});
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    if (!opts.silent) {
      // Only surface the error banner for visible (non-reasoning) calls.
      bus.emit(EVENTS.AGENT_ERROR, { message: err.message, hint: getErrorHint(err.message) });
    } else if (typeof opts.onToken === 'function') {
      // Silent callers (reasoning loop, supervisor) get the error via onToken
      // so the loop can incorporate it — but nothing reaches the UI stream.
      opts.onToken(`(${err.message})`);
    }
  }
  bus.emit(EVENTS.LLM_DONE, { silent: !!opts.silent });
}
