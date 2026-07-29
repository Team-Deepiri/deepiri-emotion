/**
 * /mcp — status view for MCP (Model Context Protocol) servers.
 * Servers are configured in config.mcpServers (see config.js) and connected
 * once at CLI launch (see index.js), which populates config.mcpRegistry
 * (merged tool registry — see toolRegistry.js) and config.mcpServerStatus
 * (per-server ok/error, since a failed server contributes no tools). This
 * command just reads that state back out — it doesn't reconnect anything.
 */
import { EVENTS } from '../core/eventBus.js';

function say(bus, token) {
  bus.emit(EVENTS.LLM_TOKEN, { token });
}

function done(bus) {
  bus.emit(EVENTS.LLM_DONE, {});
}

function toolsByServer(mcpRegistry) {
  const grouped = new Map();
  for (const t of mcpRegistry?.metadata || []) {
    if (!t.server) continue;
    if (!grouped.has(t.server)) grouped.set(t.server, []);
    grouped.get(t.server).push(t);
  }
  return grouped;
}

export async function handleMcpCommand(text, { bus, config }) {
  const match = (text || '').trim().match(/^\/mcp$/i);
  if (!match) return false;

  const servers = config.mcpServers || [];
  if (servers.length === 0) {
    say(
      bus,
      [
        'No MCP servers configured.',
        'Add one to "mcpServers" in ~/.config/deepiri-emotion/cli.json or .emotion-cli.json, e.g.:',
        '{ "mcpServers": [{ "name": "github", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }] }',
        '(restart the CLI afterward — servers connect once at launch)',
      ].join('\n')
    );
    done(bus);
    return true;
  }

  const statusByName = new Map((config.mcpServerStatus || []).map((s) => [s.name, s]));
  const grouped = toolsByServer(config.mcpRegistry);

  const lines = ['MCP servers:'];
  for (const server of servers) {
    const status = statusByName.get(server.name);
    if (!status?.ok) {
      lines.push(`  ${server.name} — ✗ ${status?.error || 'not connected'}`);
      continue;
    }
    const tools = grouped.get(server.name) || [];
    lines.push(`  ${server.name} — ✓ connected (${tools.length} tool${tools.length === 1 ? '' : 's'})`);
    const prefix = `mcp__${server.name}__`;
    for (const tool of tools) {
      const shortName = tool.name.startsWith(prefix) ? tool.name.slice(prefix.length) : tool.name;
      lines.push(`    - ${shortName}${tool.description ? `: ${tool.description}` : ''}`);
    }
  }

  say(bus, lines.join('\n'));
  done(bus);
  return true;
}
