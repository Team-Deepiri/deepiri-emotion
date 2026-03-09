/**
 * Helox service: run-helox-pipeline, cancel-helox-pipeline.
 */
import { spawn } from 'child_process';
import { join } from 'path';
import { defaultHeloxPath } from '../bootstrap-env.js';
import { IPC } from '../../shared/ipcChannels.js';

let heloxProcess = null;

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ getMainWindow: () => import('electron').BrowserWindow | null }} deps
 */
export function registerHeloxService(ipcMain, deps) {
  const { getMainWindow } = deps;

  ipcMain.handle(IPC.RUN_HELOX_PIPELINE, async (_event, { pipelineId, args = [], cwd: customCwd }) => {
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

      const win = getMainWindow();
      heloxProcess.stdout.on('data', (data) => {
        win?.webContents?.send('helox-output', { type: 'stdout', text: data.toString() });
      });
      heloxProcess.stderr.on('data', (data) => {
        win?.webContents?.send('helox-output', { type: 'stderr', text: data.toString() });
      });
      heloxProcess.on('close', (code, signal) => {
        heloxProcess = null;
        win?.webContents?.send('helox-exit', { code, signal });
        resolve({ code, signal });
      });
      heloxProcess.on('error', (err) => {
        heloxProcess = null;
        win?.webContents?.send('helox-exit', { code: -1, error: err.message });
        reject(err);
      });
    });
  });

  ipcMain.handle(IPC.CANCEL_HELOX_PIPELINE, async () => {
    if (heloxProcess) {
      heloxProcess.kill('SIGTERM');
      heloxProcess = null;
      return { success: true };
    }
    return { success: false };
  });
}
