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

  it('maps each reaction to a plain tagged follow-up (no emoji)', () => {
    expect(REACTIONS.like.text).toMatch(/^\[ok\]/);
    expect(REACTIONS.dislike.text).toMatch(/^\[miss\]/);
    expect(REACTIONS.retry.text).toMatch(/^\[redo\]/);
    for (const r of REACTION_LIST) {
      expect(r.text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
      expect(r.label).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
  });
});

describe('formatReactionHint', () => {
  it('lists every reaction as [key] label with no emoji', () => {
    const hint = formatReactionHint();
    expect(hint).toMatch(/^react\s+/);
    for (const r of REACTION_LIST) {
      expect(hint).toContain(`[${r.hint}] ${r.label}`);
    }
    expect(hint).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});

describe('MEANING_PROMPT', () => {
  it('documents all three reactions for the system prompt', () => {
    expect(MEANING_PROMPT).toContain('[ok]');
    expect(MEANING_PROMPT).toContain('[miss]');
    expect(MEANING_PROMPT).toContain('[redo]');
    expect(MEANING_PROMPT).toContain('/like');
    expect(MEANING_PROMPT).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
