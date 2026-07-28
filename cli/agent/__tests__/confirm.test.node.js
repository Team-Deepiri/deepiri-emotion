import { describe, it, expect, vi } from 'vitest';
import { createEventBus, EVENTS } from '../../core/eventBus.js';
import { requestConfirmation, isMutatingTool, isGatedTool, allowKeyFor, maybeConfirmAndExecute } from '../confirm.js';
import { createToolRegistry } from '../toolRegistry.js';

describe('isMutatingTool', () => {
  it('flags only the three mutating tools', () => {
    expect(isMutatingTool('create_file')).toBe(true);
    expect(isMutatingTool('write_file')).toBe(true);
    expect(isMutatingTool('edit_file')).toBe(true);
    expect(isMutatingTool('read_file')).toBe(false);
    expect(isMutatingTool('search')).toBe(false);
    expect(isMutatingTool('run_command')).toBe(false);
  });
});

describe('isGatedTool', () => {
  it('flags mutating tools plus run_command', () => {
    expect(isGatedTool('create_file')).toBe(true);
    expect(isGatedTool('run_command')).toBe(true);
    expect(isGatedTool('read_file')).toBe(false);
    expect(isGatedTool('search')).toBe(false);
  });

  it('flags every mcp__-prefixed tool, regardless of what it does', () => {
    expect(isGatedTool('mcp__github__search_issues')).toBe(true);
    expect(isGatedTool('mcp__github__list_repos')).toBe(true);
    expect(isGatedTool('mcp__filesystem__read_file')).toBe(true);
  });
});

describe('allowKeyFor', () => {
  it('keys run_command per-command, other tools per-tool', () => {
    expect(allowKeyFor('run_command', { command: 'npm test' })).toBe('run_command:npm test');
    expect(allowKeyFor('run_command', { command: '  npm test  ' })).toBe('run_command:npm test');
    expect(allowKeyFor('write_file', { filePath: 'a.js' })).toBe('write_file');
  });
});

describe('requestConfirmation', () => {
  it("resolves 'once' immediately when autoApprove is set, without emitting a request", async () => {
    const bus = createEventBus();
    let requested = false;
    bus.on(EVENTS.CONFIRMATION_REQUEST, () => { requested = true; });
    const result = await requestConfirmation(bus, { tool: 'edit_file' }, { autoApprove: true });
    expect(result).toBe('once');
    expect(requested).toBe(false);
  });

  it("emits a request and resolves 'once' on approval", async () => {
    const bus = createEventBus();
    let payload = null;
    bus.on(EVENTS.CONFIRMATION_REQUEST, (p) => {
      payload = p;
      bus.emit(EVENTS.CONFIRMATION_RESPONSE, { choice: 'once' });
    });
    const result = await requestConfirmation(bus, { tool: 'edit_file', path: '/x' });
    expect(result).toBe('once');
    expect(payload).toEqual({ tool: 'edit_file', path: '/x' });
  });

  it("resolves 'always' when the user chooses to always allow", async () => {
    const bus = createEventBus();
    bus.on(EVENTS.CONFIRMATION_REQUEST, () => {
      bus.emit(EVENTS.CONFIRMATION_RESPONSE, { choice: 'always' });
    });
    const result = await requestConfirmation(bus, { tool: 'run_command' });
    expect(result).toBe('always');
  });

  it("resolves 'deny' on denial", async () => {
    const bus = createEventBus();
    bus.on(EVENTS.CONFIRMATION_REQUEST, () => {
      bus.emit(EVENTS.CONFIRMATION_RESPONSE, { choice: 'deny' });
    });
    const result = await requestConfirmation(bus, { tool: 'write_file' });
    expect(result).toBe('deny');
  });

  it("fails closed: treats a missing/unrecognized choice as 'deny'", async () => {
    const bus = createEventBus();
    bus.on(EVENTS.CONFIRMATION_REQUEST, () => {
      bus.emit(EVENTS.CONFIRMATION_RESPONSE, {});
    });
    const result = await requestConfirmation(bus, { tool: 'write_file' });
    expect(result).toBe('deny');
  });
});

describe('maybeConfirmAndExecute with an MCP tool', () => {
  function mcpRegistryWithGithub(callTool) {
    return createToolRegistry({
      mcpResults: [
        {
          name: 'github',
          ok: true,
          handle: { client: { callTool } },
          tools: [{ name: 'search_issues', description: 'search', inputSchema: { required: ['query'] } }],
        },
      ],
    });
  }

  it('prompts for confirmation before calling an MCP tool, even with no autoApprove passed for built-ins', async () => {
    const callTool = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }));
    const registry = mcpRegistryWithGithub(callTool);
    const bus = createEventBus();
    let seenPayload = null;
    bus.on(EVENTS.CONFIRMATION_REQUEST, (payload) => {
      seenPayload = payload;
      bus.emit(EVENTS.CONFIRMATION_RESPONSE, { choice: 'once' });
    });

    const result = await maybeConfirmAndExecute(
      bus, 'mcp__github__search_issues', { query: 'bug' }, '/cwd',
      { mcpHandlers: registry.mcpHandlers }
    );

    expect(seenPayload.action).toBe('mcp_call');
    expect(seenPayload.preview).toContain('mcp__github__search_issues');
    expect(callTool).toHaveBeenCalledWith({ name: 'search_issues', arguments: { query: 'bug' } });
    expect(result).toEqual({ text: 'ok' });
  });

  it('never calls the MCP tool when the user denies', async () => {
    const callTool = vi.fn(async () => ({ content: [] }));
    const registry = mcpRegistryWithGithub(callTool);
    const bus = createEventBus();
    bus.on(EVENTS.CONFIRMATION_REQUEST, () => {
      bus.emit(EVENTS.CONFIRMATION_RESPONSE, { choice: 'deny' });
    });

    const result = await maybeConfirmAndExecute(
      bus, 'mcp__github__search_issues', { query: 'bug' }, '/cwd',
      { mcpHandlers: registry.mcpHandlers }
    );

    expect(callTool).not.toHaveBeenCalled();
    expect(result).toEqual({ denied: true, path: null, message: 'User denied the tool call.' });
  });

  it('autoApprove still calls the tool without a prompt (matches existing gated-tool behavior)', async () => {
    const callTool = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }));
    const registry = mcpRegistryWithGithub(callTool);
    const bus = createEventBus();
    let requested = false;
    bus.on(EVENTS.CONFIRMATION_REQUEST, () => { requested = true; });

    await maybeConfirmAndExecute(
      bus, 'mcp__github__search_issues', { query: 'bug' }, '/cwd',
      { autoApprove: true, mcpHandlers: registry.mcpHandlers }
    );

    expect(requested).toBe(false);
    expect(callTool).toHaveBeenCalledTimes(1);
  });
});
