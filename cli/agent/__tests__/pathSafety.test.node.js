import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, symlink, realpath } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { safeWorkspacePath } from '../pathSafety.js';

let dir;

beforeEach(async () => {
  const raw = join(tmpdir(), `path-safety-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  await mkdir(raw, { recursive: true });
  // Canonicalize the test workspace root so comparisons are stable across platforms
  // where tmpdir is routed through symlinks (e.g. macOS).
  dir = await realpath(raw);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true }).catch(() => {});
});

// ─── Containment ─────────────────────────────────────────────────────────────

describe('safeWorkspacePath - containment', () => {
  it('accepts a simple relative path inside workspace', async () => {
    const result = await safeWorkspacePath('file.js', dir);
    expect(result.error).toBeUndefined();
    expect(result.resolved).toBe(join(dir, 'file.js'));
  });

  it('accepts a nested relative path', async () => {
    const result = await safeWorkspacePath('sub/dir/file.js', dir);
    expect(result.error).toBeUndefined();
    expect(result.resolved).toBe(join(dir, 'sub/dir/file.js'));
  });

  it('accepts an absolute path inside workspace', async () => {
    const abs = join(dir, 'abs.js');
    const result = await safeWorkspacePath(abs, dir);
    expect(result.error).toBeUndefined();
    expect(result.resolved).toBe(abs);
  });

  it('rejects path traversal (..)', async () => {
    const result = await safeWorkspacePath('../escape.js', dir);
    expect(result.error).toMatch(/outside workspace/i);
  });

  it('rejects deep path traversal', async () => {
    const result = await safeWorkspacePath('sub/../../escape.js', dir);
    expect(result.error).toMatch(/outside workspace/i);
  });

  it('rejects absolute path outside workspace', async () => {
    const result = await safeWorkspacePath('/tmp/evil-target.js', dir);
    expect(result.error).toMatch(/outside workspace/i);
  });
});

// ─── Blocked file-name patterns ──────────────────────────────────────────────

describe('safeWorkspacePath - blocked file patterns', () => {
  it('rejects .env file', async () => {
    const result = await safeWorkspacePath('.env', dir);
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects .env.local file', async () => {
    const result = await safeWorkspacePath('.env.local', dir);
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects file with "secret" in name', async () => {
    const result = await safeWorkspacePath('my-secrets.json', dir);
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects file with "credential" in name', async () => {
    const result = await safeWorkspacePath('credentials.json', dir);
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects .pem file', async () => {
    const result = await safeWorkspacePath('server.pem', dir);
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects .key file', async () => {
    const result = await safeWorkspacePath('server.key', dir);
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects id_rsa file (SSH private key with no extension)', async () => {
    const result = await safeWorkspacePath('id_rsa', dir);
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects id_ed25519 file', async () => {
    const result = await safeWorkspacePath('id_ed25519', dir);
    expect(result.error).toMatch(/blocked/i);
  });

  it('rejects .npmrc file (npm auth tokens)', async () => {
    const result = await safeWorkspacePath('.npmrc', dir);
    expect(result.error).toMatch(/blocked/i);
  });
});

// ─── Blocked directory names ─────────────────────────────────────────────────

describe('safeWorkspacePath - blocked directories', () => {
  it('rejects path into .git', async () => {
    const result = await safeWorkspacePath('.git/config', dir);
    expect(result.error).toMatch(/\.git/);
  });

  it('rejects path into node_modules', async () => {
    const result = await safeWorkspacePath('node_modules/pkg/index.js', dir);
    expect(result.error).toMatch(/node_modules/);
  });

  it('rejects path into .ssh', async () => {
    const result = await safeWorkspacePath('.ssh/id_rsa', dir);
    expect(result.error).toMatch(/\.ssh/);
  });

  it('rejects path into .aws', async () => {
    const result = await safeWorkspacePath('.aws/credentials', dir);
    expect(result.error).toMatch(/\.aws/);
  });

  it('rejects path into .kube', async () => {
    const result = await safeWorkspacePath('.kube/config', dir);
    expect(result.error).toMatch(/\.kube/);
  });

  it('rejects case-insensitive Node_Modules', async () => {
    const result = await safeWorkspacePath('Node_Modules/pkg/index.js', dir);
    expect(result.error).toMatch(/node_modules/i);
  });

  it('rejects case-insensitive .GIT', async () => {
    const result = await safeWorkspacePath('.GIT/config', dir);
    expect(result.error).toMatch(/\.git/i);
  });
});

// ─── Symlinks ────────────────────────────────────────────────────────────────

describe('safeWorkspacePath - symlinks', () => {
  it('rejects a symlink pointing outside the workspace', async () => {
    const outsideTarget = join(tmpdir(), `outside-target-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.txt`);
    await writeFile(outsideTarget, 'sensitive', 'utf-8');

    const linkPath = join(dir, 'innocent.md');
    await symlink(outsideTarget, linkPath);

    try {
      const result = await safeWorkspacePath('innocent.md', dir);
      expect(result.error).toMatch(/symlink/i);
    } finally {
      await rm(outsideTarget, { force: true }).catch(() => {});
    }
  });

  it('accepts a symlink pointing inside the workspace', async () => {
    const insideTarget = join(dir, 'real-file.txt');
    await writeFile(insideTarget, 'content', 'utf-8');

    const linkPath = join(dir, 'alias.txt');
    await symlink(insideTarget, linkPath);

    const result = await safeWorkspacePath('alias.txt', dir);
    expect(result.error).toBeUndefined();
    expect(result.resolved).toBeDefined();
  });

  it('rejects a symlinked parent directory pointing outside (creation flow)', async () => {
    const outsideDir = join(tmpdir(), `outside-dir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await mkdir(outsideDir, { recursive: true });

    const linkedSubdir = join(dir, 'shadow');
    await symlink(outsideDir, linkedSubdir);

    try {
      const result = await safeWorkspacePath('shadow/new-file.txt', dir);
      expect(result.error).toMatch(/symlink/i);
    } finally {
      await rm(outsideDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

// ─── Non-existent files (creation flows) ─────────────────────────────────────

describe('safeWorkspacePath - non-existent files', () => {
  it('accepts a file that does not yet exist (creation case)', async () => {
    const result = await safeWorkspacePath('new-file.js', dir);
    expect(result.error).toBeUndefined();
    expect(result.resolved).toBeDefined();
  });

  it('accepts a deeply nested non-existent file', async () => {
    const result = await safeWorkspacePath('a/b/c/d/new.js', dir);
    expect(result.error).toBeUndefined();
    expect(result.resolved).toBeDefined();
  });
});

// ─── Input validation ────────────────────────────────────────────────────────

describe('safeWorkspacePath - input validation', () => {
  it('rejects empty filePath', async () => {
    const result = await safeWorkspacePath('', dir);
    expect(result.error).toBeDefined();
  });

  it('rejects null filePath', async () => {
    const result = await safeWorkspacePath(null, dir);
    expect(result.error).toBeDefined();
  });

  it('rejects undefined filePath', async () => {
    const result = await safeWorkspacePath(undefined, dir);
    expect(result.error).toBeDefined();
  });

  it('rejects non-string filePath', async () => {
    const result = await safeWorkspacePath(42, dir);
    expect(result.error).toBeDefined();
  });

  it('rejects empty cwd', async () => {
    const result = await safeWorkspacePath('file.js', '');
    expect(result.error).toBeDefined();
  });
});
