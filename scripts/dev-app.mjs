#!/usr/bin/env node
/**
 * Start Vite renderer + Electron dev, picking the first free port from 5173 upward.
 * Override start: RENDERER_DEV_PORT=5180 npm run dev:app
 */
import { spawn } from 'child_process';
import net from 'net';
import { writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => {
      s.close(() => resolve(true));
    });
    s.listen(port, '127.0.0.1');
  });
}

async function pickPort(start = 5173) {
  const envPort = Number(process.env.RENDERER_DEV_PORT);
  if (envPort > 0) {
    if (await portFree(envPort)) return envPort;
    console.warn(`RENDERER_DEV_PORT=${envPort} is in use; scanning upward…`);
  }
  for (let p = start; p < start + 50; p++) {
    if (await portFree(p)) return p;
  }
  throw new Error(`No free port in range ${start}–${start + 49}`);
}

function run(cmd, args, env = {}) {
  return spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: false,
  });
}

const port = await pickPort();
const portFile = join(root, '.dev-renderer-port');
writeFileSync(portFile, String(port), 'utf8');
console.log(`Renderer dev server: http://localhost:${port}`);

const vite = run('npx', ['vite', '--port', String(port), '--strictPort', 'false'], {
  RENDERER_DEV_PORT: String(port),
});

function waitForVite() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 60_000;
    const tick = () => {
      fetch(`http://127.0.0.1:${port}/`)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() > deadline) reject(new Error('Vite did not become ready in time'));
          else setTimeout(tick, 300);
        });
    };
    tick();
  });
}

await waitForVite();

const electronArgs = ['electron', '.', '--dev', `--renderer-port=${port}`];
if (process.platform === 'linux') {
  electronArgs.push('--no-sandbox');
}
const electron = run('npx', electronArgs, {
  RENDERER_DEV_PORT: String(port),
});

function shutdown() {
  try {
    unlinkSync(portFile);
  } catch { /* ignore */ }
  vite.kill('SIGTERM');
  electron.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

electron.on('exit', (code) => {
  vite.kill('SIGTERM');
  process.exit(code ?? 0);
});
vite.on('exit', (code) => {
  if (code !== 0 && code != null) {
    electron.kill('SIGTERM');
    process.exit(code);
  }
});
