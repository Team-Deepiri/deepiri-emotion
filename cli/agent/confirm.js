/**
 * Confirmation gate: pause mutating tools and run_command for user approval
 * before they execute. autoApprove (auto mode / accept-edits) bypasses the
 * prompt deliberately. allowSet lets the user grant "always allow" for a
 * specific tool (file mutations) or tool+command (run_command) for the rest
 * of the session, without granting blanket auto mode.
 */
import { EVENTS } from '../core/eventBus.js';
import { executeTool } from './tools.js';
import { previewMutation } from './fileEdit.js';

const MUTATING_TOOLS = new Set(['create_file', 'write_file', 'edit_file']);
const GATED_TOOLS = new Set([...MUTATING_TOOLS, 'run_command']);

export function isMutatingTool(tool) {
  return MUTATING_TOOLS.has(tool);
}

export function isGatedTool(tool) {
  return GATED_TOOLS.has(tool);
}

/** Session allow-key for a tool call: run_command remembers per-command, others per-tool. */
export function allowKeyFor(tool, args = {}) {
  return tool === 'run_command' ? `run_command:${(args.command || '').trim()}` : tool;
}

/**
 * Ask the UI to approve an action. Resolves 'once' | 'always' | 'deny'.
 * autoApprove short-circuits to 'once' without emitting a prompt.
 */
export function requestConfirmation(bus, payload = {}, { autoApprove = false } = {}) {
  if (autoApprove) return Promise.resolve('once');
  return new Promise((resolve) => {
    bus.once(EVENTS.CONFIRMATION_RESPONSE, ({ choice } = {}) => {
      // Fail closed: anything other than an explicit 'once'/'always' is a deny.
      resolve(choice === 'once' || choice === 'always' ? choice : 'deny');
    });
    bus.emit(EVENTS.CONFIRMATION_REQUEST, payload);
  });
}

/**
 * Execute a tool, gating mutating tools and run_command behind a confirmation
 * prompt. Other tools run directly. Returns the tool result, or
 * { denied: true, ... } if the user rejected the action.
 */
export async function maybeConfirmAndExecute(bus, tool, args = {}, cwd, { autoApprove = false, allowSet = null } = {}) {
  if (!isGatedTool(tool)) {
    return executeTool(tool, args, cwd);
  }

  const key = allowKeyFor(tool, args);
  if (allowSet?.has(key)) {
    return executeTool(tool, args, cwd);
  }

  let preview;
  if (tool === 'run_command') {
    preview = { path: null, action: 'run_command', preview: `$ ${args.command}`, diffLines: null, overwrite: false };
  } else {
    preview = await previewMutation(tool, args, cwd);
    if (preview.error) return { error: preview.error };
  }

  const choice = await requestConfirmation(
    bus,
    {
      tool,
      path: preview.path,
      action: preview.action,
      preview: preview.preview,
      diffLines: preview.diffLines,
      overwrite: preview.overwrite,
    },
    { autoApprove }
  );

  if (choice === 'deny') {
    return {
      denied: true,
      path: preview.path,
      message: tool === 'run_command' ? 'User denied the command.' : 'User denied the file change.',
    };
  }

  if (choice === 'always' && allowSet) {
    allowSet.add(key);
    bus.emit(EVENTS.ALLOWED_TOOLS_CHANGED, { count: allowSet.size });
  }

  return executeTool(tool, args, cwd);
}
