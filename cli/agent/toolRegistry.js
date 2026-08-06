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
  { name: 'find_references', requiredArgs: ['symbol'] },
  { name: 'impact_analysis', requiredArgs: ['symbol'] },
];

/**
 * MCP tool names are namespaced as mcp__<server>__<tool> so two servers can
 * each expose a tool called e.g. "search" without colliding with each other
 * or with a built-in of the same name.
 */
export const MCP_TOOL_PREFIX = 'mcp__';

export function qualifyMcpToolName(serverName, toolName) {
  return `${MCP_TOOL_PREFIX}${serverName}__${toolName}`;
}

/**
 * Turn connectAllMcpServers() results into { metadata, handlers }:
 *  - metadata: same shape as BUILTIN_TOOL_METADATA, one entry per MCP tool
 *    from every server that connected successfully.
 *  - handlers: qualifiedName -> { handle, toolName }, so executeTool can
 *    route a call back to the right server's callMcpTool() without needing
 *    to know which server owns which tool.
 * Servers that failed to connect (ok: false) contribute nothing here —
 * their failure is surfaced separately (see /mcp, step 6) rather than
 * silently dropping tool calls.
 * @param {Array<{name: string, ok: boolean, tools?: Array<{name: string, description?: string, inputSchema?: {required?: string[]}}>, handle?: object}>} mcpResults
 */
export function buildMcpToolMetadata(mcpResults = []) {
  const metadata = [];
  const handlers = new Map();
  for (const server of mcpResults) {
    if (!server.ok) continue;
    for (const tool of server.tools || []) {
      const name = qualifyMcpToolName(server.name, tool.name);
      metadata.push({
        name,
        requiredArgs: tool.inputSchema?.required || [],
        description: tool.description || '',
        server: server.name,
      });
      handlers.set(name, { handle: server.handle, toolName: tool.name });
    }
  }
  return { metadata, handlers };
}

/**
 * Merge built-in tool metadata with a set of connected MCP servers' tools
 * into one registry: knownToolNames/requiredArgs for validation (loopGuards),
 * plus an mcpHandlers map executeTool (tools.js) can dispatch through.
 * @param {{mcpResults?: Array}} [opts]
 */
export function createToolRegistry({ mcpResults = [] } = {}) {
  const { metadata: mcpMetadata, handlers: mcpHandlers } = buildMcpToolMetadata(mcpResults);
  const metadata = [...BUILTIN_TOOL_METADATA, ...mcpMetadata];
  return {
    metadata,
    knownToolNames: new Set(metadata.map((t) => t.name)),
    requiredArgs: Object.fromEntries(metadata.map((t) => [t.name, t.requiredArgs])),
    mcpHandlers,
  };
}
