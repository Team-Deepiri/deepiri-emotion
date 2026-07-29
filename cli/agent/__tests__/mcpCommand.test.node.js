import { describe, it, expect, beforeEach } from 'vitest';
import { createEventBus, EVENTS } from '../../core/eventBus.js';
import { handleMcpCommand } from '../mcpCommand.js';
import { createToolRegistry } from '../toolRegistry.js';

describe('/mcp', () => {
  let bus;
  let tokens;

  beforeEach(() => {
    bus = createEventBus();
    tokens = [];
    bus.on(EVENTS.LLM_TOKEN, ({ token }) => tokens.push(token));
  });

  it('ignores non-matching text', async () => {
    expect(await handleMcpCommand('hello', { bus, config: {} })).toBe(false);
  });

  it('reports no servers configured, with setup instructions', async () => {
    const handled = await handleMcpCommand('/mcp', { bus, config: { mcpServers: [] } });
    expect(handled).toBe(true);
    expect(tokens.join('')).toMatch(/No MCP servers configured/);
    expect(tokens.join('')).toMatch(/mcpServers/);
  });

  it('reports a connected server and its tools', async () => {
    const mcpResults = [
      {
        name: 'github',
        ok: true,
        handle: {},
        tools: [
          { name: 'search_issues', description: 'search issues', inputSchema: { required: ['query'] } },
          { name: 'list_repos' },
        ],
      },
    ];
    const config = {
      mcpServers: [{ name: 'github', command: 'npx', args: ['-y', 'github-mcp'] }],
      mcpRegistry: createToolRegistry({ mcpResults }),
      mcpServerStatus: mcpResults.map(({ name, ok }) => ({ name, ok, error: null })),
    };
    const handled = await handleMcpCommand('/mcp', { bus, config });
    expect(handled).toBe(true);
    const output = tokens.join('');
    expect(output).toMatch(/github — ✓ connected \(2 tools\)/);
    expect(output).toMatch(/search_issues: search issues/);
    expect(output).toMatch(/list_repos/);
  });

  it('reports a failed server with its error, without throwing', async () => {
    const config = {
      mcpServers: [{ name: 'broken', command: 'nope' }],
      mcpRegistry: createToolRegistry({ mcpResults: [] }),
      mcpServerStatus: [{ name: 'broken', ok: false, error: 'spawn ENOENT' }],
    };
    const handled = await handleMcpCommand('/mcp', { bus, config });
    expect(handled).toBe(true);
    expect(tokens.join('')).toMatch(/broken — ✗ spawn ENOENT/);
  });

  it('handles a server with no status reported yet', async () => {
    const config = {
      mcpServers: [{ name: 'pending', command: 'x' }],
      mcpRegistry: createToolRegistry({ mcpResults: [] }),
      mcpServerStatus: [],
    };
    const handled = await handleMcpCommand('/mcp', { bus, config });
    expect(handled).toBe(true);
    expect(tokens.join('')).toMatch(/pending — ✗ not connected/);
  });

  it('emits LLM_DONE after reporting', async () => {
    let doneEmitted = false;
    bus.on(EVENTS.LLM_DONE, () => { doneEmitted = true; });
    await handleMcpCommand('/mcp', { bus, config: { mcpServers: [] } });
    expect(doneEmitted).toBe(true);
  });
});
