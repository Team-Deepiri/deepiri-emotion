/**
 * Bootstrap: CLI and process arguments.
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const isDev = process.argv.includes('--dev');

/** Dev renderer port: --renderer-port, RENDERER_DEV_PORT, or .dev-renderer-port file. */
export function getRendererDevPort() {
  const fromArg = process.argv.find((a) => a.startsWith('--renderer-port='));
  if (fromArg) return fromArg.slice('--renderer-port='.length);
  if (process.env.RENDERER_DEV_PORT) return String(process.env.RENDERER_DEV_PORT);
  const portFile = join(APP_ROOT, '.dev-renderer-port');
  if (existsSync(portFile)) {
    try {
      const p = readFileSync(portFile, 'utf8').trim();
      if (p) return p;
    } catch { /* ignore */ }
  }
  return '5173';
}

/**
 * Parse argv for optional folder/file to open (e.g. electron . -- /path/to/folder).
 * @returns {{ folder?: string, file?: string }}
 */
export function getLaunchArgs() {
  const args = process.argv.slice(process.defaultApp ? 2 : 1);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--' && args[i + 1]) {
      const path = args[i + 1];
      // simplistic: treat as folder if no extension or ends with /
      if (path.includes('.') && !path.endsWith('/')) {
        result.file = path;
      } else {
        result.folder = path.replace(/\/$/, '');
      }
      break;
    }
  }
  return result;
}
