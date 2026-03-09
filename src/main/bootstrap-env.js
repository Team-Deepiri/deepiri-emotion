/**
 * Bootstrap: environment and paths for the main process.
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// App root is src/main -> src -> project root
const APP_ROOT = join(__dirname, '..', '..');
const SRC_DIR = join(APP_ROOT, 'src');

export const paths = {
  APP_ROOT,
  SRC_DIR,
  preload: join(SRC_DIR, 'preload.js'),
  distRenderer: join(SRC_DIR, '..', 'dist-renderer', 'index.html'),
  assets: join(SRC_DIR, '..', 'assets', 'icon.png')
};

// Helox: env or relative to common parent (Deepiri)
const DEEPIRI_ROOT = join(APP_ROOT, '..', '..');
export const defaultHeloxPath = join(DEEPIRI_ROOT, 'deepiri-platform', 'diri-helox');

export const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
export const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
export const CYREX_INTERFACE_URL = process.env.CYREX_INTERFACE_URL || 'http://localhost:5175';

export const desktopHeaders = {
  'Content-Type': 'application/json',
  'x-desktop-client': 'true',
  'x-api-key': process.env.PYAGENT_API_KEY || 'change-me'
};

export { __dirname, __filename };
