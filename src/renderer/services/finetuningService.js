/**
 * Helox fine-tuning from the IDE — start training runs, list runs.
 * Calls main process / Helox when configured.
 */

export async function startFineTuning({ datasetPath, baseModel, outputName, epochs = 3 }) {
  const api = window.electronAPI;
  if (api?.runCommand) {
    const cwd = datasetPath || undefined;
    const command = `echo "Helox fine-tune: ${baseModel} -> ${outputName} (dataset: ${datasetPath}, epochs: ${epochs})"`;
    try {
      await api.runCommand({ command, cwd });
      return { ok: true, message: 'Fine-tuning run started. Check Terminal/Pipelines for Helox.' };
    } catch (e) {
      return { ok: false, message: e?.message || 'Run failed' };
    }
  }
  return { ok: false, message: 'Terminal/run not available. Open a folder and try again.' };
}

export async function listFineTuningRuns() {
  const api = window.electronAPI;
  if (api?.invoke?.('helox-list-runs')) {
    return api.invoke('helox-list-runs');
  }
  return [];
}
