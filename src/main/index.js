/**
 * Main process orchestrator: window, menu, and service registration.
 */
import { BrowserWindow, ipcMain } from 'electron';
import { paths, desktopHeaders } from './bootstrap-env.js';
import { isDev, getLaunchArgs } from './bootstrap-args.js';
import { createMenu } from './menu.js';
import { createAgentRuntime } from '../agentRuntime.js';
import { createNeuralMemory } from '../neuralMemory.js';
import { IDE_CAPABILITIES } from '../capabilities.js';
import { registerWorkspaceService, getProjectRoot, setProjectRoot } from './services/workspaceService.js';
import { registerFileService } from './services/fileService.js';
import { registerTerminalService } from './services/terminalService.js';
import { registerAiService } from './services/aiService.js';
import { registerAgentService } from './services/agentService.js';
import { registerPlatformService } from './services/platformService.js';
import { registerHeloxService } from './services/heloxService.js';
import { registerShellService } from './services/shellService.js';
import { registerExtensionsService } from './services/extensionsService.js';
import { registerIntegrationService } from './services/integrationService.js';
import { registerDbService } from './services/dbService.js';

let mainWindow = null;

function getMainWindow() {
  return mainWindow;
}

export function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'Deepiri Emotion',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: paths.preload,
      enableRemoteModule: false
    },
    icon: paths.assets,
    titleBarStyle: 'default',
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(paths.distRenderer);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const wcId = mainWindow.webContents.id;
  mainWindow.webContents.on('destroyed', () => {
    if (typeof agentCleanup === 'function') {
      agentCleanup(wcId);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let agentCleanup = () => {};

/**
 * Create the app: window, menu, register all IPC services.
 */
export function createApp() {
  const agentRuntime = createAgentRuntime();
  const neuralMemory = createNeuralMemory();
  const ideAgentId = agentRuntime.registerAgent({ name: 'ide', version: '1.0.0' }, IDE_CAPABILITIES);

  createWindow();
  createMenu(getMainWindow);

  // CLI: open folder/file from argv (e.g. electron . -- /path/to/folder)
  const launchArgs = getLaunchArgs();
  if (launchArgs.folder) {
    setProjectRoot(launchArgs.folder);
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('project-root-changed', launchArgs.folder);
    });
  }
  if (launchArgs.file && mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('open-file-from-cli', launchArgs.file);
    });
  }

  registerWorkspaceService(ipcMain, { getMainWindow });
  registerFileService(ipcMain, {});
  registerTerminalService(ipcMain, { getMainWindow, getProjectRoot });
  registerAiService(ipcMain, { desktopHeaders, agentRuntime });
  const agentResult = registerAgentService(ipcMain, {
    agentRuntime,
    neuralMemory,
    ideAgentId,
    getMainWindow
  });
  if (agentResult && agentResult.cleanupRenderer) {
    agentCleanup = agentResult.cleanupRenderer;
  }
  registerPlatformService(ipcMain, { agentRuntime });
  registerHeloxService(ipcMain, { getMainWindow });
  registerShellService(ipcMain, {});
  registerExtensionsService(ipcMain, {});
  registerIntegrationService(ipcMain, {});
  registerDbService(ipcMain);
}
