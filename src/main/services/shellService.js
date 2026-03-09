/**
 * Shell service: open-external, get-config, get-app-version.
 */
import { app, shell } from 'electron';
import { defaultHeloxPath, API_BASE_URL, AI_SERVICE_URL, CYREX_INTERFACE_URL } from '../bootstrap-env.js';
import { isDev } from '../bootstrap-args.js';
import { IPC } from '../../shared/ipcChannels.js';

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} _deps
 */
export function registerShellService(ipcMain, _deps) {
  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_event, url) => {
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC.GET_APP_VERSION, () => app.getVersion());

  ipcMain.handle(IPC.GET_CONFIG, () => {
    const heloxPath = process.env.HELOX_PATH || defaultHeloxPath;
    return {
      apiBaseUrl: API_BASE_URL,
      aiServiceUrl: AI_SERVICE_URL,
      cyrexInterfaceUrl: CYREX_INTERFACE_URL,
      heloxPath,
      isDev
    };
  });
}
