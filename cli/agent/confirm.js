/**
 * Confirmation gate: pause mutating tools for user Y/N approval before they write.
 * autoApprove (auto mode / accept-edits) bypasses the prompt deliberately.
 */
import { EVENTS } from '../core/eventBus.js';
import { executeTool } from './tools.js';
import { previewMutation } from './fileEdit.js';

const MUTATING_TOOLS = new Set(['create_file', 'write_file', 'edit_file']);

// Shell-command patterns that are irreversible or destructive enough to require
// explicit confirmation regardless of /auto or /accept-edits mode.
// Checked case-insensitively against the full command string.
const DANGEROUS_COMMAND_PATTERNS = [
  /rm\s+-[a-z]*r/i,          // rm -r, rm -rf, rm -fr …
  /rm\s+-[a-z]*f/i,          // rm -f (force delete)
  />\s*\/dev\/(sd|nvme|hd)/i, // overwriting block devices
  /mkfs/i,
  /\bdd\b/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-[a-z]*f/i, // git clean -f / -fd
  /git\s+push\s+.*--force/i,
  /chmod\s+-[a-z]*R/i,        // recursive chmod
  /chown\s+-[a-z]*R/i,        // recursive chown
  /truncate\b/i,
  /:>\s*\S/,                  // :> file (shell truncate)
  /\|\s*xargs\s+rm/i,
];

/**
 * Returns true if `command` matches any dangerous pattern.
 * @param {string} command
 * @returns {boolean}
 */
export function isDangerousCommand(command) {
  if (!command) return false;
  return DANGEROUS_COMMAND_PATTERNS.some((re) => re.test(command));
}

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
  // run_command: gate dangerous commands even in auto/accept-edits mode.
  // (The supervisor is not always active; this is the last safety line.)
  if (tool === 'run_command') {
    if (isDangerousCommand(args.command)) {
      const approved = await requestConfirmation(
        bus,
        {
          tool,
          path: null,
          action: 'run_command',
          preview: `$ ${args.command}`,
          overwrite: false,
        },
        { autoApprove: false }, // always prompt — no bypass for destructive commands
      );
      if (!approved) {
        return { denied: true, path: null, message: 'User denied the destructive command.' };
      }
    }
    return executeTool(tool, args, cwd);
  }

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
