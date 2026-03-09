/**
 * Typed access to electronAPI. Use window.electronAPI in renderer.
 */
export function getElectronAPI() {
  return typeof window !== 'undefined' ? window.electronAPI : null;
}

export function hasChatCompletion() {
  const api = getElectronAPI();
  return api && typeof api.chatCompletion === 'function';
}

export function hasAiSettings() {
  const api = getElectronAPI();
  return api && typeof api.getAiSettings === 'function' && typeof api.setAiSettings === 'function';
}
