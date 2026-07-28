/**
 * Confirmation gate: pause mutating tools, run_command, and network tools
 * (web_search, web_fetch) for user approval before they execute. autoApprove
 * (auto mode / accept-edits) bypasses the prompt deliberately. allowSet lets
 * the user grant "always allow" for a specific tool (file mutations, web
 * tools) or tool+command (run_command) for the rest of the session, without
 * granting blanket auto mode.
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { EVENTS } from '../core/eventBus.js';
import { executeTool } from './tools.js';
import { previewMutation } from './fileEdit.js';
import { safeWorkspacePath } from './pathSafety.js';
import { MCP_TOOL_PREFIX } from './toolRegistry.js';

const MUTATING_TOOLS = new Set(['create_file', 'write_file', 'edit_file']);
const NETWORK_TOOLS = new Set(['web_search', 'web_fetch']);
const GATED_TOOLS = new Set([...MUTATING_TOOLS, 'run_command', ...NETWORK_TOOLS]);
const MAX_CHECKPOINTS = 10;

// MCP tool side effects are unknown ahead of time (could be a GitHub write, a
// Postgres query, anything an external server implements) — so unlike the
// built-in set above, every MCP tool is gated, with no case-by-case judgment
// call about whether a given one is "safe".
function isMcpTool(tool) {
  return typeof tool === 'string' && tool.startsWith(MCP_TOOL_PREFIX);
}

/**
 * Snapshot a file's pre-write state into `checkpoints` (Task 2), grouped by
 * turnId so a turn that touches several files rewinds as one unit. Runs
 * regardless of whether the write was freshly approved or skipped via
 * allowSet, since either way disk is about to change.
 */
async function recordCheckpoint(checkpoints, turnId, filePath, cwd) {
  if (!checkpoints || !turnId || !filePath) return;
  const safety = await safeWorkspacePath(filePath, cwd);
  if (safety.error) return;
  const { resolved } = safety;
  const existed = existsSync(resolved);
  // readError is tracked separately from "file didn't exist" so /rewind can
  // tell the two apart — a failed read must not be restored as empty content.
  let before = null;
  let readError = null;
  if (existed) {
    try {
      before = await readFile(resolved, 'utf-8');
    } catch (err) {
      readError = err.message;
    }
  }

  let entry = checkpoints[checkpoints.length - 1];
  if (!entry || entry.turnId !== turnId) {
    entry = { turnId, timestamp: Date.now(), files: [] };
    checkpoints.push(entry);
    if (checkpoints.length > MAX_CHECKPOINTS) checkpoints.shift();
  }
  if (!entry.files.some((f) => f.path === resolved)) {
    entry.files.push({ path: resolved, before, existed, readError });
  }
}

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
  return GATED_TOOLS.has(tool) || isMcpTool(tool);
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
export async function maybeConfirmAndExecute(bus, tool, args = {}, cwd, { autoApprove = false, allowSet = null, checkpoints = null, turnId = null, webFetchMaxContentChars = null, mcpHandlers = null } = {}) {
  const toolOptions = { webFetchMaxContentChars, mcpHandlers };
  if (!isGatedTool(tool)) {
    return executeTool(tool, args, cwd, toolOptions);
  }

  const snapshotAndExecute = async () => {
    if (isMutatingTool(tool)) {
      await recordCheckpoint(checkpoints, turnId, args.filePath, cwd);
    }
    return executeTool(tool, args, cwd, toolOptions);
  };

  const key = allowKeyFor(tool, args);
  if (allowSet?.has(key)) {
    return snapshotAndExecute();
  }

  let preview;
  if (tool === 'run_command') {
    preview = { path: null, action: 'run_command', preview: `$ ${args.command}`, diffLines: null, overwrite: false };
  } else if (tool === 'web_search') {
    preview = { path: null, action: 'web_search', preview: `🔎 ${args.query}`, diffLines: null, overwrite: false };
  } else if (tool === 'web_fetch') {
    preview = { path: args.url || null, action: 'web_fetch', preview: `🌐 GET ${args.url}`, diffLines: null, overwrite: false };
  } else if (isMcpTool(tool)) {
    // Name/args are all we know about an MCP tool ahead of calling it — there's
    // no fixed set of per-tool preview branches like the built-ins above since
    // the tool itself is defined by whatever server the user configured.
    preview = { path: null, action: 'mcp_call', preview: `⚙ ${tool} ${JSON.stringify(args)}`, diffLines: null, overwrite: false };
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
      message:
        tool === 'run_command' ? 'User denied the command.'
        : NETWORK_TOOLS.has(tool) ? 'User denied the network request.'
        : isMcpTool(tool) ? 'User denied the tool call.'
        : 'User denied the file change.',
    };
  }

  if (choice === 'always' && allowSet) {
    allowSet.add(key);
    bus.emit(EVENTS.ALLOWED_TOOLS_CHANGED, { count: allowSet.size });
  }

  return snapshotAndExecute();
}
