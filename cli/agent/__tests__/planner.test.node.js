import { describe, it, expect } from 'vitest';
import { createSimplePlan, isSimpleChatTurn } from '../planner.js';

describe('isSimpleChatTurn', () => {
  it('treats short greetings as simple chat', () => {
    const plan = createSimplePlan('hi');
    expect(isSimpleChatTurn('hi', plan)).toBe(true);
    expect(isSimpleChatTurn('e', plan)).toBe(true);
    expect(isSimpleChatTurn('thanks!', createSimplePlan('thanks!'))).toBe(true);
  });

  it('rejects code-ish or tool-needing turns', () => {
    expect(isSimpleChatTurn('find where auth is', createSimplePlan('find where auth is'))).toBe(false);
    expect(isSimpleChatTurn('read package.json', createSimplePlan('read package.json'))).toBe(false);
    expect(isSimpleChatTurn('fix the bug in runner', createSimplePlan('fix the bug in runner'))).toBe(false);
  });

  it('rejects long messages', () => {
    const long = 'a'.repeat(300);
    expect(isSimpleChatTurn(long, createSimplePlan(long))).toBe(false);
  });
});
