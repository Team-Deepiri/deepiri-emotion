/**
 * Extensions service: scan built-in extensions from extensions/ folder.
 */
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { app } from 'electron';
import { IPC } from '../../shared/ipcChannels.js';

function getExtensionsDir() {
  return join(app.getAppPath(), 'extensions');
}

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} _deps
 */
export function registerExtensionsService(ipcMain, _deps) {
  ipcMain.handle(IPC.LIST_EXTENSIONS, async () => {
    const list = [];
    const extDir = getExtensionsDir();
    try {
      const entries = await readdir(extDir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const pkgPath = join(extDir, e.name, 'package.json');
        let manifest;
        try {
          const raw = await readFile(pkgPath, 'utf-8');
          manifest = JSON.parse(raw);
        } catch {
          continue;
        }
        list.push({
          id: manifest.name || e.name,
          name: manifest.displayName || manifest.name || e.name,
          description: manifest.description || '',
          version: manifest.version || '1.0.0',
          enabled: true
        });
      }
    } catch {
      // no extensions folder or not readable
    }
    return list;
  });
}
