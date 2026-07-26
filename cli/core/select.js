/**
 * Interactive select + text prompts for the Ink TUI.
 * Mirrors requestConfirmation: emit request, wait for UI response.
 */
import { EVENTS } from './eventBus.js';

/**
 * @typedef {{ id: string, label: string, description?: string, disabled?: boolean }} SelectItem
 */

/** @type {boolean|null} */
let interactOverride = null;

/** Test-only: force interactive/non-interactive. Pass null to clear. */
export function setInteractForTests(value) {
  interactOverride = value;
}

function canInteract() {
  if (interactOverride != null) return interactOverride;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Show an arrow-key menu. Resolves to the selected item id, or null if cancelled.
 * @param {import('events').EventEmitter} bus
 * @param {{ title: string, subtitle?: string, items: SelectItem[], cancelHint?: string }} opts
 * @returns {Promise<string|null>}
 */
export function requestSelect(bus, opts = {}) {
  const items = (opts.items || []).filter((i) => i && i.id);
  if (!items.length) return Promise.resolve(null);
  if (!canInteract()) {
    // Headless / non-TTY: do not hang and do not auto-pick — caller should no-op.
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const onResponse = ({ id } = {}) => {
      bus.off(EVENTS.SELECT_RESPONSE, onResponse);
      resolve(id == null ? null : String(id));
    };
    bus.once(EVENTS.SELECT_RESPONSE, onResponse);
    bus.emit(EVENTS.SELECT_REQUEST, {
      title: opts.title || 'Select',
      subtitle: opts.subtitle || '',
      items,
      cancelHint: opts.cancelHint || 'Esc cancel · ↑↓ move · Enter select',
    });
  });
}

/**
 * Free-text prompt (API keys, custom model names). Resolves string or null.
 * @param {import('events').EventEmitter} bus
 * @param {{ title: string, placeholder?: string, secret?: boolean }} opts
 */
export function requestTextInput(bus, opts = {}) {
  if (!canInteract()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const onResponse = ({ value } = {}) => {
      bus.off(EVENTS.TEXT_INPUT_RESPONSE, onResponse);
      resolve(value == null || value === '' ? null : String(value));
    };
    bus.once(EVENTS.TEXT_INPUT_RESPONSE, onResponse);
    bus.emit(EVENTS.TEXT_INPUT_REQUEST, {
      title: opts.title || 'Enter value',
      placeholder: opts.placeholder || '',
      secret: !!opts.secret,
    });
  });
}

/** Open a URL in the system browser (best-effort). */
export async function openBrowser(url) {
  if (!url || typeof url !== 'string') return false;
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      await execFileAsync('open', [url]);
    } else if (platform === 'win32') {
      await execFileAsync('cmd', ['/c', 'start', '', url]);
    } else {
      await execFileAsync('xdg-open', [url]);
    }
    return true;
  } catch {
    return false;
  }
}
