import { describe, it, expect, vi } from 'vitest';
import {
  connectMcpServer,
  connectAllMcpServers,
  callMcpTool,
  disconnectMcpServer,
  disconnectAllMcpServers,
} from '../mcp/client.js';

function fakeDeps({ tools = [], connectError = null, listToolsError = null, callToolResult = null } = {}) {
  const closed = { called: false };
  const client = {
    connect: vi.fn(async () => {
      if (connectError) throw connectError;
    }),
    listTools: vi.fn(async () => {
      if (listToolsError) throw listToolsError;
      return { tools };
    }),
    callTool: vi.fn(async () => callToolResult),
    close: vi.fn(async () => {
      closed.called = true;
    }),
  };
  const ClientClass = vi.fn(function ClientClass() {
    return client;
  });
  const TransportClass = vi.fn(function TransportClass(opts) {
    this.opts = opts;
  });
  return { ClientClass, TransportClass, client, closed };
}

describe('connectMcpServer', () => {
  it('connects, lists tools, and returns a handle', async () => {
    const deps = fakeDeps({ tools: [{ name: 'search_issues', description: 'search', inputSchema: {} }] });
    const handle = await connectMcpServer(
      { name: 'github', command: 'npx', args: ['-y', 'github-mcp'] },
      deps
    );
    expect(handle.name).toBe('github');
    expect(handle.tools).toEqual([{ name: 'search_issues', description: 'search', inputSchema: {} }]);
    expect(deps.client.connect).toHaveBeenCalledTimes(1);
    expect(deps.TransportClass).toHaveBeenCalledWith({ command: 'npx', args: ['-y', 'github-mcp'], env: undefined });
  });

  it('propagates a connect failure', async () => {
    const deps = fakeDeps({ connectError: new Error('spawn ENOENT') });
    await expect(
      connectMcpServer({ name: 'broken', command: 'nope' }, deps)
    ).rejects.toThrow('spawn ENOENT');
  });

  it('defaults tools to an empty array when the server reports none', async () => {
    const deps = fakeDeps({ tools: undefined });
    deps.client.listTools = vi.fn(async () => ({}));
    const handle = await connectMcpServer({ name: 'empty', command: 'x' }, deps);
    expect(handle.tools).toEqual([]);
  });
});

describe('connectAllMcpServers', () => {
  it('reports ok:true for servers that connect and ok:false for ones that fail, without one blocking the other', async () => {
    const goodDeps = fakeDeps({ tools: [{ name: 'a' }] });
    const badDeps = fakeDeps({ connectError: new Error('boom') });

    const results = await Promise.all([
      connectAllMcpServers([{ name: 'good', command: 'x' }], goodDeps),
      connectAllMcpServers([{ name: 'bad', command: 'y' }], badDeps),
    ]);
    expect(results[0]).toEqual([
      { name: 'good', ok: true, tools: [{ name: 'a' }], handle: expect.objectContaining({ name: 'good' }) },
    ]);
    expect(results[1]).toEqual([{ name: 'bad', ok: false, error: 'boom' }]);
  });

  it('handles an empty server list', async () => {
    expect(await connectAllMcpServers([])).toEqual([]);
  });
});

describe('callMcpTool', () => {
  it('returns structuredContent when present', async () => {
    const deps = fakeDeps({ callToolResult: { content: [], structuredContent: { count: 3 } } });
    const handle = await connectMcpServer({ name: 's', command: 'x' }, deps);
    const result = await callMcpTool(handle, 'count_things', { q: 'x' });
    expect(result).toEqual({ count: 3 });
    expect(deps.client.callTool).toHaveBeenCalledWith({ name: 'count_things', arguments: { q: 'x' } });
  });

  it('falls back to joined text content when no structuredContent', async () => {
    const deps = fakeDeps({
      callToolResult: { content: [{ type: 'text', text: 'hello' }, { type: 'text', text: 'world' }] },
    });
    const handle = await connectMcpServer({ name: 's', command: 'x' }, deps);
    const result = await callMcpTool(handle, 'say', {});
    expect(result).toEqual({ text: 'hello\nworld' });
  });

  it('surfaces isError results as { error }', async () => {
    const deps = fakeDeps({
      callToolResult: { isError: true, content: [{ type: 'text', text: 'permission denied' }] },
    });
    const handle = await connectMcpServer({ name: 's', command: 'x' }, deps);
    const result = await callMcpTool(handle, 'delete_thing', {});
    expect(result).toEqual({ error: 'permission denied' });
  });
});

describe('disconnectMcpServer / disconnectAllMcpServers', () => {
  it('calls close() on the client', async () => {
    const deps = fakeDeps();
    const handle = await connectMcpServer({ name: 's', command: 'x' }, deps);
    await disconnectMcpServer(handle);
    expect(deps.client.close).toHaveBeenCalledTimes(1);
  });

  it('only closes handles for servers that connected ok', async () => {
    const deps = fakeDeps();
    const handle = await connectMcpServer({ name: 's', command: 'x' }, deps);
    await disconnectAllMcpServers([
      { name: 's', ok: true, handle },
      { name: 'bad', ok: false, error: 'boom' },
    ]);
    expect(deps.client.close).toHaveBeenCalledTimes(1);
  });

  it('does not throw if close() rejects', async () => {
    const deps = fakeDeps();
    const handle = await connectMcpServer({ name: 's', command: 'x' }, deps);
    deps.client.close = vi.fn(async () => {
      throw new Error('already closed');
    });
    await expect(disconnectMcpServer(handle)).resolves.toBeUndefined();
  });
});
