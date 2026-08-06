import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, realpath } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildSymbolIndex,
  findReferences,
  impactAnalysis,
  invalidateSymbolIndexFile,
} from '../symbolIndex.js';

let dir;

beforeEach(async () => {
  const raw = join(tmpdir(), `symbol-index-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  await mkdir(raw, { recursive: true });
  dir = await realpath(raw);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true }).catch(() => {});
});

async function writeSource(relPath, content) {
  const full = join(dir, relPath);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, content, 'utf-8');
}

describe('buildSymbolIndex', () => {
  it('extracts named exports from a file', async () => {
    await writeSource('math.js', `export function add(a, b) { return a + b; }\nexport const PI = 3.14;\n`);
    const index = await buildSymbolIndex(dir);
    const entry = index.files.get('math.js');
    expect(entry.exports.map((e) => e.name).sort()).toEqual(['PI', 'add']);
  });

  it('resolves relative imports to workspace-relative paths', async () => {
    await writeSource('math.js', `export function add(a, b) { return a + b; }\n`);
    await writeSource('main.js', `import { add } from './math.js';\nadd(1, 2);\n`);
    const index = await buildSymbolIndex(dir);
    const entry = index.files.get('main.js');
    expect(entry.imports[0].resolved).toBe('math.js');
  });

  it('builds a reverse importedBy graph', async () => {
    await writeSource('math.js', `export function add(a, b) { return a + b; }\n`);
    await writeSource('main.js', `import { add } from './math.js';\nadd(1, 2);\n`);
    const index = await buildSymbolIndex(dir);
    expect(index.importedBy.get('math.js').has('main.js')).toBe(true);
  });

  it('does not resolve bare/package specifiers', async () => {
    await writeSource('main.js', `import React from 'react';\n`);
    const index = await buildSymbolIndex(dir);
    expect(index.files.get('main.js').imports[0].resolved).toBeNull();
  });

  it('skips unparseable files instead of failing the whole build', async () => {
    await writeSource('broken.js', `this is not valid js ((( `);
    await writeSource('fine.js', `export const ok = true;\n`);
    const index = await buildSymbolIndex(dir);
    expect(index.files.has('broken.js')).toBe(false);
    expect(index.files.has('fine.js')).toBe(true);
  });
});

describe('findReferences', () => {
  it('finds every identifier occurrence across files, with line numbers', async () => {
    await writeSource('math.js', `export function add(a, b) {\n  return a + b;\n}\n`);
    await writeSource('main.js', `import { add } from './math.js';\n\nconst result = add(1, 2);\n`);
    const result = await findReferences('add', dir);
    const files = result.references.map((r) => r.file).sort();
    // main.js: the import specifier "add", the local binding it introduces, and the call site
    // add(1, 2); math.js: the function declaration's own identifier.
    expect(files).toEqual(['main.js', 'main.js', 'main.js', 'math.js']);
    expect(result.count).toBe(4);
  });

  it('does not match names inside strings or comments', async () => {
    await writeSource('main.js', `// calls add somewhere\nconst s = "add";\n`);
    const result = await findReferences('add', dir);
    expect(result.count).toBe(0);
  });

  it('returns an empty result for a symbol with no references', async () => {
    await writeSource('main.js', `const x = 1;\n`);
    const result = await findReferences('nonexistent', dir);
    expect(result.count).toBe(0);
    expect(result.references).toEqual([]);
  });
});

describe('impactAnalysis', () => {
  it('reports the defining file and direct importers that reference the symbol', async () => {
    await writeSource('math.js', `export function add(a, b) { return a + b; }\n`);
    await writeSource('main.js', `import { add } from './math.js';\nadd(1, 2);\n`);
    const result = await impactAnalysis('add', dir);
    expect(result.definedIn).toEqual(['math.js']);
    const direct = result.impacted.find((r) => r.file === 'main.js');
    expect(direct.direct).toBe(true);
    expect(direct.referencesSymbol).toBe(true);
  });

  it('walks the transitive closure beyond direct importers', async () => {
    await writeSource('math.js', `export function add(a, b) { return a + b; }\n`);
    await writeSource('helper.js', `import { add } from './math.js';\nexport function sumAll(nums) { return nums.reduce(add); }\n`);
    await writeSource('app.js', `import { sumAll } from './helper.js';\nsumAll([1, 2, 3]);\n`);
    const result = await impactAnalysis('add', dir);
    const app = result.impacted.find((r) => r.file === 'app.js');
    expect(app).toBeDefined();
    expect(app.depth).toBe(2);
    expect(app.direct).toBe(false);
  });

  it('flags test files in the impacted set', async () => {
    await writeSource('math.js', `export function add(a, b) { return a + b; }\n`);
    await writeSource('__tests__/math.test.js', `import { add } from '../math.js';\nadd(1, 2);\n`);
    const result = await impactAnalysis('add', dir);
    const test = result.impacted.find((r) => r.file === '__tests__/math.test.js');
    expect(test.isTest).toBe(true);
  });
});

describe('invalidateSymbolIndexFile', () => {
  it('picks up a new export after a file is rewritten', async () => {
    await writeSource('math.js', `export function add(a, b) { return a + b; }\n`);
    await buildSymbolIndex(dir);

    await writeSource('math.js', `export function add(a, b) { return a + b; }\nexport function subtract(a, b) { return a - b; }\n`);
    await invalidateSymbolIndexFile(dir, 'math.js');

    const index = await buildSymbolIndex(dir);
    expect(index.files.get('math.js').exports.map((e) => e.name).sort()).toEqual(['add', 'subtract']);
  });

  it('drops stale importedBy edges when an import is removed', async () => {
    await writeSource('math.js', `export function add(a, b) { return a + b; }\n`);
    await writeSource('main.js', `import { add } from './math.js';\nadd(1, 2);\n`);
    await buildSymbolIndex(dir);

    await writeSource('main.js', `const x = 1;\n`);
    await invalidateSymbolIndexFile(dir, 'main.js');

    const index = await buildSymbolIndex(dir);
    expect(index.importedBy.get('math.js')?.has('main.js')).toBeFalsy();
  });
});
