/**
 * Canonical metadata for built-in tools: name + required arg keys.
 * Single source of truth for loopGuards.validateToolCall() — previously this
 * list was duplicated (KNOWN_TOOLS set + REQUIRED_ARGS map) directly inside
 * loopGuards.js with no shared origin. Kept as plain metadata (no execute
 * functions here) to avoid a circular import with tools.js, which owns the
 * actual tool implementations and its own execution dispatch table.
 *
 * MCP servers (see mcpCommand.js) contribute additional entries at runtime
 * that get merged alongside this list rather than hardcoded here.
 */
export const BUILTIN_TOOL_METADATA = [
  { name: 'read_file', requiredArgs: ['filePath'] },
  { name: 'search', requiredArgs: ['query'] },
  { name: 'list_files', requiredArgs: [] },
  { name: 'run_command', requiredArgs: ['command'] },
  { name: 'explain', requiredArgs: ['concept', 'explanation'] },
  { name: 'create_file', requiredArgs: ['filePath', 'content'] },
  { name: 'write_file', requiredArgs: ['filePath', 'content'] },
  { name: 'edit_file', requiredArgs: ['filePath', 'oldString', 'newString'] },
  { name: 'git_status', requiredArgs: [] },
  { name: 'git_diff', requiredArgs: [] },
  { name: 'thoughts', requiredArgs: ['thought'] },
  { name: 'memory_set', requiredArgs: ['key', 'value'] },
  { name: 'memory_get', requiredArgs: ['key'] },
  { name: 'memory_list', requiredArgs: [] },
  { name: 'delegate', requiredArgs: ['tasks'] },
  { name: 'web_search', requiredArgs: ['query'] },
  { name: 'web_fetch', requiredArgs: ['url'] },
];
