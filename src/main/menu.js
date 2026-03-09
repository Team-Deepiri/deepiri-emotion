/**
 * Application menu (IDE-style).
 */
import { Menu } from 'electron';

/**
 * @param {() => import('electron').BrowserWindow | null} getMainWindow
 */
export function createMenu(getMainWindow) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => getMainWindow()?.webContents?.send('menu-new-file')
        },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: () => getMainWindow()?.webContents?.send('menu-open-folder')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => getMainWindow()?.webContents?.send('menu-save')
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => getMainWindow()?.webContents?.send('menu-settings')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Gamification',
      submenu: [
        {
          label: 'Dashboard',
          click: () => getMainWindow()?.webContents?.send('menu-gamification-dashboard')
        },
        {
          label: 'Leaderboard',
          click: () => getMainWindow()?.webContents?.send('menu-leaderboard')
        },
        {
          label: 'Achievements',
          click: () => getMainWindow()?.webContents?.send('menu-achievements')
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => getMainWindow()?.webContents?.send('menu-about')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
