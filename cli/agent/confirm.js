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

  // Dangerous shell commands always prompt — no bypass via /auto or /accept-edits.
  // (The supervisor is not always active; this is the last safety line.)
  const forcePrompt = tool === 'run_command' && isDangerousCommand(args.command);

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
    { autoApprove: forcePrompt ? false : autoApprove }
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
