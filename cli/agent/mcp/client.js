/**
 * MCP client — spawns configured MCP servers over stdio, discovers their
 * tools, and exposes a small surface (connect/call/disconnect) for the tool
 * registry (toolRegistry.js) to merge alongside built-in tools.
 *
 * Kept deliberately thin: this module owns process lifecycle + the raw MCP
 * protocol calls only. Turning a listed tool into something the agent loop
 * can call like read_file/run_command happens in toolRegistry.js (step 4).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const CLIENT_INFO = { name: 'deepiri-emotion-cli', version: '1.0.0' };
const CONNECT_TIMEOUT_MS = 15_000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Connect to a single MCP server over stdio and list its tools.
 * @param {{name: string, command: string, args?: string[], env?: Record<string,string>}} serverConfig
 * @param {{ClientClass?: typeof Client, TransportClass?: typeof StdioClientTransport}} [deps] injectable for tests
 * @returns {Promise<{name: string, client: Client, transport: StdioClientTransport, tools: Array<{name: string, description?: string, inputSchema: object}>}>}
 */
export async function connectMcpServer(serverConfig, deps = {}) {
  const ClientClass = deps.ClientClass || Client;
  const TransportClass = deps.TransportClass || StdioClientTransport;
  const { name, command, args = [], env } = serverConfig;

  const transport = new TransportClass({ command, args, env });
  const client = new ClientClass(CLIENT_INFO, { capabilities: {} });

  await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, `MCP server "${name}" connect`);
  const listed = await withTimeout(client.listTools(), CONNECT_TIMEOUT_MS, `MCP server "${name}" listTools`);

  return { name, client, transport, tools: listed.tools || [] };
}

/**
 * Connect to every configured MCP server. Servers that fail to start don't
 * block the others — each result reports its own ok/error so /mcp can show
 * a per-server status instead of one bad server taking down the whole CLI.
 * @param {Array<{name: string, command: string, args?: string[], env?: Record<string,string>}>} servers
 * @returns {Promise<Array<{name: string, ok: boolean, tools?: Array, error?: string, handle?: object}>>}
 */
export async function connectAllMcpServers(servers = [], deps = {}) {
  const results = await Promise.allSettled(servers.map((s) => connectMcpServer(s, deps)));
  return results.map((result, i) => {
    const name = servers[i]?.name || `server-${i}`;
    if (result.status === 'fulfilled') {
      return { name, ok: true, tools: result.value.tools, handle: result.value };
    }
    return { name, ok: false, error: result.reason?.message || String(result.reason) };
  });
}

/**
 * Call a tool on a connected MCP server.
 * @param {{client: Client}} handle result of connectMcpServer
 * @param {string} toolName
 * @param {Record<string, unknown>} args
 */
export async function callMcpTool(handle, toolName, args = {}) {
  const result = await handle.client.callTool({ name: toolName, arguments: args });
  if (result.isError) {
    const text = (result.content || []).map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n');
    return { error: text || `MCP tool "${toolName}" returned an error` };
  }
  const text = (result.content || []).map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n');
  return result.structuredContent ?? { text };
}

/** Disconnect a single connected server's transport. */
export async function disconnectMcpServer(handle) {
  await handle.client.close().catch(() => {});
}

/** Disconnect every handle from a connectAllMcpServers() result list. */
export async function disconnectAllMcpServers(results) {
  await Promise.all(
    results.filter((r) => r.ok && r.handle).map((r) => disconnectMcpServer(r.handle))
  );
}
