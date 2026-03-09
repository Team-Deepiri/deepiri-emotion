/**
 * Terminal service: run-command, cancel-command (multi-terminal by terminalId).
 */
import { spawn } from 'child_process';
import { IPC } from '../../shared/ipcChannels.js';

/** @type {Map<string, import('child_process').ChildProcess>} */
const shellProcesses = new Map();

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ getMainWindow: () => import('electron').BrowserWindow | null, getProjectRoot: () => string | null }} deps
 */
export function registerTerminalService(ipcMain, deps) {
  const { getMainWindow, getProjectRoot } = deps;

  ipcMain.handle(IPC.RUN_COMMAND, async (event, { terminalId = 'default', command, cwd }) => {
    const workDir = cwd || getProjectRoot() || process.cwd();
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'cmd' : 'bash';
    const args = isWin ? ['/c', command] : ['-c', command];

    const existing = shellProcesses.get(terminalId);
    if (existing) {
      try {
        existing.kill('SIGTERM');
      } catch { /* process may already be gone */ }
      shellProcesses.delete(terminalId);
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd: workDir,
        env: process.env,
        shell: false
      });
      shellProcesses.set(terminalId, proc);
      const win = getMainWindow();
      proc.stdout.on('data', (data) => {
        win?.webContents?.send('command-output', { terminalId, type: 'stdout', text: data.toString() });
      });
      proc.stderr.on('data', (data) => {
        win?.webContents?.send('command-output', { terminalId, type: 'stderr', text: data.toString() });
      });
      proc.on('close', (code, signal) => {
        shellProcesses.delete(terminalId);
        win?.webContents?.send('command-exit', { terminalId, code, signal });
        resolve({ code, signal });
      });
      proc.on('error', (err) => {
        shellProcesses.delete(terminalId);
        win?.webContents?.send('command-exit', { terminalId, code: -1, error: err.message });
        reject(err);
      });
    });
  });

  ipcMain.handle(IPC.CANCEL_COMMAND, async (_event, terminalId) => {
    if (terminalId) {
      const proc = shellProcesses.get(terminalId);
      if (proc) {
        try {
          proc.kill('SIGTERM');
        } catch { /* ignore */ }
        shellProcesses.delete(terminalId);
        return { success: true };
      }
      return { success: false };
    }
    let cancelled = false;
    for (const [id, proc] of shellProcesses) {
      try {
        proc.kill('SIGTERM');
        cancelled = true;
      } catch { /* ignore */ }
      shellProcesses.delete(id);
    }
    return { success: cancelled };
  });
}
