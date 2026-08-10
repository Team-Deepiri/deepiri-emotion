import { describe, it, expect } from 'vitest';
import { findRememberedSection, pruneOldestBullets, MAX_REMEMBERED_BYTES } from '../runner.js';

describe('findRememberedSection', () => {
  it('returns null when no "## Remembered" heading exists', () => {
    expect(findRememberedSection('# Title\n\n## Conventions\nsome text\n')).toBeNull();
  });

  it('extracts the body between the heading and the next "## " heading', () => {
    const content = '# Title\n\n## Conventions\nuse tabs\n\n## Remembered\n- 2026-01-01: fact one\n- 2026-01-02: fact two\n\n## Later\nother stuff\n';
    const section = findRememberedSection(content);
    expect(section).not.toBeNull();
    expect(section.headingLine).toBe('## Remembered');
    expect(section.body).toContain('fact one');
    expect(section.body).toContain('fact two');
    expect(section.body).not.toContain('other stuff');
    expect(section.body).not.toContain('use tabs');
  });

  it('extracts to end of file when Remembered is the last section', () => {
    const content = '# Title\n\n## Remembered\n- 2026-01-01: fact one\n';
    const section = findRememberedSection(content);
    expect(section.body).toContain('fact one');
  });
});

describe('pruneOldestBullets', () => {
  it('leaves the body untouched when under the byte cap', () => {
    const body = '\n- 2026-01-01: small fact\n';
    const { body: pruned, dropped } = pruneOldestBullets(body, MAX_REMEMBERED_BYTES);
    expect(pruned).toBe(body);
    expect(dropped).toEqual([]);
  });

  it('drops the oldest dated bullets first until under the cap', () => {
    const bullets = [
      '- 2026-01-03: newest fact ' + 'x'.repeat(200),
      '- 2026-01-01: oldest fact ' + 'x'.repeat(200),
      '- 2026-01-02: middle fact ' + 'x'.repeat(200),
    ];
    const body = '\n' + bullets.join('\n') + '\n';
    const cap = 300; // forces at least one bullet to be dropped
    const { body: pruned, dropped } = pruneOldestBullets(body, cap);

    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped[0]).toContain('oldest fact');
    expect(pruned).toContain('newest fact');
    expect(Buffer.byteLength(pruned, 'utf-8')).toBeLessThanOrEqual(cap);
  });

  it('never touches non-bullet lines (freeform notes, blank lines)', () => {
    const body = `\nsome freeform note that is not a dated bullet ${'x'.repeat(300)}\n- 2026-01-01: old fact ${'x'.repeat(300)}\n`;
    const { body: pruned, dropped } = pruneOldestBullets(body, 100);
    expect(pruned).toContain('freeform note');
    expect(dropped).toEqual([expect.stringContaining('old fact')]);
  });
});
