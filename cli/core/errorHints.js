/**
 * Maps known error message patterns to a suggested fix, shown alongside
 * the raw error in the CLI's error box.
 */
const ERROR_HINTS = [
  [/no provider in chain could serve|no usable ai provider/i,
    'No AI provider found — run `ollama serve`, set OPENAI_API_KEY, or log into claude-cli (`claude`).'],
  [/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|network/i,
    'Network issue — check that the provider endpoint (e.g. Ollama) is running and reachable.'],
  [/401|unauthorized|invalid api key|not authenticated/i,
    'Authentication failed — check your API key or run the provider\'s login command.'],
  [/rate limit|429/i,
    'Rate limited — wait a moment and try again, or switch providers.'],
  [/exceed_context_size|exceeds the available context|n_prompt_tokens/i,
    'Prompt is larger than the model context — Emotion will raise num_ctx / trim context. Retry, or pick a smaller model.'],
  [/ENOENT.*ollama|command not found.*ollama/i,
    'Ollama CLI not found — install it or run `ollama serve`.'],
];

/** Returns a suggested fix for a given error message, or null if none matches. */
export function getErrorHint(message) {
  if (!message) return null;
  for (const [pattern, hint] of ERROR_HINTS) {
    if (pattern.test(message)) return hint;
  }
  return null;
}
