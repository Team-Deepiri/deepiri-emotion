/**
 * Message reactions — lightweight feedback on the latest assistant turn.
 *
 * Empty-prompt keys (when idle): y = ok, n = miss, r = redo
 * Slash: /like, /dislike, /retry
 *
 * Sent as a normal user message; meanings live in MEANING_PROMPT.
 * Labels are plain TUI text (no emoji).
 */

export const REACTIONS = {
  like: {
    id: 'like',
    keys: ['y', 'Y'],
    slash: '/like',
    label: 'ok',
    hint: 'y',
    text: '[ok] Looks good — continue.',
  },
  dislike: {
    id: 'dislike',
    keys: ['n', 'N'],
    slash: '/dislike',
    label: 'miss',
    hint: 'n',
    text: '[miss] Wrong direction — try another approach.',
  },
  retry: {
    id: 'retry',
    keys: ['r', 'R'],
    slash: '/retry',
    label: 'redo',
    hint: 'r',
    text: '[redo] Do that again from scratch.',
  },
};

export const REACTION_LIST = Object.values(REACTIONS);

/** Short system-prompt block so the model knows what each reaction means. */
export const MEANING_PROMPT = `Message reactions (user may reply with these instead of a full message):
- [ok] / /like — approves the last reply, or says yes to a single yes/no question or one suggested next step. Do not pick between options or invent values. Do not approve anything the reply did not propose. Prefer continuing work over a "glad that helped" acknowledgment.
- [miss] / /dislike — the last reply missed: say what you will change, or ask one short question. Do not defend the previous approach at length.
- [redo] / /retry — redo the last piece of work as a fresh attempt, not a rewording.`;

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
  const keys = REACTION_LIST.map((r) => `[${r.hint}] ${r.label}`).join('  ');
  return `react  ${keys}`;
}
