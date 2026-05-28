import { describe, it, expect } from 'vitest';
import { detectSupportNeed } from '../support.js';

describe('detectSupportNeed', () => {
  it('returns none for empty string', () => {
    const r = detectSupportNeed('');
    expect(r).toEqual({ needsSupport: false, severity: 'none', signals: [] });
  });

  it('returns none for null', () => {
    const r = detectSupportNeed(null);
    expect(r).toEqual({ needsSupport: false, severity: 'none', signals: [] });
  });

  it('returns none for a calm technical question', () => {
    const r = detectSupportNeed('How do I read a file in the CLI?');
    expect(r.needsSupport).toBe(false);
    expect(r.severity).toBe('none');
    expect(r.signals).toHaveLength(0);
  });

  it('detects frustration keywords', () => {
    const r = detectSupportNeed('this is so frustrating, nothing works');
    expect(r.signals).toContain('frustration_keywords');
    expect(r.needsSupport).toBe(true);
  });

  it('detects frustration keywords case-insensitively', () => {
    const r = detectSupportNeed('UGH this is ridiculous');
    expect(r.signals).toContain('frustration_keywords');
  });

  it('detects panic keywords', () => {
    const r = detectSupportNeed('I have no idea what is going on please help');
    expect(r.signals).toContain('panic_keywords');
    expect(r.needsSupport).toBe(true);
  });

  it('detects cant figure variant', () => {
    const r = detectSupportNeed('cant figure this out');
    expect(r.signals).toContain('panic_keywords');
  });

  it('detects repeated punctuation (3+ consecutive)', () => {
    const r = detectSupportNeed('why is this broken???');
    expect(r.signals).toContain('excessive_punctuation');
  });

  it('detects excessive exclamation marks (5+)', () => {
    const r = detectSupportNeed('it happened again ! ! ! ! !');
    expect(r.signals).toContain('excessive_punctuation');
  });

  it('does not flag a single question mark', () => {
    const r = detectSupportNeed('How does this work?');
    expect(r.signals).not.toContain('excessive_punctuation');
  });

  it('detects all caps intensity (2+ long caps words)', () => {
    const r = detectSupportNeed('THIS DOES NOT WORK');
    expect(r.signals).toContain('all_caps_intensity');
  });

  it('ignores common acronyms in all caps check', () => {
    const r = detectSupportNeed('The API URL is returning 404');
    expect(r.signals).not.toContain('all_caps_intensity');
  });

  it('does not flag a single short caps word', () => {
    const r = detectSupportNeed('I need HELP with this');
    expect(r.signals).not.toContain('all_caps_intensity');
  });

  it('returns low severity for exactly 1 signal', () => {
    const r = detectSupportNeed('this is so frustrating');
    expect(r.severity).toBe('low');
    expect(r.signals).toHaveLength(1);
  });

  it('returns medium severity for 2+ signals', () => {
    const r = detectSupportNeed('THIS IS FRUSTRATING and I have no idea what is going on');
    expect(r.severity).toBe('medium');
    expect(r.signals.length).toBeGreaterThanOrEqual(2);
  });

  it('detects a repeated question word', () => {
    const r = detectSupportNeed("why doesn't this work and why won't it stop");
    expect(r.signals).toContain('repeat_question_pattern');
  });

  it('detects 3+ question marks spread across clauses', () => {
    const r = detectSupportNeed('why is this broken? how do I fix it? what should I do?');
    expect(r.signals).toContain('repeat_question_pattern');
  });

  it('detects multiple what questions', () => {
    const r = detectSupportNeed('what do I do? what is this? what is happening?');
    expect(r.signals).toContain('repeat_question_pattern');
  });

  it('does not flag a single well-formed question', () => {
    const r = detectSupportNeed('How do I read a file?');
    expect(r.signals).not.toContain('repeat_question_pattern');
  });
});
