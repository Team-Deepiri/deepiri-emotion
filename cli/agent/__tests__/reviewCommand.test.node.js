import { describe, it, expect } from 'vitest';
import {
  indexDiff,
  buildReviewPrompt,
  parseReviewResponse,
  validateFindings,
} from '../reviewCommand.js';

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

describe('buildReviewPrompt', () => {
  it('lists the changed files and embeds the numbered diff', () => {
    const prompt = buildReviewPrompt(indexDiff(MODIFIED_DIFF));
    expect(prompt).toContain('FILES CHANGED:\n- src/math.js');
    expect(prompt).toContain('### FILE: src/math.js');
    expect(prompt).toContain('STAGED changes');
    expect(prompt).toContain('empty findings array');
  });

  it('says so when reviewing unstaged work', () => {
    const prompt = buildReviewPrompt(indexDiff(MODIFIED_DIFF), { mode: 'unstaged' });
    expect(prompt).toContain('UNCOMMITTED working-tree changes');
    expect(prompt).not.toContain('STAGED changes');
  });

  it('warns the reviewer not to speculate about a truncated diff', () => {
    const prompt = buildReviewPrompt(indexDiff(MODIFIED_DIFF), { truncated: true });
    expect(prompt).toContain('truncated');
    expect(prompt).toContain('do not speculate');
  });
});

describe('parseReviewResponse', () => {
  const finding = { severity: 'bug', file: 'src/math.js', line: 11, confidence: 'high', title: 't', detail: 'd', fix: 'f' };

  it('parses a clean JSON object', () => {
    const result = parseReviewResponse(JSON.stringify({ findings: [finding] }));
    expect(result.error).toBeUndefined();
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ severity: 'bug', file: 'src/math.js', line: 11, confidence: 'high' });
  });

  it('parses through markdown fences and surrounding prose', () => {
    const raw = `Sure, here's the review:\n\`\`\`json\n${JSON.stringify({ findings: [finding] })}\n\`\`\`\nHope that helps!`;
    expect(parseReviewResponse(raw).findings).toHaveLength(1);
  });

  it('accepts a bare array', () => {
    expect(parseReviewResponse(JSON.stringify([finding])).findings).toHaveLength(1);
  });

  it('treats an empty findings list as a clean review, not an error', () => {
    const result = parseReviewResponse('{"findings":[]}');
    expect(result.error).toBeUndefined();
    expect(result.findings).toEqual([]);
  });

  it('reports an error when there is no JSON at all', () => {
    expect(parseReviewResponse('I could not review this.').error).toMatch(/parse/i);
    expect(parseReviewResponse('').error).toMatch(/parse/i);
  });

  it('maps severity synonyms and defaults an unknown confidence to medium', () => {
    const raw = JSON.stringify({ findings: [
      { severity: 'correctness', file: 'a.js', line: 1, title: 'x', confidence: 'pretty sure' },
      { severity: 'vulnerability', file: 'a.js', line: 1, title: 'y' },
      { severity: 'wat', file: 'a.js', line: 1, title: 'z' },
    ] });
    const { findings } = parseReviewResponse(raw);
    expect(findings.map((f) => f.severity)).toEqual(['bug', 'security', 'other']);
    expect(findings[0].confidence).toBe('medium');
  });

  it('drops entries with no title and no detail', () => {
    const raw = JSON.stringify({ findings: [{ severity: 'bug', file: 'a.js', line: 1 }, finding] });
    expect(parseReviewResponse(raw).findings).toHaveLength(1);
  });
});

describe('validateFindings', () => {
  const { files } = indexDiff(MODIFIED_DIFF);
  const base = { severity: 'bug', confidence: 'high', title: 't', detail: 'd', fix: '' };

  it('keeps a finding that cites a real file and a line in the diff', () => {
    const { findings, dropped } = validateFindings([{ ...base, file: 'src/math.js', line: 12 }], files);
    expect(dropped).toEqual([]);
    expect(findings[0]).toMatchObject({ file: 'src/math.js', line: 12, lineAdjusted: false });
  });

  it('drops a finding that cites a file not in the diff', () => {
    const { findings, dropped } = validateFindings([{ ...base, file: 'src/invented.js', line: 12 }], files);
    expect(findings).toEqual([]);
    expect(dropped[0].reason).toMatch(/not in the diff/);
  });

  it('resolves a bare basename to the one matching changed file', () => {
    const { findings } = validateFindings([{ ...base, file: 'math.js', line: 11 }], files);
    expect(findings[0].file).toBe('src/math.js');
  });

  it('snaps an out-of-range line onto the nearest line in the diff and flags it', () => {
    const { findings } = validateFindings([{ ...base, file: 'src/math.js', line: 400 }], files);
    expect(findings[0].line).toBe(14);
    expect(findings[0].lineAdjusted).toBe(true);
  });

  it('points a finding with no line at the first changed line', () => {
    const { findings } = validateFindings([{ ...base, file: 'src/math.js', line: null }], files);
    expect(findings[0].line).toBe(11);
    expect(findings[0].lineAdjusted).toBe(true);
  });

  it('drops low-confidence findings that are not a real severity', () => {
    const nitpick = { ...base, severity: 'other', confidence: 'low', file: 'src/math.js', line: 11 };
    const { findings, dropped } = validateFindings([nitpick], files);
    expect(findings).toEqual([]);
    expect(dropped[0].reason).toMatch(/nitpick/);
  });

  it('keeps a low-confidence finding when it names a real severity', () => {
    const hunch = { ...base, severity: 'security', confidence: 'low', file: 'src/math.js', line: 11 };
    expect(validateFindings([hunch], files).findings).toHaveLength(1);
  });

  it('orders by severity, then by confidence within a severity', () => {
    const input = [
      { ...base, severity: 'tests', file: 'src/math.js', line: 11 },
      { ...base, severity: 'bug', confidence: 'medium', file: 'src/math.js', line: 11 },
      { ...base, severity: 'security', file: 'src/math.js', line: 11 },
      { ...base, severity: 'bug', confidence: 'high', file: 'src/math.js', line: 11 },
    ];
    const { findings } = validateFindings(input, files);
    expect(findings.map((f) => `${f.severity}/${f.confidence}`))
      .toEqual(['bug/high', 'bug/medium', 'security/high', 'tests/high']);
  });
});
