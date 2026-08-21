import { describe, it, expect } from 'vitest';
import { indexDiff } from '../reviewCommand.js';

const MODIFIED_DIFF = [
  'diff --git a/src/math.js b/src/math.js',
  'index 1234567..89abcde 100644',
  '--- a/src/math.js',
  '+++ b/src/math.js',
  '@@ -10,4 +10,6 @@ export function sum(values) {',
  '   let total = 0;',
  '-  for (let i = 0; i <= values.length; i++) {',
  '+  for (let i = 0; i < values.length; i++) {',
  '+    if (values[i] == null) continue;',
  '     total += values[i];',
  '   }',
  '',
].join('\n');

describe('indexDiff', () => {
  it('numbers added and context lines with their new-file line numbers', () => {
    const { annotated } = indexDiff(MODIFIED_DIFF);
    const lines = annotated.split('\n');

    expect(lines[0]).toBe('### FILE: src/math.js');
    expect(lines[1]).toBe('@@ -10,4 +10,6 @@ export function sum(values) {');
    expect(lines[2]).toMatch(/^\s+10\s+let total = 0;$/);
    // The removed line carries its OLD number (11) and a - marker.
    expect(lines[3]).toMatch(/^\s+11 - {3}for \(let i = 0; i <= values\.length; i\+\+\) \{$/);
    expect(lines[4]).toMatch(/^\s+11 \+ {3}for \(let i = 0; i < values\.length; i\+\+\) \{$/);
    expect(lines[5]).toMatch(/^\s+12 \+ {5}if \(values\[i\] == null\) continue;$/);
    expect(lines[6]).toMatch(/^\s+13\s+total \+= values\[i\];$/);
  });

  it('records citable and changed lines per file', () => {
    const { files, fileCount } = indexDiff(MODIFIED_DIFF);

    expect(fileCount).toBe(1);
    const entry = files.get('src/math.js');
    expect(entry.deleted).toBe(false);
    // Added lines are 11 and 12; context lines are 10, 13, 14.
    expect([...entry.changed].sort((a, b) => a - b)).toEqual([11, 12]);
    expect([...entry.lines].sort((a, b) => a - b)).toEqual([10, 11, 12, 13, 14]);
  });

  it('does not make removed lines citable in a modified file', () => {
    const { files } = indexDiff(MODIFIED_DIFF);
    // Old line 11 (the removed loop) coincides with new line 11, but nothing
    // in the index comes from the removal itself.
    const entry = files.get('src/math.js');
    expect(entry.changed.has(11)).toBe(true); // from the + line, not the - line
    expect(entry.lines.has(15)).toBe(false);
  });

  it('indexes multiple files independently', () => {
    const diff = [
      MODIFIED_DIFF,
      'diff --git a/README.md b/README.md',
      '--- a/README.md',
      '+++ b/README.md',
      '@@ -1,2 +1,3 @@',
      ' # Title',
      '+added docs line',
      '',
    ].join('\n');

    const { files, fileCount, annotated } = indexDiff(diff);
    expect(fileCount).toBe(2);
    expect([...files.keys()]).toEqual(['src/math.js', 'README.md']);
    expect([...files.get('README.md').changed]).toEqual([2]);
    expect(annotated).toContain('### FILE: README.md');
  });

  it('names a deleted file from the --- line and makes its old lines citable', () => {
    const diff = [
      'diff --git a/src/old.js b/src/old.js',
      'deleted file mode 100644',
      '--- a/src/old.js',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-const a = 1;',
      '-const b = 2;',
      '',
    ].join('\n');

    const { files, annotated } = indexDiff(diff);
    const entry = files.get('src/old.js');
    expect(entry.deleted).toBe(true);
    expect([...entry.changed].sort((a, b) => a - b)).toEqual([1, 2]);
    expect(annotated).toContain('### FILE: src/old.js (deleted)');
  });

  it('names a new file and numbers it from 1', () => {
    const diff = [
      'diff --git a/src/new.js b/src/new.js',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/src/new.js',
      '@@ -0,0 +1,2 @@',
      '+export const x = 1;',
      '+export const y = 2;',
      '',
    ].join('\n');

    const { files } = indexDiff(diff);
    const entry = files.get('src/new.js');
    expect(entry.deleted).toBe(false);
    expect([...entry.changed].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('unquotes paths containing spaces', () => {
    const diff = [
      'diff --git "a/src/my file.js" "b/src/my file.js"',
      '--- "a/src/my file.js"',
      '+++ "b/src/my file.js"',
      '@@ -1 +1 @@',
      '+const a = 1;',
      '',
    ].join('\n');

    expect([...indexDiff(diff).files.keys()]).toEqual(['src/my file.js']);
  });

  it('passes through non-hunk content and survives an empty diff', () => {
    expect(indexDiff('').fileCount).toBe(0);
    expect(indexDiff('').annotated).toBe('');

    const binary = [
      'diff --git a/logo.png b/logo.png',
      'Binary files a/logo.png and b/logo.png differ',
      '',
    ].join('\n');
    expect(indexDiff(binary).annotated).toContain('Binary files');
  });
});
