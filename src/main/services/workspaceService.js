/**
 * Workspace service: project root state and open-project dialog.
 */
import { dialog } from 'electron';
import { IPC } from '../../shared/ipcChannels.js';

let projectRoot = null;

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ getMainWindow: () => import('electron').BrowserWindow | null }} deps
 */
export function registerWorkspaceService(ipcMain, deps) {
  const { getMainWindow } = deps;

  ipcMain.handle(IPC.OPEN_PROJECT, async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win || undefined, {
      properties: ['openDirectory']
    });
    if (result.canceled) throw new Error('Canceled');
    projectRoot = result.filePaths[0];
    return projectRoot;
  });

  ipcMain.handle(IPC.SET_PROJECT_ROOT, (_event, path) => {
    if (path && typeof path === 'string') projectRoot = path;
    return projectRoot;
  });

  ipcMain.handle(IPC.GET_PROJECT_ROOT, () => projectRoot);
}

export function getProjectRoot() {
  return projectRoot;
}

export function setProjectRoot(path) {
  if (path && typeof path === 'string') projectRoot = path;
  return projectRoot;
}
