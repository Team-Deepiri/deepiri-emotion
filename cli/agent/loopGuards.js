/**
 * Pure loop-guard utilities for the agent runner.
 * No side effects, no imports — safe to unit-test without mocking.
 */

/** Tools the agent is allowed to call. */
export const KNOWN_TOOLS = new Set([
  'read_file',
  'search',
  'list_files',
  'run_command',
  'explain',
  'create_file',
  'write_file',
  'edit_file',
]);

/** Required arg keys per tool (presence check only). */
const REQUIRED_ARGS = {
  read_file:    ['filePath'],
  search:       ['query'],
  list_files:   [],
  run_command:  ['command'],
  explain:      ['concept', 'explanation'],
  create_file:  ['filePath', 'content'],
  write_file:   ['filePath', 'content'],
  edit_file:    ['filePath', 'oldString', 'newString'],
};

/**
 * Validate a JSON-parsed tool call object.
 * Returns normalized { tool, args } or null (falls back to regex parsing).
 * @param {unknown} parsed
 * @returns {{ tool: string, args: Record<string,unknown> } | null}
 */
export function validateToolCall(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const { tool, args } = parsed;
  if (typeof tool !== 'string' || !KNOWN_TOOLS.has(tool)) return null;
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null;
  const required = REQUIRED_ARGS[tool] ?? [];
  for (const key of required) {
    if (!(key in args)) return null;
  }
  return { tool, args };
}

/**
 * Stable dedup key for a tool call.
 * @param {{ tool: string, args: unknown }} call
 * @returns {string}
 */
export function toolCallKey({ tool, args }) {
  return `${tool}-${JSON.stringify(args)}`;
}

/**
 * Decide whether the loop should stop before the next iteration.
 * @param {{ steps: number, toolCalls: number, startTime: number, now: number, config: { maxSteps: number, maxToolCalls: number, agentTimeoutMs: number } }} opts
 * @returns {'max_steps' | 'max_tool_calls' | 'timeout' | null}
 */
export function stopReason({ steps, toolCalls, startTime, now, config }) {
  if (steps >= config.maxSteps) return 'max_steps';
  if (toolCalls >= config.maxToolCalls) return 'max_tool_calls';
  if (now - startTime >= config.agentTimeoutMs) return 'timeout';
  return null;
}
