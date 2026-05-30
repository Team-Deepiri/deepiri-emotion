import { describe, it, expect } from 'vitest';
import { createEventBus, EVENTS } from '../../core/eventBus.js';
import { requestConfirmation, isMutatingTool } from '../confirm.js';

describe('isMutatingTool', () => {
  it('flags only the three mutating tools', () => {
    expect(isMutatingTool('create_file')).toBe(true);
    expect(isMutatingTool('write_file')).toBe(true);
    expect(isMutatingTool('edit_file')).toBe(true);
    expect(isMutatingTool('read_file')).toBe(false);
    expect(isMutatingTool('search')).toBe(false);
  });
});

describe('requestConfirmation', () => {
  it('resolves true immediately when autoApprove is set, without emitting a request', async () => {
    const bus = createEventBus();
    let requested = false;
    bus.on(EVENTS.CONFIRMATION_REQUEST, () => { requested = true; });
    const result = await requestConfirmation(bus, { tool: 'edit_file' }, { autoApprove: true });
    expect(result).toBe(true);
    expect(requested).toBe(false);
  });

  it('emits a request and resolves true on approval', async () => {
    const bus = createEventBus();
    let payload = null;
    bus.on(EVENTS.CONFIRMATION_REQUEST, (p) => {
      payload = p;
      bus.emit(EVENTS.CONFIRMATION_RESPONSE, { approved: true });
    });
    const result = await requestConfirmation(bus, { tool: 'edit_file', path: '/x' });
    expect(result).toBe(true);
    expect(payload).toEqual({ tool: 'edit_file', path: '/x' });
  });

  it('resolves false on denial', async () => {
    const bus = createEventBus();
    bus.on(EVENTS.CONFIRMATION_REQUEST, () => {
      bus.emit(EVENTS.CONFIRMATION_RESPONSE, { approved: false });
    });
    const result = await requestConfirmation(bus, { tool: 'write_file' });
    expect(result).toBe(false);
  });

  it('treats a missing approved field as denial', async () => {
    const bus = createEventBus();
    bus.on(EVENTS.CONFIRMATION_REQUEST, () => {
      bus.emit(EVENTS.CONFIRMATION_RESPONSE, {});
    });
    const result = await requestConfirmation(bus, { tool: 'write_file' });
    expect(result).toBe(false);
  });
});
