/**
 * Voice-of-reason supervisor — a secondary LLM reviewer that inspects the
 * agent's proposed next tool call and can halt execution before it runs.
 *
 * On halt: the caller injects a [Supervisor] directive into agentContext so
 * the main agent turns to the user and asks how to continue rather than
 * blindly proceeding.
 *
 * Fail-open: any parse/stream/timeout failure defaults to { verdict: 'proceed' }
 * so the supervisor never bricks the main agent loop.
 */

const SUPERVISOR_SYSTEM_PROMPT = `You are a second-opinion reviewer for an AI coding agent.
You see the agent's context and the tool action it is about to execute.
Your job: decide whether this action should proceed or be halted for human review.

Respond ONLY with valid JSON — no markdown fences, no extra text:
{"verdict":"proceed","reason":"","suggestion":""}
OR
{"verdict":"halt","reason":"<concise reason>","suggestion":"<what agent should ask user>"}

HALT when the action is:
- Destructive or irreversible (rm -rf, delete, drop table, overwrite critical files)
- Clearly off-track from the user's stated goal
- Ambiguous in scope and risky enough that the user should decide first
- Targeting a production system, secret file, or outside the workspace

PROCEED for normal dev-workspace operations: reading files, searching, creating/editing source files, running build/test commands.

When in doubt, PROCEED. Only halt when genuinely concerned — false positives waste time.`;

/**
 * Review a proposed agent action.
 *
 * @param {{
 *   agentContext: string,
 *   lastResponse: string,
 *   toolIntent: { tool: string, args: object },
 *   config: object,
 *   streamLLM: Function,
 *   bus: object,
 * }} opts
 * @returns {Promise<{ verdict: 'proceed' | 'halt', reason: string, suggestion: string }>}
 */
export async function reviewAction({ agentContext, lastResponse, toolIntent, config, streamLLM, bus }) {
  const SAFE_DEFAULT = { verdict: 'proceed', reason: '', suggestion: '' };

  try {
    const toolSummary = `Tool: ${toolIntent.tool}\nArgs: ${JSON.stringify(toolIntent.args, null, 2)}`;
    // Limit context sent to the reviewer — keep it cheap and fast.
    const contextSnippet = (agentContext || '').slice(-2000);
    const reasoningSnippet = (lastResponse || '').slice(0, 800);

    const reviewPrompt = `${SUPERVISOR_SYSTEM_PROMPT}

[Agent context (last 2000 chars)]
${contextSnippet}

[Proposed action]
${toolSummary}

[Agent reasoning for this step]
${reasoningSnippet}

Respond ONLY with JSON.`;

    let raw = '';
    await streamLLM(bus, reviewPrompt, {
      config,
      silent: true,
      onToken: (tok) => { raw += tok; },
    });

    // Extract JSON — handle any surrounding prose or markdown code fences
    const jsonMatch = raw.match(/\{[\s\S]*?"verdict"[\s\S]*?\}/);
    if (!jsonMatch) return SAFE_DEFAULT;

    const parsed = JSON.parse(jsonMatch[0]);
    const verdict = parsed.verdict === 'halt' ? 'halt' : 'proceed';
    return {
      verdict,
      reason:     String(parsed.reason     || ''),
      suggestion: String(parsed.suggestion || ''),
    };
  } catch {
    // Fail-open: any error → proceed
    return SAFE_DEFAULT;
  }
}
