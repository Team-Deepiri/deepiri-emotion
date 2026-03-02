/**
 * Run or preview current file — node, python, or open HTML in browser.
 */

export async function runOrPreview({ path: filePath, content, name }, projectRoot) {
  const api = window.electronAPI;
  if (!api?.runCommand) return { ok: false, message: 'Run not available' };

  const ext = (name || '').split('.').pop()?.toLowerCase();
  const cwd = projectRoot || undefined;

  if (ext === 'html') {
    try {
      if (api.openExternal) {
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(content || '');
        await api.openExternal(dataUrl);
        return { ok: true, message: 'Opened in browser' };
      }
      const isWin = typeof process !== 'undefined' && process.platform === 'win32';
      const isMac = typeof process !== 'undefined' && process.platform === 'darwin';
      const cmd = isWin ? `start "" "${filePath}"` : isMac ? `open "${filePath}"` : `xdg-open "${filePath}"`;
      await api.runCommand({ command: cmd, cwd });
      return { ok: true, message: 'Opening in browser' };
    } catch (e) {
      return { ok: false, message: e?.message || 'Failed to open' };
    }
  }

  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') {
    try {
      await api.runCommand({ command: `node "${filePath}"`, cwd });
      return { ok: true, message: 'Running in terminal' };
    } catch (e) {
      return { ok: false, message: e?.message || 'Run failed' };
    }
  }

  if (ext === 'py') {
    try {
      await api.runCommand({ command: `python "${filePath}"`, cwd });
      return { ok: true, message: 'Running in terminal' };
    } catch (e) {
      try {
        await api.runCommand({ command: `python3 "${filePath}"`, cwd });
        return { ok: true, message: 'Running in terminal' };
      } catch (e2) {
        return { ok: false, message: e2?.message || 'Python not found' };
      }
    }
  }

  return { ok: false, message: `Preview/run not supported for .${ext || 'unknown'}` };
}
