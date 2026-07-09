import { describe, it, expect } from 'vitest';
import { wordDeleteStart } from '../PromptInput.js';

describe('wordDeleteStart', () => {
  it('returns 0 when cursor is at the start', () => {
    expect(wordDeleteStart('hello world', 0)).toBe(0);
  });

  it('deletes back to the start of the current word', () => {
    expect(wordDeleteStart('hello world', 11)).toBe(6);
  });

  it('skips trailing whitespace before deleting the previous word', () => {
    expect(wordDeleteStart('hello   ', 8)).toBe(0);
  });

  it('deletes only the current partial word when cursor is mid-word', () => {
    expect(wordDeleteStart('hello wor', 9)).toBe(6);
  });

  it('treats multiple spaces between words correctly', () => {
    expect(wordDeleteStart('foo  bar', 8)).toBe(5);
  });

  it('returns 0 for a single word with no leading whitespace', () => {
    expect(wordDeleteStart('hello', 5)).toBe(0);
  });
});
