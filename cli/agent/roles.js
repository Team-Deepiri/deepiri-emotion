/**
 * Role definitions for specialized sub-agents.
 *
 * Delegation used to be keyed purely on provider/model — every sub-agent got
 * the same prompt and the same (read-only) tool set, which made a fan-out
 * really just "ask N models the same question". A role instead carries three
 * things: what the agent is for (systemPrompt), what it is allowed to touch
 * (allowedTools), and how much model it deserves (preferredTier).
 *
 * Deliberately pure data — no provider names, no config, no imports from the
 * tool layer. Provider selection is resolved separately against whatever the
 * user actually has enabled (see delegate.js); binding a role to a specific
 * provider here would break anyone whose delegateProviders allowlist doesn't
 * happen to include it.
 */

/**
 * Tools that only observe the workspace. Every role gets these — an agent that
 * can't read can't do anything useful.
 */
export const READ_ONLY_TOOLS = [
  'read_file',
  'search',
  'list_files',
  'git_status',
  'git_diff',
  'git_explain',
  'find_references',
  'impact_analysis',
  'thoughts',
];

/** Tools that change files on disk. */
export const WRITE_TOOLS = ['create_file', 'write_file', 'edit_file'];

/**
 * `delegate` is intentionally absent from every role's allowlist below. A
 * sub-agent that can delegate can spawn sub-agents that can delegate, and
 * neither the per-call target cap nor the per-agent timeout bounds *depth* —
 * only breadth at one level. Roles being unable to delegate is what keeps a
 * single prompt from fanning out geometrically.
 */
const ROLE_DEFINITIONS = {
  architect: {
    name: 'architect',
    summary: 'Designs the approach; does not write code',
    preferredTier: 'strong',
    allowedTools: [...READ_ONLY_TOOLS],
    systemPrompt: `You are the ARCHITECT on a multi-agent team.
Your job is to decide HOW a change should be made, not to make it.
- Map the affected code first — read the real files, don't guess at structure
- Name the specific files and functions that must change, and in what order
- Call out constraints, existing patterns to follow, and risks worth flagging
- Do NOT write or edit files; another agent implements from your design
Output a concrete, ordered plan that an implementer can follow without rereading the whole codebase.`,
  },

  implementer: {
    name: 'implementer',
    summary: 'Writes the actual code changes',
    preferredTier: 'strong',
    allowedTools: [...READ_ONLY_TOOLS, ...WRITE_TOOLS, 'run_command'],
    systemPrompt: `You are the IMPLEMENTER on a multi-agent team.
Your job is to make the change, not to redesign it.
- Read the surrounding code before editing so your change matches local style
- Prefer edit_file for targeted changes; use write_file only to replace a whole file
- Make the smallest change that fully does the job
- If the design you were handed is wrong, say so plainly rather than silently doing something else
Report exactly which files you changed and what each change does.`,
  },

  tester: {
    name: 'tester',
    summary: 'Writes and runs tests against a change',
    preferredTier: 'cheap',
    allowedTools: [...READ_ONLY_TOOLS, ...WRITE_TOOLS, 'run_command'],
    systemPrompt: `You are the TESTER on a multi-agent team.
Your job is to prove the change works and to find where it doesn't.
- Follow the existing test conventions in this repo rather than inventing your own
- Cover the boundaries: empty input, missing files, failure paths, not just the happy path
- Run the suite and report real output — never claim a test passes without running it
- A test that can't fail is worse than no test
Report which tests you added and the actual pass/fail result.`,
  },

  reviewer: {
    name: 'reviewer',
    summary: 'Critiques a change; has no write access by design',
    preferredTier: 'strong',
    allowedTools: [...READ_ONLY_TOOLS],
    systemPrompt: `You are the REVIEWER on a multi-agent team.
Your job is to find real defects in work another agent produced.
- You cannot edit files. Describe the fix; do not attempt to apply it
- Prioritise correctness bugs over style: wrong behavior, broken edge cases, bad error handling
- Quote the specific file and line your concern is about
- Say "no issues found" rather than inventing minor nits to look thorough
Report findings most-severe-first, each with a concrete failure scenario.`,
  },

  security: {
    name: 'security',
    summary: 'Audits a change for security problems; read-only',
    preferredTier: 'strong',
    allowedTools: [...READ_ONLY_TOOLS],
    systemPrompt: `You are the SECURITY reviewer on a multi-agent team.
Your job is to audit a change for security problems, not general code quality.
- You cannot edit files. Describe the fix; do not attempt to apply it
- Look for: injection, path traversal, unsafe shell interpolation, leaked secrets,
  missing authorization checks, unsafe deserialization, and dependency risk
- Judge exploitability, not theory — say how an attacker would actually reach it
- Say "no issues found" rather than padding the report
Report findings most-severe-first, each with a concrete attack path.`,
  },

  generalist: {
    name: 'generalist',
    summary: 'Fallback role for work that does not fit a specialist',
    preferredTier: 'cheap',
    allowedTools: [...READ_ONLY_TOOLS],
    systemPrompt: `You are a GENERALIST agent on a multi-agent team.
Answer the focused prompt you were given, directly and concisely.
- Read the real code before making claims about it
- Your answer is merged with other agents' output, so stay on your assigned piece
- Do not restate the whole task; report only what you found or concluded.`,
  },
};

/** The role used when a requested role is unknown or absent. */
export const DEFAULT_ROLE = 'generalist';

/** @returns {string[]} every valid role name. */
export function listRoleNames() {
  return Object.keys(ROLE_DEFINITIONS);
}

/** @returns {boolean} whether `name` is a defined role. */
export function isRole(name) {
  return typeof name === 'string' && Object.hasOwn(ROLE_DEFINITIONS, name);
}

/**
 * Look up a role by name, falling back to the generalist so a hallucinated
 * role name degrades into a working agent rather than failing the whole batch.
 * Returns a defensive copy: callers merge these into per-agent config, and a
 * shared mutable array would leak one agent's tweak into every later agent.
 * @param {string} name
 * @returns {{name: string, summary: string, preferredTier: string, allowedTools: string[], systemPrompt: string}}
 */
export function getRole(name) {
  // isRole (own-property) rather than a truthy lookup: ROLE_DEFINITIONS
  // inherits from Object.prototype, so a role named "constructor" or
  // "toString" would otherwise resolve to an inherited function and blow up
  // on .allowedTools. The role name comes from model output, so it is not
  // guaranteed to be one of ours.
  const role = isRole(name) ? ROLE_DEFINITIONS[name] : ROLE_DEFINITIONS[DEFAULT_ROLE];
  return { ...role, allowedTools: [...role.allowedTools] };
}

/**
 * Whether a role may call a given tool. MCP tools are always refused: a role's
 * allowlist is a static promise about what that agent can reach, and MCP tool
 * side effects are unknown ahead of time (an MCP "search" could be a GitHub
 * write), so they can't be judged safe for an unattended sub-agent.
 * @param {string} roleName
 * @param {string} tool
 */
export function isToolAllowedForRole(roleName, tool) {
  return getRole(roleName).allowedTools.includes(tool);
}

/**
 * One-line role descriptions for the parent agent's system prompt, so the
 * model picks from the real vocabulary instead of inventing role names.
 */
export function formatRolesForPrompt() {
  return listRoleNames()
    .map((n) => `            - ${n}: ${ROLE_DEFINITIONS[n].summary}`)
    .join('\n');
}
