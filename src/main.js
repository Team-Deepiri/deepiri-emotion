/**
 * Deepiri Emotion - Main Process (entry point)
 * Electron main process entry; delegates to main/index.js for window, menu, and services.
 */
import { app, BrowserWindow } from 'electron';
import { createApp, createWindow } from './main/index.js';

process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[main] unhandledRejection:', reason, promise);
});

app.whenReady().then(() => {
  createApp();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
