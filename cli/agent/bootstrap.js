/**
 * Project auto-discovery: scans the workspace root for high-signal markers
 * (git, package manager, entrypoint, top-level dirs) and returns a concise
 * snapshot suitable for injection into the agent's system context.
 * Pure-ish — only reads, no writes. Silent on missing files.
 */
import { open, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { safeWorkspacePath } from './pathSafety.js';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage',
  '__pycache__', '.venv', 'venv', '.cache', 'target',
]);

const MAX_SNAPSHOT_BYTES = 2 * 1024;
const MAX_TOP_DIRS = 20;
const MAX_PACKAGE_JSON_BYTES = 256 * 1024;

/**
 * Path-safe + bounded read of a JSON file inside the workspace. Returns parsed
 * JSON or null. Streams up to MAX_PACKAGE_JSON_BYTES so a symlink-to-1GB-file
 * cannot OOM the process. Symlink escape and blocked patterns are also rejected.
 */
async function readJsonSafe(filename, cwd) {
  const safety = await safeWorkspacePath(filename, cwd);
  if (safety.error) return null;
  const path = safety.resolved;
  if (!existsSync(path)) return null;

  let handle;
  try {
    handle = await open(path, 'r');
    const buffer = Buffer.alloc(MAX_PACKAGE_JSON_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, MAX_PACKAGE_JSON_BYTES + 1, 0);
    if (bytesRead > MAX_PACKAGE_JSON_BYTES) return null; // unrealistically large; reject
    const raw = buffer.slice(0, bytesRead).toString('utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

async function listTopLevelDirs(cwd) {
  try {
    const entries = await readdir(cwd, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort()
      .slice(0, MAX_TOP_DIRS);
  } catch {
    return [];
  }
}

function detectPackageManagers(cwd) {
  const found = [];
  if (existsSync(join(cwd, 'package.json'))) found.push('npm');
  if (existsSync(join(cwd, 'pyproject.toml'))) found.push('python');
  if (existsSync(join(cwd, 'Cargo.toml'))) found.push('rust');
  if (existsSync(join(cwd, 'go.mod'))) found.push('go');
  if (existsSync(join(cwd, 'pom.xml'))) found.push('maven');
  if (existsSync(join(cwd, 'Gemfile'))) found.push('ruby');
  return found;
}

export async function bootstrapProject(cwd = process.cwd()) {
  const snapshot = {
    cwd,
    gitRoot: existsSync(join(cwd, '.git')),
    hasReadme: existsSync(join(cwd, 'README.md')) || existsSync(join(cwd, 'readme.md')),
    hasEmotionMd: existsSync(join(cwd, 'EMOTION.md')),
    packageManagers: detectPackageManagers(cwd),
    name: null,
    entrypoint: null,
    topDirs: [],
  };

  const pkg = await readJsonSafe('package.json', cwd);
  if (pkg) {
    if (typeof pkg.name === 'string') snapshot.name = pkg.name;
    if (typeof pkg.main === 'string') snapshot.entrypoint = pkg.main;
    else if (pkg.bin && typeof pkg.bin === 'object') {
      const firstBin = Object.values(pkg.bin)[0];
      if (typeof firstBin === 'string') snapshot.entrypoint = firstBin;
    }
  }

  snapshot.topDirs = await listTopLevelDirs(cwd);

  return snapshot;
}

/**
 * Format a snapshot as concise text suitable for system-prompt injection.
 * Returns a string capped at MAX_SNAPSHOT_BYTES.
 */
export function formatSnapshot(snapshot) {
  if (!snapshot) return '';
  const lines = [];
  if (snapshot.name) lines.push(`Project: ${snapshot.name}`);
  lines.push(`Workspace: ${snapshot.cwd}`);
  if (snapshot.gitRoot) lines.push('Git: yes');
  if (snapshot.packageManagers.length > 0) {
    lines.push(`Package managers: ${snapshot.packageManagers.join(', ')}`);
  }
  if (snapshot.entrypoint) lines.push(`Entrypoint: ${snapshot.entrypoint}`);
  if (snapshot.topDirs.length > 0) {
    lines.push(`Top-level dirs: ${snapshot.topDirs.join(', ')}`);
  }
  if (snapshot.hasReadme) lines.push('README.md: present');
  if (snapshot.hasEmotionMd) lines.push('EMOTION.md: present (loaded as project memory)');
  const text = lines.join('\n');
  return text.length > MAX_SNAPSHOT_BYTES ? text.slice(0, MAX_SNAPSHOT_BYTES) : text;
}
