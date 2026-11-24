/**
 * Message reactions — Claude Code–style lightweight feedback on the latest
 * assistant turn (inspired by the thumbs-reactions plugin / Claude.ai thumbs).
 *
 * Empty-prompt keys (when idle): y = like, n = dislike, r = retry
 * Slash: /like, /dislike, /retry
 *
 * Each reaction is sent as a normal user message so the next agent turn sees
 * it; meanings are also injected into the system prompt (see MEANING_PROMPT).
 */

export const REACTIONS = {
  like: {
    id: 'like',
    keys: ['y', 'Y'],
    slash: '/like',
    label: '👍',
    hint: 'y',
    text: '👍 Looks good, continue',
  },
  dislike: {
    id: 'dislike',
    keys: ['n', 'N'],
    slash: '/dislike',
    label: '👎',
    hint: 'n',
    text: "👎 That's not right — try another approach",
  },
  retry: {
    id: 'retry',
    keys: ['r', 'R'],
    slash: '/retry',
    label: '🔁',
    hint: 'r',
    text: '🔁 Try that again',
  },
};

export const REACTION_LIST = Object.values(REACTIONS);

/** Short system-prompt block so the model knows what each reaction means. */
export const MEANING_PROMPT = `Message reactions (user may reply with these instead of a full message):
- 👍 / /like — approves the last reply, or says yes to a single yes/no question or one suggested next step. Do not pick between options or invent values. Do not approve anything the reply did not propose. Prefer continuing work over a "glad that helped" acknowledgment.
- 👎 / /dislike — the last reply missed: say what you will change, or ask one short question. Do not defend the previous approach at length.
- 🔁 / /retry — redo the last piece of work as a fresh attempt, not a rewording.`;

/**
 * Resolve a bare keypress (empty prompt) or slash command to a reaction.
 * Returns null when it is not a reaction.
 */
export function resolveReaction(input) {
  const raw = (input || '').trim();
  if (!raw) return null;

  for (const r of REACTION_LIST) {
    if (r.slash === raw || r.keys.includes(raw)) return r;
  }
  return null;
}

/** Hint line shown under the latest assistant reply when reactions are available. */
export function formatReactionHint() {
  return REACTION_LIST.map((r) => `${r.label} ${r.hint}`).join('  ·  ') + '  (empty prompt)';
}
