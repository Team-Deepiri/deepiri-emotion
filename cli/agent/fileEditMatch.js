/**
 * Hybrid file-edit matcher.
 *
 * Replaces brittle exact-substring matching with a layered strategy:
 *   1. exact                 — literal indexOf (status quo). Confidence 1.00.
 *   2. whitespace_normalized — collapse whitespace runs; tabs/spaces/CRLF
 *                              all match \s+. Confidence 0.95.
 *   3. line_anchor           — compare trimmed line sequences; tolerates
 *                              leading/trailing whitespace and indentation
 *                              differences per line. Confidence 0.85.
 *
 * Each layer requires EXACTLY one match. Multiple exact matches stop the
 * chain immediately with an "ambiguous" error (loosening the matcher won't
 * disambiguate). Zero exact matches falls through to layer 2, and so on.
 *
 * Returns { index, length, strategy, confidence } on success, { error } on
 * failure. `index` is the start position in the ORIGINAL fileContent; `length`
 * is the matched span's length in the original (which may differ from
 * oldString.length when later layers matched a longer/wider region).
 */

const CONFIDENCE = {
  exact: 1.0,
  whitespace_normalized: 0.95,
  line_anchor: 0.85,
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text, pattern) {
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(pattern, idx)) !== -1) {
    count++;
    idx += pattern.length;
  }
  return count;
}

/** Layer 1 — exact substring. */
function tryExact(fileContent, oldString) {
  const occurrences = countOccurrences(fileContent, oldString);
  if (occurrences === 1) {
    return {
      index: fileContent.indexOf(oldString),
      length: oldString.length,
      strategy: 'exact',
      confidence: CONFIDENCE.exact,
    };
  }
  if (occurrences > 1) {
    return {
      error: `oldString appears ${occurrences} times. Provide more surrounding context to make it unique.`,
    };
  }
  return null;
}

/** Layer 2 — whitespace-normalized. Tabs/spaces/CRLF runs all match \s+. */
function tryWhitespaceNormalized(fileContent, oldString) {
  const trimmed = oldString.trim();
  if (trimmed.length === 0) return null;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return null;

  const pattern = tokens.map(escapeRegex).join('\\s+');
  let regex;
  try {
    regex = new RegExp(pattern, 'g');
  } catch {
    return null;
  }

  const matches = [];
  let m;
  while ((m = regex.exec(fileContent)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
    if (m.index === regex.lastIndex) regex.lastIndex++;
  }

  if (matches.length === 1) {
    return {
      ...matches[0],
      strategy: 'whitespace_normalized',
      confidence: CONFIDENCE.whitespace_normalized,
    };
  }
  return null;
}

/** Layer 3 — line-anchor. Match trimmed line sequence, span original lines. */
function tryLineAnchor(fileContent, oldString) {
  const oldLines = oldString.split('\n');
  const oldTrimmed = oldLines.map((l) => l.trim());

  if (oldTrimmed.every((l) => l === '')) return null;

  const fileLines = fileContent.split('\n');
  const fileTrimmed = fileLines.map((l) => l.trim());

  const matches = [];
  for (let i = 0; i + oldLines.length <= fileLines.length; i++) {
    let ok = true;
    for (let j = 0; j < oldLines.length; j++) {
      if (fileTrimmed[i + j] !== oldTrimmed[j]) {
        ok = false;
        break;
      }
    }
    if (ok) matches.push(i);
  }

  if (matches.length !== 1) return null;

  const startLine = matches[0];
  let charOffset = 0;
  for (let k = 0; k < startLine; k++) {
    charOffset += fileLines[k].length + 1;
  }
  let endOffset = charOffset;
  for (let k = 0; k < oldLines.length; k++) {
    endOffset += fileLines[startLine + k].length;
    if (k < oldLines.length - 1) endOffset += 1;
  }

  return {
    index: charOffset,
    length: endOffset - charOffset,
    strategy: 'line_anchor',
    confidence: CONFIDENCE.line_anchor,
  };
}

export function findMatch(fileContent, oldString) {
  if (typeof oldString !== 'string' || oldString.length === 0) {
    return { error: 'oldString must not be empty' };
  }

  const exact = tryExact(fileContent, oldString);
  if (exact) return exact;

  const wsn = tryWhitespaceNormalized(fileContent, oldString);
  if (wsn) return wsn;

  const la = tryLineAnchor(fileContent, oldString);
  if (la) return la;

  return {
    error: `oldString not found in file (tried exact, whitespace-normalized, and line-anchor strategies). No changes made.`,
  };
}
