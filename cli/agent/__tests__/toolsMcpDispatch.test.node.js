import { describe, it, expect, vi } from 'vitest';
import { parseToolIntent, executeTool } from '../tools.js';
import { createToolRegistry } from '../toolRegistry.js';

const GITHUB_HANDLE = { client: { callTool: vi.fn() } };

function registryWithGithub() {
  return createToolRegistry({
    mcpResults: [
      {
        name: 'github',
        ok: true,
        handle: GITHUB_HANDLE,
        tools: [{ name: 'search_issues', description: 'search', inputSchema: { required: ['query'] } }],
      },
    ],
  });
}

describe('parseToolIntent with a merged MCP registry', () => {
  it('validates an MCP tool call the same way a built-in call validates', () => {
    const registry = registryWithGithub();
    const result = parseToolIntent(
      JSON.stringify({ tool: 'mcp__github__search_issues', args: { query: 'bug' } }),
      registry
    );
    expect(result).toEqual({ tool: 'mcp__github__search_issues', args: { query: 'bug' } });
  });

  it('rejects an MCP tool call missing its required arg', () => {
    const registry = registryWithGithub();
    const result = parseToolIntent(JSON.stringify({ tool: 'mcp__github__search_issues', args: {} }), registry);
    expect(result).toBeNull();
  });

  it('without a registry, an MCP-qualified tool name is unknown (unchanged default behavior)', () => {
    const result = parseToolIntent(JSON.stringify({ tool: 'mcp__github__search_issues', args: { query: 'bug' } }));
    expect(result).toBeNull();
  });

  it('built-in tool calls still validate with a registry passed in', () => {
    const registry = registryWithGithub();
    const result = parseToolIntent(JSON.stringify({ tool: 'read_file', args: { filePath: 'x.js' } }), registry);
    expect(result).toEqual({ tool: 'read_file', args: { filePath: 'x.js' } });
  });
});

describe('executeTool with mcpHandlers', () => {
  it('routes an unrecognized-as-built-in tool name to callMcpTool via the handle', async () => {
    GITHUB_HANDLE.client.callTool = vi.fn(async () => ({
      content: [{ type: 'text', text: 'found 3 issues' }],
    }));
    const registry = registryWithGithub();
    const result = await executeTool('mcp__github__search_issues', { query: 'bug' }, '/cwd', {
      mcpHandlers: registry.mcpHandlers,
    });
    expect(GITHUB_HANDLE.client.callTool).toHaveBeenCalledWith({ name: 'search_issues', arguments: { query: 'bug' } });
    expect(result).toEqual({ text: 'found 3 issues' });
  });

  it('still returns Unknown tool for a name absent from both built-ins and mcpHandlers', async () => {
    const registry = registryWithGithub();
    const result = await executeTool('mcp__slack__post_message', {}, '/cwd', { mcpHandlers: registry.mcpHandlers });
    expect(result).toEqual({ error: 'Unknown tool: mcp__slack__post_message' });
  });

  it('built-in tools are unaffected by an mcpHandlers map being present', async () => {
    const registry = registryWithGithub();
    const result = await executeTool('memory_list', {}, '/cwd', { mcpHandlers: registry.mcpHandlers });
    expect(result).not.toEqual({ error: 'Unknown tool: memory_list' });
  });
});
