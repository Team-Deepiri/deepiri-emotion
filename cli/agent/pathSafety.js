/**
 * Path safety helper for workspace operations.
 *
 * Verifies that a file path:
 *   1. Resolves within the workspace (containment check on the string form).
 *   2. Does not match blocked patterns (secrets, credentials, SSH keys, etc.).
 *   3. Does not escape the workspace via symlinks (containment check on realpath).
 *
 * Handles both existing files (realpath the file) and not-yet-existing files
 * (realpath the nearest existing ancestor) so that creation flows are supported.
 *
 * Returns { resolved } on success, { error } on rejection.
 */
import { realpath } from 'fs/promises';
import { resolve, isAbsolute, relative, dirname, sep } from 'path';

const BLOCKED_NAME_PATTERNS = [
  /^\.env$/i,
  /^\.env\./i,
  /secret/i,
  /credential/i,
  /private[_-]?key/i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa$/i,
  /^id_ed25519$/i,
  /^id_ecdsa$/i,
  /^id_dsa$/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
  /^\.pypirc$/i,
];

const BLOCKED_DIRS = new Set([
  '.git',
  'node_modules',
  '.ssh',
  '.aws',
  '.kube',
  '.docker',
  '.gcloud',
  '.terraform',
]);

function isBlockedDir(part) {
  return BLOCKED_DIRS.has(part.toLowerCase());
}

function isBlockedName(part) {
  return BLOCKED_NAME_PATTERNS.some((p) => p.test(part));
}

/**
 * Realpath the given path, or — if it does not exist — realpath the nearest
 * existing ancestor and append the remaining unresolved suffix.
 * Used to verify symlink containment even for files that have not been created yet.
 */
async function realFinalOrParent(path) {
  try {
    return await realpath(path);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  let parent = dirname(path);
  while (true) {
    try {
      const real = await realpath(parent);
      return real + path.slice(parent.length);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    const next = dirname(parent);
    if (next === parent) return path; // hit filesystem root
    parent = next;
  }
}

/**
 * Verify that a file path is safe to operate on within the workspace.
 *
 * @param {string} filePath - File path (absolute or relative to cwd).
 * @param {string} cwd - Workspace root directory.
 * @returns {Promise<{ resolved: string } | { error: string }>}
 */
export async function safeWorkspacePath(filePath, cwd) {
  if (!filePath || typeof filePath !== 'string') {
    return { error: 'filePath required' };
  }
  if (!cwd || typeof cwd !== 'string') {
    return { error: 'cwd required' };
  }

  // Canonicalize the workspace root (resolves symlinks in cwd itself).
  // Required because some platforms route tmpdir through symlinks (e.g. macOS).
  let canonicalCwd;
  try {
    canonicalCwd = await realpath(resolve(cwd));
  } catch (err) {
    return { error: `Could not resolve workspace root: ${err.message}` };
  }

  const resolved = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(canonicalCwd, filePath);

  // Containment check on the as-written path — catches "../" before any FS calls.
  const cwdWithSep = canonicalCwd.endsWith(sep) ? canonicalCwd : canonicalCwd + sep;
  if (!resolved.startsWith(cwdWithSep) && resolved !== canonicalCwd) {
    return { error: `Path resolves outside workspace: ${filePath}` };
  }

  // Per-component blocked pattern check (case-insensitive).
  const rel = relative(canonicalCwd, resolved);
  for (const part of rel.split(sep).filter(Boolean)) {
    if (isBlockedDir(part)) {
      return { error: `Editing inside ${part} is not allowed` };
    }
    if (isBlockedName(part)) {
      return { error: `File path matches a blocked pattern: ${part}` };
    }
  }

  // Symlink-escape check: the real path of the file (or its nearest existing
  // ancestor if the file does not yet exist) must stay within the workspace.
  let real;
  try {
    real = await realFinalOrParent(resolved);
  } catch (err) {
    return { error: `Path safety check failed: ${err.message}` };
  }
  if (!real.startsWith(cwdWithSep) && real !== canonicalCwd) {
    return { error: `Path resolves outside workspace via symlink: ${filePath}` };
  }

  return { resolved };
}
