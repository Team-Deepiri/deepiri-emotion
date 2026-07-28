/**
 * Pure loop-guard utilities for the agent runner.
 * No side effects — the only import is the shared tool metadata list.
 */
import { BUILTIN_TOOL_METADATA } from './toolRegistry.js';

/** Tools the agent is allowed to call. */
export const KNOWN_TOOLS = new Set(BUILTIN_TOOL_METADATA.map((t) => t.name));

/** Required arg keys per tool (presence check only). */
const REQUIRED_ARGS = Object.fromEntries(
  BUILTIN_TOOL_METADATA.map((t) => [t.name, t.requiredArgs])
);

/**
 * Validate a JSON-parsed tool call object.
 * Returns normalized { tool, args } or null (falls back to regex parsing).
 * `registry` (optional) is a toolRegistry.js createToolRegistry() result —
 * when given, its knownToolNames/requiredArgs (built-ins + connected MCP
 * tools) are checked instead of the built-in-only defaults, so MCP tool
 * calls validate the same way read_file/run_command always have.
 * @param {unknown} parsed
 * @param {{knownToolNames: Set<string>, requiredArgs: Record<string,string[]>} | null} [registry]
 * @returns {{ tool: string, args: Record<string,unknown> } | null}
 */
export function validateToolCall(parsed, registry = null) {
  if (!parsed || typeof parsed !== 'object') return null;
  const { tool, args } = parsed;
  const knownTools = registry?.knownToolNames ?? KNOWN_TOOLS;
  const requiredArgsMap = registry?.requiredArgs ?? REQUIRED_ARGS;
  if (typeof tool !== 'string' || !knownTools.has(tool)) return null;
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null;
  const required = requiredArgsMap[tool] ?? [];
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
