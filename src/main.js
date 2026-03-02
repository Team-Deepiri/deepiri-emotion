/**
 * Deepiri Desktop IDE - Main Process
 * Electron main process for the desktop IDE application
 */
import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile, readdir, mkdir, unlink, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve Helox path: env, or relative to repo (Deepiri/deepiri-platform/diri-helox)
const DEEPIRI_ROOT = join(__dirname, '..', '..', '..');
const defaultHeloxPath = join(DEEPIRI_ROOT, 'deepiri-platform', 'diri-helox');

// API Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const CYREX_INTERFACE_URL = process.env.CYREX_INTERFACE_URL || 'http://localhost:5175';

let mainWindow;
let isDev = process.argv.includes('--dev');
let projectRoot = null;
let heloxProcess = null;
let shellProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'Deepiri IDE',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      enableRemoteModule: false
    },
    icon: join(__dirname, '..', 'assets', 'icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  // Load the app: dev = Vite on 5173; prod = built renderer (packaged: app.asar/dist-renderer)
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererPath = join(__dirname, '..', 'dist-renderer', 'index.html');
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Task',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-task');
          }
        },
        {
          label: 'New Challenge',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            mainWindow.webContents.send('menu-new-challenge');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu-settings');
          }
        },
        { type: 'separator' },
        {
          role: 'quit'
        }
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
          click: () => {
            mainWindow.webContents.send('menu-gamification-dashboard');
          }
        },
        {
          label: 'Leaderboard',
          click: () => {
            mainWindow.webContents.send('menu-leaderboard');
          }
        },
        {
          label: 'Achievements',
          click: () => {
            mainWindow.webContents.send('menu-achievements');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            mainWindow.webContents.send('menu-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Common headers for desktop IDE identification
const desktopHeaders = {
  'Content-Type': 'application/json',
  'x-desktop-client': 'true',
  'x-api-key': process.env.PYAGENT_API_KEY || 'change-me'
};

// IPC Handlers for API communication
ipcMain.handle('api-request', async (event, { method, endpoint, data, headers = {} }) => {
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
      headers: {
        ...desktopHeaders,
        ...headers
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
});

ipcMain.handle('ai-request', async (event, { endpoint, data, headers = {} }) => {
  try {
    const response = await axios({
      method: 'POST',
      url: `${AI_SERVICE_URL}${endpoint}`,
      data,
      headers: {
        ...desktopHeaders,
        ...headers
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
});

ipcMain.handle('classify-task', async (event, { task, description }) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/task/classify`,
      { task, description },
      {
        headers: desktopHeaders
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
});

ipcMain.handle('generate-challenge', async (event, taskData) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/challenge/generate`,
      { task: taskData },
      {
        headers: desktopHeaders
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
});

// App version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Config for renderer (API URLs, Helox path, Cyrex UI URL)
ipcMain.handle('get-config', () => {
  const heloxPath = process.env.HELOX_PATH || defaultHeloxPath;
  return {
    apiBaseUrl: API_BASE_URL,
    aiServiceUrl: AI_SERVICE_URL,
    cyrexInterfaceUrl: CYREX_INTERFACE_URL,
    heloxPath,
    isDev
  };
});

// --- Tasks (proxy to platform API or local fallback) ---
ipcMain.handle('get-tasks', async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/tasks`, { headers: desktopHeaders });
    return { success: true, data: response.data || [] };
  } catch (error) {
    return { success: true, data: [] };
  }
});

ipcMain.handle('create-task', async (event, { title, description = '', type = 'manual' }) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/tasks`,
      { title, description, task_type: type },
      { headers: desktopHeaders }
    );
    return { success: true, data: response.data };
  } catch (error) {
    const fallback = { id: `local-${Date.now()}`, title, description, task_type: type };
    return { success: true, data: fallback };
  }
});

// --- Session ---
ipcMain.handle('start-session', async (event, userId) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/sessions`,
      { user_id: userId },
      { headers: desktopHeaders }
    );
    return response.data?.session_id || response.data?.id || `session-${Date.now()}`;
  } catch (error) {
    return `session-${Date.now()}`;
  }
});

ipcMain.handle('end-session', async () => {
  try {
    await axios.post(`${API_BASE_URL}/sessions/end`, {}, { headers: desktopHeaders });
    return { success: true };
  } catch (error) {
    return { success: true };
  }
});

ipcMain.handle('record-keystroke', async (event, { key, file, line, column }) => {
  try {
    await axios.post(
      `${API_BASE_URL}/session/record-keystroke`,
      { key, file, line, column },
      { headers: desktopHeaders }
    );
  } catch (error) {
    // no-op
  }
});

ipcMain.handle('record-file-change', async (event, { file, changeType, details }) => {
  try {
    await axios.post(
      `${API_BASE_URL}/session/record-file-change`,
      { file, change_type: changeType, details },
      { headers: desktopHeaders }
    );
  } catch (error) {
    // no-op
  }
});

// --- File system ---
ipcMain.handle('open-file', async (event, path) => {
  try {
    const content = await readFile(path, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(error.message || 'Failed to open file');
  }
});

ipcMain.handle('save-file', async (event, { path, content }) => {
  try {
    await writeFile(path, content, 'utf-8');
    return { success: true };
  } catch (error) {
    throw new Error(error.message || 'Failed to save file');
  }
});

ipcMain.handle('open-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) throw new Error('Canceled');
  projectRoot = result.filePaths[0];
  return projectRoot;
});

ipcMain.handle('get-project-root', () => projectRoot);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-renderer', 'build', '.next', '__pycache__', '.venv', 'venv']);
const TEXT_EXT = new Set(['js', 'jsx', 'ts', 'tsx', 'json', 'md', 'html', 'css', 'scss', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'yaml', 'yml', 'sh', 'bash', 'sql', 'xml', 'txt', 'log', 'env']);

async function searchInFolderRecursive(rootDir, query, opts, results, maxResults = 500) {
  if (results.length >= maxResults) return;
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  const caseSensitive = opts?.caseSensitive ?? false;
  const wholeWord = opts?.wholeWord ?? false;
  const q = caseSensitive ? query : query.toLowerCase();
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = wholeWord
    ? new RegExp(`\\b${escaped}\\b`, caseSensitive ? 'g' : 'gi')
    : new RegExp(escaped, caseSensitive ? 'g' : 'gi');

  for (const e of entries) {
    if (results.length >= maxResults) break;
    const fullPath = join(rootDir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await searchInFolderRecursive(fullPath, query, opts, results, maxResults);
    } else {
      const ext = e.name.split('.').pop()?.toLowerCase();
      if (!ext || !TEXT_EXT.has(ext)) continue;
      let content;
      try {
        content = await readFile(fullPath, 'utf-8');
      } catch {
        continue;
      }
      const lines = content.split('\n');
      for (let i = 0; i < lines.length && results.length < maxResults; i++) {
        const line = lines[i];
        let match;
        while ((match = re.exec(line)) !== null) {
          results.push({
            path: fullPath,
            name: e.name,
            line: i + 1,
            column: match.index + 1,
            text: line.trim().slice(0, 100)
          });
        }
      }
    }
  }
}

ipcMain.handle('search-in-folder', async (event, rootDir, query, opts = {}) => {
  const results = [];
  if (!rootDir || !query?.trim()) return results;
  await searchInFolderRecursive(rootDir, query.trim(), opts, results);
  return results;
});

// --- File system (for real file tree) ---
ipcMain.handle('list-directory', async (event, dirPath) => {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      path: join(dirPath, e.name),
      isDirectory: e.isDirectory()
    }));
  } catch (error) {
    throw new Error(error.message || 'Failed to list directory');
  }
});

ipcMain.handle('create-file', async (event, { dirPath, name }) => {
  const fullPath = join(dirPath, name);
  if (existsSync(fullPath)) throw new Error('File already exists');
  const parent = dirname(fullPath);
  await mkdir(parent, { recursive: true });
  await writeFile(fullPath, '', 'utf-8');
  return { path: fullPath };
});

ipcMain.handle('create-folder', async (event, { dirPath, name }) => {
  const fullPath = join(dirPath, name);
  if (existsSync(fullPath)) throw new Error('Folder already exists');
  await mkdir(fullPath, { recursive: true });
  return { path: fullPath };
});

ipcMain.handle('delete-path', async (event, targetPath) => {
  const s = await stat(targetPath);
  if (s.isDirectory()) {
    await rm(targetPath, { recursive: true });
  } else {
    await unlink(targetPath);
  }
  return { success: true };
});

ipcMain.handle('rename-path', async (event, { oldPath, newName }) => {
  const parent = dirname(oldPath);
  const newPath = join(parent, newName);
  if (existsSync(newPath)) throw new Error('Target already exists');
  const { rename } = await import('fs/promises');
  await rename(oldPath, newPath);
  return { path: newPath };
});

// --- Run shell command (for Terminal panel) ---
ipcMain.handle('run-command', async (event, { command, cwd }) => {
  const workDir = cwd || projectRoot || process.cwd();
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'cmd' : 'bash';
  const args = isWin ? ['/c', command] : ['-c', command];

  return new Promise((resolve, reject) => {
    shellProcess = spawn(cmd, args, {
      cwd: workDir,
      env: process.env,
      shell: false
    });
    shellProcess.stdout.on('data', (data) => {
      mainWindow?.webContents?.send('command-output', { type: 'stdout', text: data.toString() });
    });
    shellProcess.stderr.on('data', (data) => {
      mainWindow?.webContents?.send('command-output', { type: 'stderr', text: data.toString() });
    });
    shellProcess.on('close', (code, signal) => {
      shellProcess = null;
      mainWindow?.webContents?.send('command-exit', { code, signal });
      resolve({ code, signal });
    });
    shellProcess.on('error', (err) => {
      shellProcess = null;
      mainWindow?.webContents?.send('command-exit', { code: -1, error: err.message });
      reject(err);
    });
  });
});

ipcMain.handle('cancel-command', async () => {
  if (shellProcess) {
    shellProcess.kill('SIGTERM');
    shellProcess = null;
    return { success: true };
  }
  return { success: false };
});

// --- Gamification ---
ipcMain.handle('award-points', async (event, points) => {
  try {
    await axios.post(`${API_BASE_URL}/gamification/award`, { points }, { headers: desktopHeaders });
    return { success: true };
  } catch (error) {
    return { success: true };
  }
});

ipcMain.handle('get-gamification-state', async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/gamification/state`, { headers: desktopHeaders });
    return response.data || {};
  } catch (error) {
    return { points: 0, level: 1, streak: 0, badges: [] };
  }
});

// --- Challenge (local generate) ---
ipcMain.handle('generate-challenge-local', async (event, taskId) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/challenge/generate`,
      { task_id: taskId },
      { headers: desktopHeaders }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
});

// --- Integrations ---
ipcMain.handle('sync-github-issues', async (event, { repo = '', token = null }) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/integrations/github/sync`,
      { repo, token },
      { headers: desktopHeaders }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
});

// --- LLM / AI (Cyrex) ---
ipcMain.handle('get-llm-hint', async (event, { task }) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/hint`,
      { task },
      { headers: desktopHeaders }
    );
    return response.data?.hint || response.data || 'Hint unavailable';
  } catch (error) {
    return 'Hint generation unavailable';
  }
});

ipcMain.handle('complete-code', async (event, { code, language }) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/complete`,
      { code, language },
      { headers: desktopHeaders }
    );
    return response.data?.completion ?? code;
  } catch (error) {
    return code;
  }
});

// --- Helox pipelines ---
ipcMain.handle('run-helox-pipeline', async (event, { pipelineId, args = [], cwd: customCwd }) => {
  const heloxPath = process.env.HELOX_PATH || defaultHeloxPath;
  const cwd = customCwd || heloxPath;

  const scripts = {
    'full-training': ['scripts/pipelines/run_training_pipeline.py', []],
    'quick-train': ['scripts/pipelines/quick_train.sh', []],
    'rag-training': ['pipelines/training/rag_training_pipeline.py', ['--config', 'config.json']]
  };

  const [scriptRelative, defaultArgs] = scripts[pipelineId] || [pipelineId, args];
  const scriptPath = join(cwd, scriptRelative);
  const allArgs = defaultArgs.length ? defaultArgs : args;

  return new Promise((resolve, reject) => {
    const isPy = scriptPath.endsWith('.py');
    const cmd = isPy ? 'python3' : 'bash';
    const cmdArgs = isPy ? [scriptPath, ...allArgs] : [scriptPath, ...allArgs];

    heloxProcess = spawn(cmd, cmdArgs, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    heloxProcess.stdout.on('data', (data) => {
      mainWindow?.webContents?.send('helox-output', { type: 'stdout', text: data.toString() });
    });
    heloxProcess.stderr.on('data', (data) => {
      mainWindow?.webContents?.send('helox-output', { type: 'stderr', text: data.toString() });
    });
    heloxProcess.on('close', (code, signal) => {
      heloxProcess = null;
      mainWindow?.webContents?.send('helox-exit', { code, signal });
      resolve({ code, signal });
    });
    heloxProcess.on('error', (err) => {
      heloxProcess = null;
      mainWindow?.webContents?.send('helox-exit', { code: -1, error: err.message });
      reject(err);
    });
  });
});

ipcMain.handle('cancel-helox-pipeline', async () => {
  if (heloxProcess) {
    heloxProcess.kill('SIGTERM');
    heloxProcess = null;
    return { success: true };
  }
  return { success: false };
});

