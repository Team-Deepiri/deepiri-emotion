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

const STUB_HINT =
  '\n\nHello from the CLI. Set OPENAI_API_KEY, run Ollama locally, or log into Claude Code (`claude`) to get started.';

function emitAsTokens(bus, text) {
  for (const char of text || '') bus.emit(EVENTS.LLM_TOKEN, { token: char });
}

export async function streamLLM(bus, prompt, opts = {}) {
  try {
    await streamWithFallback(bus, prompt, opts, opts.config || {});
  } catch (err) {
    const friendly = err?.providerChainExhausted
      ? `(No usable AI provider — ${err.message})${STUB_HINT}`
      : `(${err.message})${STUB_HINT}`;
    if (!opts.silent) {
      // Only show the error stub in visible (non-reasoning) calls.
      emitAsTokens(bus, friendly);
    } else if (typeof opts.onToken === 'function') {
      // Silent callers (reasoning loop, supervisor) get the error via onToken
      // so the loop can incorporate it — but nothing reaches the UI stream.
      opts.onToken(friendly);
    }
  }
  // Only finalize the visible stream when this is a user-facing call.
  // Silent reasoning steps must not fire LLM_DONE — it resets agentStatus to
  // idle and clears streamingMessage, causing spinner flicker between steps.
  if (!opts.silent) {
    bus.emit(EVENTS.LLM_DONE, {});
  }
}
