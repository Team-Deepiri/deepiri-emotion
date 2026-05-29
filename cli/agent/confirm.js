/**
 * Confirmation gate: pause mutating tools for user Y/N approval before they write.
 * autoApprove (auto mode / accept-edits) bypasses the prompt deliberately.
 */
import { EVENTS } from '../core/eventBus.js';
import { executeTool } from './tools.js';
import { previewMutation } from './fileEdit.js';

const MUTATING_TOOLS = new Set(['create_file', 'write_file', 'edit_file']);

export function isMutatingTool(tool) {
  return MUTATING_TOOLS.has(tool);
}

/**
 * Ask the UI to approve an action. Resolves true (approved) or false (denied).
 * autoApprove short-circuits to true without emitting a prompt.
 */
export function requestConfirmation(bus, payload = {}, { autoApprove = false } = {}) {
  if (autoApprove) return Promise.resolve(true);
  return new Promise((resolve) => {
    bus.once(EVENTS.CONFIRMATION_RESPONSE, ({ approved } = {}) => resolve(!!approved));
    bus.emit(EVENTS.CONFIRMATION_REQUEST, payload);
  });
}

/**
 * Execute a tool, gating mutating tools behind a confirmation prompt.
 * Non-mutating tools run directly. Returns the tool result, or
 * { denied: true, ... } if the user rejected the change.
 */
export async function maybeConfirmAndExecute(bus, tool, args = {}, cwd, { autoApprove = false } = {}) {
  if (!isMutatingTool(tool)) {
    return executeTool(tool, args, cwd);
  }

  const preview = await previewMutation(tool, args, cwd);
  if (preview.error) return { error: preview.error };

  const approved = await requestConfirmation(
    bus,
    {
      tool,
      path: preview.path,
      action: preview.action,
      preview: preview.preview,
      overwrite: preview.overwrite,
    },
    { autoApprove }
  );

  if (!approved) {
    return { denied: true, path: preview.path, message: 'User denied the file change.' };
  }

  return executeTool(tool, args, cwd);
}
