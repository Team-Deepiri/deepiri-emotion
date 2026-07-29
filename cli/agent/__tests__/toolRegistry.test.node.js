import { describe, it, expect } from 'vitest';
import {
  BUILTIN_TOOL_METADATA,
  qualifyMcpToolName,
  buildMcpToolMetadata,
  createToolRegistry,
} from '../toolRegistry.js';

const GITHUB_HANDLE = { name: 'github', tag: 'github-handle' };

const MCP_RESULTS = [
  {
    name: 'github',
    ok: true,
    handle: GITHUB_HANDLE,
    tools: [
      { name: 'search_issues', description: 'search issues', inputSchema: { required: ['query'] } },
      { name: 'list_repos', description: 'list repos', inputSchema: {} },
    ],
  },
  {
    name: 'slack',
    ok: false,
    error: 'ECONNREFUSED',
  },
];

describe('qualifyMcpToolName', () => {
  it('namespaces a tool name with its server', () => {
    expect(qualifyMcpToolName('github', 'search_issues')).toBe('mcp__github__search_issues');
  });

  it('keeps two servers with a same-named tool distinct', () => {
    const a = qualifyMcpToolName('github', 'search');
    const b = qualifyMcpToolName('slack', 'search');
    expect(a).not.toBe(b);
  });
});

describe('buildMcpToolMetadata', () => {
  it('produces metadata only for servers that connected ok', () => {
    const { metadata } = buildMcpToolMetadata(MCP_RESULTS);
    expect(metadata).toEqual([
      { name: 'mcp__github__search_issues', requiredArgs: ['query'], description: 'search issues', server: 'github' },
      { name: 'mcp__github__list_repos', requiredArgs: [], description: 'list repos', server: 'github' },
    ]);
  });

  it('maps each qualified name to its owning handle + original tool name', () => {
    const { handlers } = buildMcpToolMetadata(MCP_RESULTS);
    expect(handlers.get('mcp__github__search_issues')).toEqual({
      handle: GITHUB_HANDLE,
      toolName: 'search_issues',
    });
    expect(handlers.has('mcp__slack__anything')).toBe(false);
  });

  it('returns empty metadata/handlers for no servers', () => {
    const { metadata, handlers } = buildMcpToolMetadata([]);
    expect(metadata).toEqual([]);
    expect(handlers.size).toBe(0);
  });

  it('defaults requiredArgs to [] when inputSchema has no required list', () => {
    const { metadata } = buildMcpToolMetadata([
      { name: 's', ok: true, handle: {}, tools: [{ name: 't' }] },
    ]);
    expect(metadata[0].requiredArgs).toEqual([]);
  });
});

describe('createToolRegistry', () => {
  it('merges built-ins with connected MCP tools', () => {
    const registry = createToolRegistry({ mcpResults: MCP_RESULTS });
    expect(registry.knownToolNames.has('read_file')).toBe(true);
    expect(registry.knownToolNames.has('mcp__github__search_issues')).toBe(true);
    expect(registry.knownToolNames.has('mcp__github__list_repos')).toBe(true);
    expect(registry.metadata.length).toBe(BUILTIN_TOOL_METADATA.length + 2);
  });

  it('required args for an MCP tool are reachable the same way as built-ins', () => {
    const registry = createToolRegistry({ mcpResults: MCP_RESULTS });
    expect(registry.requiredArgs.read_file).toEqual(['filePath']);
    expect(registry.requiredArgs['mcp__github__search_issues']).toEqual(['query']);
  });

  it('with no MCP servers, behaves like the built-in-only set', () => {
    const registry = createToolRegistry();
    expect(registry.knownToolNames).toEqual(new Set(BUILTIN_TOOL_METADATA.map((t) => t.name)));
    expect(registry.mcpHandlers.size).toBe(0);
  });
});
