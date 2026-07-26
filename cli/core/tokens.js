/**
 * Rough token estimator (chars/4 heuristic) for the live usage meter.
 * Providers use different tokenizers, so this is an approximation — good
 * enough to warn before a context window overflows, not for billing.
 */
export const DEFAULT_CONTEXT_LIMIT = 8000;

export function estimateTokens(text = '') {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

export function contextWindowFor(config = {}) {
  return config.contextWindow || config.ollamaNumCtx || DEFAULT_CONTEXT_LIMIT;
}

/** Compact display: 5054 → "5.1k", 76 → "76". */
export function formatTokenCount(n) {
  if (n == null || Number.isNaN(n)) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
}

/**
 * Truncate text to roughly `maxTokens` (chars/4), preferring to keep the head
 * and a short tail so instructions + the latest user ask survive.
 */
export function fitTextToTokenBudget(text = '', maxTokens = 0) {
  if (!maxTokens || maxTokens <= 0) return text;
  const maxChars = Math.max(64, Math.floor(maxTokens * 4));
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.75);
  const tail = Math.floor(maxChars * 0.2);
  return `${text.slice(0, head)}\n\n…[truncated to fit context]…\n\n${text.slice(-tail)}`;
}
