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
    const message = err?.message || String(err);
    bus.emit(EVENTS.LLM_PROGRESS, {
      phase: 'error',
      message,
    });
    // Always surface real failures in the UI — previously silent agent-loop
    // errors were stuffed into onToken and shown as a fake assistant reply.
    bus.emit(EVENTS.AGENT_ERROR, { message, hint: getErrorHint(message) });
    if (typeof opts.onError === 'function') {
      opts.onError(err);
    }
    // Do NOT call onToken with the error string (that became the chat answer).
  }
  bus.emit(EVENTS.LLM_DONE, { silent: !!opts.silent });
}
