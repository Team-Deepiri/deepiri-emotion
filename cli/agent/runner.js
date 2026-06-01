/**
 * Agent runner: dispatch layer. Handles slash-commands and mode state,
 * then delegates each user turn to an AgentWorker instance.
 */
import { EVENTS } from '../core/eventBus.js';
import { MODES } from '../core/modes.js';
import { discoverGuidance } from './guidance.js';
import { AgentWorker } from './AgentWorker.js';

/**
 * @param {import('events').EventEmitter} bus
 * @param {Record<string,unknown>} [config] - CLI config (provider, keys, URLs)
 */
export function attachAgentRunner(bus, config = {}) {
  let teachMode        = config.teachMode        ?? false;
  let activeMode       = null;
  let autoMode         = config.autoMode         ?? false;
  let acceptEdits      = config.acceptEdits      ?? false;
  let guardMode        = config.supervisorEnabled ?? true;

  bus.on(EVENTS.USER_MESSAGE, async ({ text, attachments = [] }) => {
    if (text?.trim() === '/teach') {
      teachMode = !teachMode;
      bus.emit(EVENTS.TEACH_MODE_CHANGED, { teachMode });
      const msg = teachMode
        ? '📖 Teach mode ON — I will explain my reasoning, code concepts, and best practices as I work.'
        : 'Teach mode OFF.';
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (text?.trim() === '/debug') {
      activeMode = activeMode === MODES.DEBUG ? null : MODES.DEBUG;
      bus.emit(EVENTS.MODE_CHANGED, { activeMode });
      const msg = activeMode === MODES.DEBUG
        ? '🔍 Debug mode ON — full step visibility enabled.'
        : 'Debug mode OFF.';
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (text?.trim() === '/plan') {
      activeMode = activeMode === MODES.PLAN ? null : MODES.PLAN;
      bus.emit(EVENTS.MODE_CHANGED, { activeMode });
      const msg = activeMode === MODES.PLAN
        ? '📋 Plan mode ON — responses will focus on planning and avoid mutations.'
        : 'Plan mode OFF.';
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (text?.trim() === '/auto') {
      autoMode = !autoMode;
      bus.emit(EVENTS.AUTO_MODE_CHANGED, { autoMode });
      const msg = autoMode
        ? '⚡ Auto mode ON — file changes apply without confirmation prompts.'
        : 'Auto mode OFF.';
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (text?.trim() === '/accept-edits') {
      acceptEdits = !acceptEdits;
      bus.emit(EVENTS.ACCEPT_EDITS_CHANGED, { acceptEdits });
      const msg = acceptEdits
        ? '✎ Accept-edits ON — file edits auto-approve; other actions are unaffected.'
        : 'Accept-edits OFF.';
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (text?.trim() === '/scan') {
      const scanResult = await discoverGuidance(config.workspaceDir || process.cwd());
      const msg = scanResult.found
        ? `Scanned local guidance docs. Found: ${scanResult.files.map(f => f.path).join(', ')} (${scanResult.total_chars} chars)`
        : 'Scanned local guidance docs. No guidance files found. Add DIRECTION.md or README.md to your workspace root.';
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (text?.trim() === '/guard') {
      guardMode = !guardMode;
      bus.emit(EVENTS.GUARD_MODE_CHANGED, { guardMode });
      const msg = guardMode
        ? '🛡 Guard mode ON — supervisor will review agent actions in real time.'
        : 'Guard mode OFF — supervisor disabled.';
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (!text?.trim()) return;

    const worker = new AgentWorker({
      id: 'main',
      bus,
      config,
      task: text,
      attachments,
      modes: { teachMode, activeMode, autoMode, acceptEdits, guardMode },
    });
    await worker.run();
  });
}
