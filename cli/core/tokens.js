/**
 * Rough token estimator (chars/4 heuristic) for the live usage meter.
 * Providers use different tokenizers, so this is an approximation — good
 * enough to warn before a context window overflows, not for billing.
 */
export const DEFAULT_CONTEXT_LIMIT = 8000;

export function estimateTokens(text = '') {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function contextWindowFor(config = {}) {
  return config.contextWindow || DEFAULT_CONTEXT_LIMIT;
}
