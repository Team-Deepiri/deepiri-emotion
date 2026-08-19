/**
 * Workspace symbol index: exports, imports, and identifier references per
 * file, plus the derived import graph (who imports whom). Built with a real
 * parser (acorn + JSX) instead of text/regex search, so find_references and
 * impact analysis reflect actual code structure rather than string matches.
 *
 * Reuses fileIndex.js's tree walk (same blocked-dirs/name rules) but only
 * parses JS/JSX source files — the only syntax acorn understands here.
 *
 * Cached per cwd, keyed by file path, and invalidated one file at a time via
 * invalidateSymbolIndexFile() so a single edit doesn't force a full rebuild.
 */
import { readdir, readFile } from 'fs/promises';
import { join, relative, dirname, resolve, extname } from 'path';
import { existsSync } from 'fs';
import { Parser } from 'acorn';
import jsx from 'acorn-jsx';
import { BLOCKED_DIRS, isBlockedPathPart } from './pathSafety.js';

const MAX_FILES = 5000;
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs']);
const RESOLVE_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs'];
const TEST_PATH_RE = /(^|\/)__tests__\//;
const TEST_FILE_RE = /\.(test|spec)\.[cm]?jsx?$/;

const JsxParser = Parser.extend(jsx());

// { cwd, files: Map<relPath, FileEntry>, importedBy: Map<relPath, Set<relPath>>,
//   skippedFiles: Set<relPath>, fileLimitReached: boolean }
// FileEntry = { exports: [{name, line}], imports: [{source, resolved, specifiers, line}], references: Map<name, number[]> }
let cache = null;

async function walk(dir, cwd, results) {
  if (results.length >= MAX_FILES) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (results.length >= MAX_FILES) return;
    const name = entry.name;
    if (name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (BLOCKED_DIRS.has(name.toLowerCase())) continue;
      await walk(join(dir, name), cwd, results);
    } else if (entry.isFile()) {
      if (isBlockedPathPart(name)) continue;
      if (!SOURCE_EXTENSIONS.has(extname(name))) continue;
      results.push(relative(cwd, join(dir, name)));
    }
  }
}

/** Resolves a relative import specifier to a workspace-relative file path, or null if it can't be found (bare/package specifiers, missing files). */
function resolveImportSource(source, fromRelPath, cwd) {
  if (!source || !source.startsWith('.')) return null; // skip bare/package specifiers
  const fromDir = dirname(resolve(cwd, fromRelPath));
  const base = resolve(fromDir, source);

  const candidates = [];
  if (extname(base)) {
    candidates.push(base);
  } else {
    for (const ext of RESOLVE_EXTENSIONS) candidates.push(base + ext);
    for (const ext of RESOLVE_EXTENSIONS) candidates.push(join(base, 'index' + ext));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return relative(cwd, candidate);
  }
  return null;
}

function parseFile(source) {
  return JsxParser.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
    allowImportExportEverywhere: true,
  });
}

/**
 * Walks a parsed AST once, collecting exports, imports, and every Identifier
 * reference by name+line. Identifier-based (not text-based), so it doesn't
 * match names inside strings/comments the way grep does.
 */
function analyzeAst(ast, relPath, cwd) {
  const exports = [];
  const imports = [];
  const references = new Map();

  function addRef(name, line) {
    if (!references.has(name)) references.set(name, []);
    references.get(name).push(line);
  }

  function declName(node) {
    if (!node) return null;
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      return node.id ? node.id.name : null;
    }
    return null;
  }

  function visit(node) {
    if (!node || typeof node.type !== 'string') return;

    switch (node.type) {
      case 'Identifier':
        addRef(node.name, node.loc.start.line);
        break;

      case 'ImportDeclaration': {
        const source = node.source.value;
        const resolved = resolveImportSource(source, relPath, cwd);
        const specifiers = node.specifiers.map((s) => ({
          local: s.local.name,
          imported: s.type === 'ImportSpecifier' ? s.imported.name : (s.type === 'ImportDefaultSpecifier' ? 'default' : '*'),
        }));
        imports.push({ source, resolved, specifiers, line: node.loc.start.line });
        break;
      }

      case 'ExportNamedDeclaration': {
        if (node.declaration) {
          const name = declName(node.declaration);
          if (name) exports.push({ name, line: node.loc.start.line });
          if (node.declaration.type === 'VariableDeclaration') {
            for (const d of node.declaration.declarations) {
              if (d.id?.type === 'Identifier') exports.push({ name: d.id.name, line: node.loc.start.line });
            }
          }
        }
        for (const spec of node.specifiers || []) {
          exports.push({ name: spec.exported.name, line: node.loc.start.line });
        }
        break;
      }

      case 'ExportDefaultDeclaration': {
        const name = declName(node.declaration) || 'default';
        exports.push({ name, line: node.loc.start.line });
        break;
      }

      default:
        break;
    }

    for (const key in node) {
      if (key === 'loc' || key === 'range' || key === 'start' || key === 'end' || key === 'parent') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') visit(child);
        }
      } else if (value && typeof value.type === 'string') {
        visit(value);
      }
    }
  }

  visit(ast);
  return { exports, imports, references };
}

async function analyzeFile(relPath, cwd) {
  const absPath = join(cwd, relPath);
  let source;
  try {
    source = await readFile(absPath, 'utf-8');
  } catch {
    return null;
  }
  try {
    const ast = parseFile(source);
    return analyzeAst(ast, relPath, cwd);
  } catch {
    // Unparseable file (syntax error, unsupported syntax) — skip rather than
    // fail the whole index build.
    return null;
  }
}

function addToImportedBy(importedBy, definer, importer) {
  if (!importedBy.has(definer)) importedBy.set(definer, new Set());
  importedBy.get(definer).add(importer);
}

/** Builds (or returns the cached) symbol index for `cwd`. */
export async function buildSymbolIndex(cwd) {
  if (cache && cache.cwd === cwd) return cache;

  const relPaths = [];
  await walk(cwd, cwd, relPaths);
  const fileLimitReached = relPaths.length >= MAX_FILES;

  const files = new Map();
  const skippedFiles = new Set();
  for (const relPath of relPaths) {
    const entry = await analyzeFile(relPath, cwd);
    if (entry) files.set(relPath, entry);
    else skippedFiles.add(relPath);
  }

  const importedBy = new Map();
  for (const [relPath, entry] of files) {
    for (const imp of entry.imports) {
      if (imp.resolved) addToImportedBy(importedBy, imp.resolved, relPath);
    }
  }

  cache = { cwd, files, importedBy, skippedFiles, fileLimitReached };
  return cache;
}

/** Re-parses a single file and updates the cached index in place — call after any tool writes to `relPath`. */
export async function invalidateSymbolIndexFile(cwd, relPath) {
  if (!cache || cache.cwd !== cwd) return;

  // Drop this file's old outgoing edges before recomputing.
  const old = cache.files.get(relPath);
  if (old) {
    for (const imp of old.imports) {
      if (imp.resolved) cache.importedBy.get(imp.resolved)?.delete(relPath);
    }
  }

  const entry = await analyzeFile(relPath, cwd);
  if (!entry) {
    cache.files.delete(relPath);
    cache.skippedFiles.add(relPath);
    return;
  }
  cache.skippedFiles.delete(relPath);
  cache.files.set(relPath, entry);
  for (const imp of entry.imports) {
    if (imp.resolved) addToImportedBy(cache.importedBy, imp.resolved, relPath);
  }
}

/** Drops the whole cache — call if the workspace changes underneath a long-running session in ways invalidateSymbolIndexFile can't track (e.g. file deletion, external changes). */
export function invalidateSymbolIndex() {
  cache = null;
}

function isTestFile(relPath) {
  return TEST_PATH_RE.test(relPath) || TEST_FILE_RE.test(relPath);
}

/**
 * Human-readable note when the index is known to be incomplete — either
 * some files failed to parse (syntax error, unsupported syntax) or the
 * workspace has more source files than MAX_FILES. Surfaced on tool results
 * so the agent can flag potential gaps instead of treating results as exhaustive.
 */
function buildIndexWarning(index) {
  const parts = [];
  if (index.skippedFiles.size > 0) {
    parts.push(`${index.skippedFiles.size} file(s) could not be parsed and are excluded from this index`);
  }
  if (index.fileLimitReached) {
    parts.push(`workspace has more than ${MAX_FILES} source files; only the first ${MAX_FILES} were indexed`);
  }
  return parts.length > 0 ? `Index may be incomplete: ${parts.join('; ')}.` : null;
}

/**
 * Every actual reference to `symbol` across the workspace — identifier
 * occurrences from the AST, not fuzzy text matches. Returns a flat list
 * sorted by file then line, capped at `limit`.
 */
export async function findReferences(symbol, cwd, limit = 200) {
  const index = await buildSymbolIndex(cwd);
  const results = [];
  for (const [relPath, entry] of index.files) {
    const lines = entry.references.get(symbol);
    if (!lines) continue;
    for (const line of lines) results.push({ file: relPath, line });
  }
  results.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  return {
    symbol,
    count: results.length,
    references: results.slice(0, limit),
    truncated: results.length > limit,
    warning: buildIndexWarning(index),
  };
}

/**
 * Blast-radius query: files that define `symbol`, direct importers that
 * actually reference it, and the transitive closure of importers beyond
 * that — tests flagged separately. Flat ranked list, ranked by depth
 * (0 = direct), not a graph.
 */
export async function impactAnalysis(symbol, cwd, { maxDepth = 6, limit = 200 } = {}) {
  const index = await buildSymbolIndex(cwd);

  const definedIn = [];
  for (const [relPath, entry] of index.files) {
    if (entry.exports.some((e) => e.name === symbol)) definedIn.push(relPath);
  }

  const visited = new Set(definedIn);
  const results = [];
  let frontier = new Set(definedIn);
  let depth = 0;

  while (frontier.size > 0 && depth < maxDepth) {
    const next = new Set();
    for (const definer of frontier) {
      const importers = index.importedBy.get(definer);
      if (!importers) continue;
      for (const importer of importers) {
        if (visited.has(importer)) continue;
        visited.add(importer);
        const referencesSymbol = depth === 0 && (index.files.get(importer)?.references.get(symbol)?.length > 0);
        results.push({
          file: importer,
          depth: depth + 1,
          direct: depth === 0,
          referencesSymbol: !!referencesSymbol,
          isTest: isTestFile(importer),
        });
        next.add(importer);
      }
    }
    frontier = next;
    depth++;
  }

  results.sort((a, b) => a.depth - b.depth || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

  return {
    symbol,
    definedIn,
    count: results.length,
    impacted: results.slice(0, limit),
    truncated: results.length > limit,
    warning: buildIndexWarning(index),
  };
}
