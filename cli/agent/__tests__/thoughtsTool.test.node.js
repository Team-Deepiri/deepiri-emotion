import { describe, it, expect } from 'vitest';
import { thoughtsTool } from '../thoughtsTool.js';

describe('thoughtsTool', () => {
  it('records a short thought and returns recorded: true', () => {
    const result = thoughtsTool({ thought: 'plan: read file then edit' });
    expect(result.error).toBeUndefined();
    expect(result.recorded).toBe(true);
    expect(result.thought).toBe('plan: read file then edit');
  });

  it('truncates thoughts longer than 50 chars and appends "..."', () => {
    const long = 'a'.repeat(75);
    const result = thoughtsTool({ thought: long });
    expect(result.recorded).toBe(true);
    expect(result.thought).toBe(`${'a'.repeat(50)}...`);
    expect(result.thought.length).toBe(53);
  });

  it('does NOT truncate when thought is exactly 50 chars', () => {
    const exact = 'b'.repeat(50);
    const result = thoughtsTool({ thought: exact });
    expect(result.thought).toBe(exact);
    expect(result.thought).not.toContain('...');
  });

  it('rejects empty string', () => {
    const result = thoughtsTool({ thought: '' });
    expect(result.error).toMatch(/non-empty string/);
  });

  it('rejects whitespace-only thought', () => {
    const result = thoughtsTool({ thought: '   \n\t  ' });
    expect(result.error).toMatch(/non-empty string/);
  });

  it('rejects non-string thought (number)', () => {
    const result = thoughtsTool({ thought: 42 });
    expect(result.error).toMatch(/non-empty string/);
  });

  it('rejects missing thought arg', () => {
    const result = thoughtsTool({});
    expect(result.error).toMatch(/non-empty string/);
  });

  it('rejects no args at all', () => {
    const result = thoughtsTool();
    expect(result.error).toMatch(/non-empty string/);
  });
});
