import { describe, it, expect } from 'vitest';
import { createEventBus, EVENTS } from '../../core/eventBus.js';
import { requestConfirmation, isMutatingTool, isGatedTool, allowKeyFor } from '../confirm.js';

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
