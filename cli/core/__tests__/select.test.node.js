import { describe, it, expect, afterEach } from 'vitest';
import { createEventBus, EVENTS } from '../eventBus.js';
import { requestSelect, requestTextInput, setInteractForTests } from '../select.js';

describe('interactive select', () => {
  afterEach(() => {
    setInteractForTests(null);
  });

  it('resolves null when non-interactive', async () => {
    setInteractForTests(false);
    const bus = createEventBus();
    await expect(
      requestSelect(bus, { title: 't', items: [{ id: 'a', label: 'A' }] })
    ).resolves.toBeNull();
  });

  it('resolves when SELECT_RESPONSE fires', async () => {
    setInteractForTests(true);
    const bus = createEventBus();
    const p = requestSelect(bus, {
      title: 'Pick',
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    });
    await Promise.resolve();
    bus.emit(EVENTS.SELECT_RESPONSE, { id: 'b' });
    await expect(p).resolves.toBe('b');
  });

  it('resolves null on cancel', async () => {
    setInteractForTests(true);
    const bus = createEventBus();
    const p = requestSelect(bus, {
      title: 'Pick',
      items: [{ id: 'a', label: 'A' }],
    });
    await Promise.resolve();
    bus.emit(EVENTS.SELECT_RESPONSE, { id: null });
    await expect(p).resolves.toBeNull();
  });

  it('requestTextInput resolves value', async () => {
    setInteractForTests(true);
    const bus = createEventBus();
    const p = requestTextInput(bus, { title: 'Key', secret: true });
    await Promise.resolve();
    bus.emit(EVENTS.TEXT_INPUT_RESPONSE, { value: 'sk-test' });
    await expect(p).resolves.toBe('sk-test');
  });
});
