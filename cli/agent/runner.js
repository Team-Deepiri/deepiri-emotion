/**
 * Agent runner: dispatch layer. Handles slash-commands and mode state,
 * then delegates each user turn to an AgentWorker instance.
 */
import { writeFile, unlink } from 'fs/promises';
import { EVENTS } from '../core/eventBus.js';
import { MODES } from '../core/modes.js';
import { formatCommandList } from '../core/commands.js';
import { discoverGuidance } from './guidance.js';
import { AgentWorker } from './AgentWorker.js';
import { listSessions, loadSession, latestSession } from './session.js';
import { streamLLM } from './llmStream.js';
import { estimateTokens, contextWindowFor } from '../core/tokens.js';
import {
  handleModelsCommand,
  handleProviderCommand,
  handleAccountCommand,
  handleSkillsCommand,
  handleStatusCommand,
} from './modelsCommand.js';

const AUTO_COMPACT_THRESHOLD = 0.8;

/**
 * @param {import('events').EventEmitter} bus
 * @param {Record<string,unknown>} [config] - CLI config (provider, keys, URLs)
 */
export function attachAgentRunner(bus, config = {}) {
  let teachMode        = config.teachMode        ?? false;
  let activeModes      = new Set();
  let autoMode         = config.autoMode         ?? false;
  let acceptEdits      = config.acceptEdits      ?? false;
  let guardMode        = config.supervisorEnabled ?? true;
  let currentWorker    = null;
  let queuedText = null;

  // Session-scoped "always allow" set (Task 5) — a tool (file mutations) or
  // tool+command (run_command) key added here is skipped by the confirmation
  // gate for the rest of the session. Reset only by restarting the CLI.
  config.allowSet = config.allowSet ?? new Set();

  // Checkpoints (Task 2) — one entry per turn that touched disk, capped at
  // the last 10 by confirm.js. turnHistoryIndex remembers how long `history`
  // was right before each turn, so /rewind can truncate memory back to match.
  config.checkpoints = config.checkpoints ?? [];
  let turnSeq = 0;
  const turnHistoryIndex = new Map();
  const beginTurn = () => {
    const turnId = ++turnSeq;
    config.currentTurnId = turnId;
    turnHistoryIndex.set(turnId, history.length);
    bus.emit(EVENTS.TURN_STARTED, { turnId });
    return turnId;
  };

  // Conversation memory (Task 1) — plain user/assistant turns, fed back into
  // each new AgentWorker's prompt so the agent isn't stateless turn-to-turn.
  // Slash-commands and /init's bootstrap task are deliberately not recorded
  // here; only real dialogue turns are.
  let history = [];
  let recording = false;
  let turnUserText = '';
  let turnBuffer = '';
  let compacting = false;

  const recomputeTokenUsage = () => {
    const serialized = history.map(m => `${m.role}: ${m.content}`).join('\n\n');
    const used = estimateTokens(serialized);
    const limit = contextWindowFor(config);
    bus.emit(EVENTS.TOKEN_USAGE_CHANGED, { used, limit });
    if (!compacting && limit > 0 && used / limit >= AUTO_COMPACT_THRESHOLD) {
      runCompact('auto');
    }
  };

  const runCompact = async (reason) => {
    if (compacting) return;
    if (history.length === 0) {
      if (reason === 'manual') {
        bus.emit(EVENTS.LLM_TOKEN, { token: 'Nothing to compact yet.' });
        bus.emit(EVENTS.LLM_DONE, {});
      }
      return;
    }
    compacting = true;
    bus.emit(EVENTS.AGENT_STATUS, { status: 'thinking', message: '🗜 Compacting conversation history...' });
    try {
      const serialized = history.map(m => `${m.role}: ${m.content}`).join('\n\n');
      let summary = '';
      await streamLLM(bus, `Summarize the following conversation concisely, preserving key facts, decisions, and any file paths or code discussed. Write a short paragraph, no preamble.\n\n${serialized}`, {
        config,
        silent: true,
        onToken: (token) => { summary += token; },
      });
      history = [{ role: 'system', content: `[Compacted summary of earlier conversation]\n${summary.trim()}` }];
      recomputeTokenUsage();
      const note = reason === 'auto'
        ? '🗜 Auto-compacted conversation history — it was getting close to the context limit.'
        : '🗜 Compacted conversation history into a summary.';
      bus.emit(EVENTS.LLM_TOKEN, { token: note });
      bus.emit(EVENTS.LLM_DONE, {});
    } catch (err) {
      bus.emit(EVENTS.AGENT_ERROR, { message: `Compact failed: ${err.message}` });
      bus.emit(EVENTS.LLM_DONE, {});
    } finally {
      compacting = false;
    }
  };

  bus.on(EVENTS.LLM_TOKEN, ({ token }) => {
    if (recording) turnBuffer += token;
  });

  bus.on(EVENTS.CANCEL_REQUESTED, () => {
    currentWorker?.cancel();
  });

  bus.on(EVENTS.MESSAGE_QUEUED, ({ text } = {}) => {
    queuedText = text || null;
  });

  // Picks up a queued message as the next turn once the current one has
  // actually finished — either a real (non-silent) completion, or a cancel.
  const dequeueAndSend = () => {
    if (!queuedText) return;
    const text = queuedText;
    queuedText = null;
    bus.emit(EVENTS.USER_MESSAGE, { text });
  };

  bus.on(EVENTS.LLM_DONE, ({ silent } = {}) => {
    if (silent) return;
    if (recording) {
      history.push({ role: 'user', content: turnUserText });
      history.push({ role: 'assistant', content: turnBuffer });
      recording = false;
      turnBuffer = '';
      recomputeTokenUsage();
    }
    dequeueAndSend();
  });

  bus.on(EVENTS.AGENT_CANCELLED, () => {
    recording = false;
    turnBuffer = '';
    dequeueAndSend();
  });

  bus.on(EVENTS.USER_MESSAGE, async ({ text, attachments = [] }) => {
    if (await handleModelsCommand(text || '', { bus, config })) return;
    if (await handleProviderCommand(text || '', { bus, config })) return;
    if (await handleAccountCommand(text || '', { bus, config })) return;
    if (await handleSkillsCommand(text || '', { bus, config })) return;
    if (await handleStatusCommand(text || '', { bus, config })) return;

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
      if (activeModes.has(MODES.DEBUG)) activeModes.delete(MODES.DEBUG);
      else activeModes.add(MODES.DEBUG);
      bus.emit(EVENTS.MODE_CHANGED, { activeModes: new Set(activeModes) });
      const msg = activeModes.has(MODES.DEBUG)
        ? '🔍 Debug mode ON — full step visibility enabled.'
        : 'Debug mode OFF.';
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (text?.trim() === '/plan') {
      if (activeModes.has(MODES.PLAN)) activeModes.delete(MODES.PLAN);
      else activeModes.add(MODES.PLAN);
      bus.emit(EVENTS.MODE_CHANGED, { activeModes: new Set(activeModes) });
      const msg = activeModes.has(MODES.PLAN)
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

    if (text?.trim() === '/clear') {
      bus.emit(EVENTS.CLEAR);
      // No token/response for this command, but LLM_DONE still must fire —
      // headless print mode (-p) waits on it to know the turn is over.
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (text?.trim() === '/compact') {
      await runCompact('manual');
      return;
    }

    const rewindMatch = text?.trim().match(/^\/rewind(?:\s+(\d+))?$/);
    if (rewindMatch) {
      const checkpoints = config.checkpoints || [];
      if (checkpoints.length === 0) {
        bus.emit(EVENTS.LLM_TOKEN, { token: '⏪ No checkpoints yet — nothing to rewind.' });
        bus.emit(EVENTS.LLM_DONE, {});
        return;
      }

      const newestFirst = [...checkpoints].reverse();

      if (!rewindMatch[1]) {
        const listing = newestFirst
          .map((cp, i) => {
            const names = cp.files.map((f) => f.path.split('/').pop()).join(', ');
            const when = new Date(cp.timestamp).toLocaleTimeString();
            return `  ${i + 1}. ${when} — ${names}`;
          })
          .join('\n');
        bus.emit(EVENTS.LLM_TOKEN, { token: `⏪ Recent checkpoints (newest first):\n${listing}\n\nUse /rewind <n> to restore.` });
        bus.emit(EVENTS.LLM_DONE, {});
        return;
      }

      const idx = Number(rewindMatch[1]);
      const target = newestFirst[idx - 1];
      if (!target) {
        bus.emit(EVENTS.LLM_TOKEN, { token: `⏪ No checkpoint #${idx}. Run /rewind to see the list.` });
        bus.emit(EVENTS.LLM_DONE, {});
        return;
      }

      // Restore each snapshotted file. The path was already validated by
      // safeWorkspacePath when the checkpoint was captured, and we're only
      // writing back content that was already on disk at that time.
      const restoreFailures = [];
      for (const f of target.files) {
        try {
          if (f.existed) {
            if (f.before === null) {
              // Original content couldn't be read when the checkpoint was taken
              // (e.g. a permissions error) — skip rather than overwrite with ''.
              restoreFailures.push(`${f.path} (original content unavailable${f.readError ? `: ${f.readError}` : ''})`);
              continue;
            }
            await writeFile(f.path, f.before, 'utf-8');
          } else {
            await unlink(f.path);
          }
        } catch (err) {
          restoreFailures.push(`${f.path} (${err.message})`);
        }
      }

      const targetPos = checkpoints.indexOf(target);
      config.checkpoints = checkpoints.slice(0, targetPos);
      const keepHistoryLen = turnHistoryIndex.get(target.turnId) ?? history.length;
      history = history.slice(0, keepHistoryLen);
      recomputeTokenUsage();

      bus.emit(EVENTS.REWIND, { turnId: target.turnId });
      if (restoreFailures.length) {
        bus.emit(EVENTS.AGENT_ERROR, { message: `⏪ Rewind incomplete — could not restore: ${restoreFailures.join(', ')}` });
      }
      const restoredCount = target.files.length - restoreFailures.length;
      bus.emit(EVENTS.LLM_TOKEN, { token: `⏪ Rewound — restored ${restoredCount} of ${target.files.length} file(s) and dropped that turn from the conversation.` });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (text?.trim() === '/init') {
      const snapshotText = config.projectSnapshot || '(no snapshot available)';
      const bootstrapTask = `Scan this workspace and write a starter EMOTION.md capturing project memory for future sessions.

Use this auto-discovered snapshot as a starting point, but verify/expand on it by reading key files (e.g. package.json, README.md, top-level source dirs) as needed:

${snapshotText}

EMOTION.md should include, in this order:
1. Project overview — what this project is and does, in 2-3 sentences.
2. Key directories — the main source dirs and what lives in each.
3. Conventions — coding conventions, testing approach, and anything a new contributor should know.

Keep it concise (aim for well under 100 lines). When ready, write it with create_file to EMOTION.md at the workspace root. Do not ask clarifying questions — make reasonable inferences from what you find.`;

      beginTurn();
      const initWorker = new AgentWorker({
        id: 'main',
        bus,
        config,
        task: bootstrapTask,
        modes: { teachMode, activeModes: new Set(activeModes), autoMode, acceptEdits, guardMode },
      });
      currentWorker = initWorker;
      try {
        await initWorker.run();
      } finally {
        if (currentWorker === initWorker) currentWorker = null;
      }
      return;
    }

    if (text?.trim() === '/help') {
      bus.emit(EVENTS.LLM_TOKEN, { token: formatCommandList() });
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

    // /resume — load conversation history from a previous session
    // /resume       → loads the most recent session
    // /resume list  → lists the 5 most recent sessions
    // /resume <id>  → loads a specific session by id
    const resumeMatch = text?.trim().match(/^\/resume(?:\s+(.+))?$/);
    if (resumeMatch) {
      const arg = (resumeMatch[1] || '').trim();
      const sessionsCwd = config.workspaceDir || process.cwd();

      if (arg === 'list') {
        const sessions = await listSessions(sessionsCwd, 5);
        const msg = sessions.length === 0
          ? '📂 No prior sessions found in this workspace.'
          : `📂 Recent sessions (newest first):\n${sessions
              .map(s => `  ${s.id} — ${s.messageCount} messages — ${s.firstUserPreview || '(no user message)'}`)
              .join('\n')}\n\nUse /resume <id> to load one.`;
        bus.emit(EVENTS.LLM_TOKEN, { token: msg });
        bus.emit(EVENTS.LLM_DONE, {});
        return;
      }

      const result = arg
        ? await loadSession(sessionsCwd, arg)
        : await latestSession(sessionsCwd);

      if (result.error || result.found === false) {
        const msg = result.error
          ? `📂 Could not resume: ${result.error}`
          : '📂 No prior sessions to resume.';
        bus.emit(EVENTS.LLM_TOKEN, { token: msg });
        bus.emit(EVENTS.LLM_DONE, {});
        return;
      }

      const session = result.session || result;
      const turns = (session.messages || []).slice(-10);
      const summary = turns
        .map(m => `${m.role}: ${(m.content || '').slice(0, 200)}`)
        .join('\n');
      const msg = `📂 Resumed session ${session.id} — ${session.messages?.length ?? 0} messages restored. Last ${turns.length} turns:\n${summary}`;
      bus.emit(EVENTS.LLM_TOKEN, { token: msg });
      bus.emit(EVENTS.LLM_DONE, {});
      return;
    }

    if (!text?.trim()) return;

    recording = true;
    turnUserText = text;
    turnBuffer = '';
    beginTurn();

    const worker = new AgentWorker({
      id: 'main',
      bus,
      config,
      task: text,
      attachments,
      modes: { teachMode, activeModes: new Set(activeModes), autoMode, acceptEdits, guardMode },
      history,
    });
    currentWorker = worker;
    try {
      await worker.run();
    } finally {
      if (currentWorker === worker) currentWorker = null;
    }
  });
}
