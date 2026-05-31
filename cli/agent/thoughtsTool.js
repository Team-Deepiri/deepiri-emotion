/**
 * Thoughts tool: private agent scratchpad for reasoning before action.
 * The thought is recorded for the LLM's context and emitted as a THOUGHT event
 * (which the user-facing UI does not render). Pure function — no side effects.
 */
export function thoughtsTool({ thought } = {}) {
  if (typeof thought !== 'string' || thought.trim().length === 0) {
    return { error: 'thought must be a non-empty string' };
  }
  const preview = thought.slice(0, 50);
  return {
    recorded: true,
    thought: thought.length > 50 ? `${preview}...` : preview,
  };
}
