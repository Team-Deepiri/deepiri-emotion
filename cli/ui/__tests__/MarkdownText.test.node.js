import { describe, it, expect } from 'vitest';
import { parseInline } from '../MarkdownText.js';

describe('parseInline', () => {
  it('returns plain text unchanged', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', content: 'hello world' }]);
  });

  it('returns empty array for empty string', () => {
    expect(parseInline('')).toEqual([]);
  });

  it('detects bold', () => {
    expect(parseInline('say **hello** there')).toEqual([
      { type: 'text', content: 'say ' },
      { type: 'bold', content: 'hello' },
      { type: 'text', content: ' there' }
    ]);
  });

  it('detects bold at start of string', () => {
    expect(parseInline('**bold** text')).toEqual([
      { type: 'bold', content: 'bold' },
      { type: 'text', content: ' text' }
    ]);
  });

  it('detects bold spanning full string', () => {
    expect(parseInline('**bold**')).toEqual([{ type: 'bold', content: 'bold' }]);
  });

  it('detects inline code', () => {
    expect(parseInline('run `npm install` first')).toEqual([
      { type: 'text', content: 'run ' },
      { type: 'code', content: 'npm install' },
      { type: 'text', content: ' first' }
    ]);
  });

  it('detects inline code spanning full string', () => {
    expect(parseInline('`someFunc()`')).toEqual([{ type: 'code', content: 'someFunc()' }]);
  });

  it('detects mixed bold and code', () => {
    expect(parseInline('**bold** and `code`')).toEqual([
      { type: 'bold', content: 'bold' },
      { type: 'text', content: ' and ' },
      { type: 'code', content: 'code' }
    ]);
  });

  it('handles multiple inline code segments', () => {
    const result = parseInline('use `foo` or `bar`');
    expect(result).toEqual([
      { type: 'text', content: 'use ' },
      { type: 'code', content: 'foo' },
      { type: 'text', content: ' or ' },
      { type: 'code', content: 'bar' }
    ]);
  });

  it('does not match unclosed backtick', () => {
    expect(parseInline('not `closed')).toEqual([{ type: 'text', content: 'not `closed' }]);
  });

  it('does not match unclosed bold', () => {
    expect(parseInline('not **closed')).toEqual([{ type: 'text', content: 'not **closed' }]);
  });
});
