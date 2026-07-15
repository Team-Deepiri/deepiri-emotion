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
    bus.emit(EVENTS.AGENT_ERROR, { message: err.message, hint: getErrorHint(err.message) });
  }
  bus.emit(EVENTS.LLM_DONE, { silent: !!opts.silent });
}
