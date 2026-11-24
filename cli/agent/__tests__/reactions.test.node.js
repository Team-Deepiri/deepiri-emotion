import { describe, it, expect } from 'vitest';
import {
  REACTIONS,
  REACTION_LIST,
  MEANING_PROMPT,
  resolveReaction,
  formatReactionHint,
} from '../reactions.js';

describe('resolveReaction', () => {
  it('resolves slash commands', () => {
    expect(resolveReaction('/like')?.id).toBe('like');
    expect(resolveReaction('/dislike')?.id).toBe('dislike');
    expect(resolveReaction('/retry')?.id).toBe('retry');
  });

  it('resolves empty-prompt keys', () => {
    expect(resolveReaction('y')?.id).toBe('like');
    expect(resolveReaction('N')?.id).toBe('dislike');
    expect(resolveReaction('r')?.id).toBe('retry');
  });

  it('ignores whitespace-only and unknown input', () => {
    expect(resolveReaction('')).toBeNull();
    expect(resolveReaction('   ')).toBeNull();
    expect(resolveReaction('/help')).toBeNull();
    expect(resolveReaction('yes')).toBeNull();
    expect(resolveReaction('/like please')).toBeNull();
  });

  it('maps each reaction to a Claude Code–style follow-up message', () => {
    expect(REACTIONS.like.text).toMatch(/^👍/);
    expect(REACTIONS.dislike.text).toMatch(/^👎/);
    expect(REACTIONS.retry.text).toMatch(/^🔁/);
  });
});

describe('formatReactionHint', () => {
  it('lists every reaction with its empty-prompt key', () => {
    const hint = formatReactionHint();
    for (const r of REACTION_LIST) {
      expect(hint).toContain(r.label);
      expect(hint).toContain(r.hint);
    }
    expect(hint).toMatch(/empty prompt/);
  });
});

describe('MEANING_PROMPT', () => {
  it('documents all three reactions for the system prompt', () => {
    expect(MEANING_PROMPT).toContain('👍');
    expect(MEANING_PROMPT).toContain('👎');
    expect(MEANING_PROMPT).toContain('🔁');
    expect(MEANING_PROMPT).toContain('/like');
  });
});
