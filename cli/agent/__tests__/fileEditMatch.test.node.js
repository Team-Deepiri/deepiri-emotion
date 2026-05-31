import { describe, it, expect } from 'vitest';
import { findMatch } from '../fileEditMatch.js';

// ─── Layer 1: exact ───────────────────────────────────────────────────────────

describe('findMatch — exact strategy', () => {
  it('matches an exact unique substring with confidence 1', () => {
    const result = findMatch('const a = 1;\nconst b = 2;\n', 'const a = 1;');
    expect(result.error).toBeUndefined();
    expect(result.strategy).toBe('exact');
    expect(result.confidence).toBe(1);
    expect(result.index).toBe(0);
    expect(result.length).toBe('const a = 1;'.length);
  });

  it('returns ambiguous error and STOPS the chain on duplicate exact matches', () => {
    const result = findMatch('dup\ndup\n', 'dup');
    expect(result.error).toMatch(/2 times/);
    expect(result.strategy).toBeUndefined();
  });

  it('rejects empty oldString', () => {
    const result = findMatch('any content', '');
    expect(result.error).toMatch(/must not be empty/i);
  });
});

// ─── Layer 2: whitespace_normalized ──────────────────────────────────────────

describe('findMatch — whitespace_normalized strategy', () => {
  it('matches when the file has multiple spaces where oldString has one', () => {
    const file = 'const   a   =   1;';
    const result = findMatch(file, 'const a = 1;');
    expect(result.strategy).toBe('whitespace_normalized');
    expect(result.confidence).toBe(0.95);
    expect(result.index).toBe(0);
    expect(result.length).toBe(file.length);
  });

  it('matches when file uses tabs where oldString uses spaces', () => {
    const file = 'function\tfoo()\t{}';
    const result = findMatch(file, 'function foo() {}');
    expect(result.strategy).toBe('whitespace_normalized');
    expect(result.length).toBe(file.length);
  });

  it('matches across CRLF line endings when oldString uses LF', () => {
    const file = 'const a = 1;\r\nconst b = 2;';
    const result = findMatch(file, 'const a = 1;\nconst b = 2;');
    expect(result.strategy).toBe('whitespace_normalized');
  });

  it('handles indentation differences too — multi-line oldString matches indented file content', () => {
    const file = '    if (x) {\n      doSomething();\n    }';
    const result = findMatch(file, 'if (x) {\n  doSomething();\n}');
    // Layer 2's \s+ regex already handles indentation differences when tokens are unique.
    expect(result.strategy).toBe('whitespace_normalized');
    expect(result.index).toBe(4); // skips the leading 4 spaces
  });

  it('replaces the FILE span (not oldString length) when whitespace differs', () => {
    const file = 'foo   bar';
    const result = findMatch(file, 'foo bar');
    expect(result.length).toBe('foo   bar'.length);
  });
});

// ─── Layer 3: line_anchor ─────────────────────────────────────────────────────

describe('findMatch — line_anchor strategy', () => {
  it('wins when layer 2 has MULTIPLE matches but only one matches the line structure', () => {
    // The same token sequence 'function foo() { return 1; }' appears 3 times in
    // the file — twice on a single line, once across 3 lines. Layer 2's regex
    // matches all three (ambiguous), so falls through. Layer 3 only matches the
    // 3-line version because that's the only span whose trimmed lines line up.
    const file =
      'function foo() { return 1; }\n' +
      'function foo() {\n' +
      '    return 1;\n' +
      '}\n' +
      'function foo() { return 1; }';
    const oldString = 'function foo() {\nreturn 1;\n}';

    const result = findMatch(file, oldString);
    expect(result.strategy).toBe('line_anchor');
    expect(result.confidence).toBe(0.85);
    // Should land at the start of the 2nd line (the multi-line block).
    expect(result.index).toBe('function foo() { return 1; }\n'.length);
  });

  it('does not match when line content differs (not just whitespace)', () => {
    const file = '  doFoo();\n  doBaz();';
    const result = findMatch(file, 'doFoo();\ndoBar();');
    expect(result.error).toMatch(/not found/i);
  });
});

// ─── Strategy ordering ────────────────────────────────────────────────────────

describe('findMatch — strategy ordering', () => {
  it('prefers exact over whitespace_normalized when both would match', () => {
    const result = findMatch('const a = 1;', 'const a = 1;');
    expect(result.strategy).toBe('exact');
  });

  it('reports a clear error when all three strategies fail', () => {
    const result = findMatch('completely unrelated content here', 'something else entirely');
    expect(result.error).toMatch(/not found/i);
    expect(result.error).toMatch(/exact, whitespace-normalized, and line-anchor/);
  });
});
