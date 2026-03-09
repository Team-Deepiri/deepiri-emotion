/**
 * Centralized access to the Electron (or Tauri) bridge.
 * Use this module instead of window.electronAPI for null-safety and consistency.
 *
 * - getElectronAPI(): raw bridge or null (use when you need to pass the object).
 * - api: facade; every async method returns a Promise (rejects when bridge missing).
 * - Event subscribers (onX) return an unsub function; when bridge missing return no-op.
 */

const UNAVAILABLE = 'Electron API not available';

function getRaw() {
  if (typeof window === 'undefined') return null;
  return window.electronAPI ?? null;
}

/**
 * @returns {typeof window.electronAPI | null}
 */
export function getElectronAPI() {
  return getRaw();
}

export function hasChatCompletion() {
  const raw = getRaw();
  return !!(raw && typeof raw.chatCompletion === 'function');
}

export function hasAiSettings() {
  const raw = getRaw();
  return !!(raw && typeof raw.getAiSettings === 'function' && typeof raw.setAiSettings === 'function');
}

function rejectMissing(method) {
  return Promise.reject(new Error(`${UNAVAILABLE}: ${method}`));
}

function guard(method, fn) {
  return (...args) => {
    const raw = getRaw();
    if (!raw || typeof fn !== 'function') return rejectMissing(method);
    return Promise.resolve(fn(raw, ...args)).catch((err) => {
      if (err?.message !== UNAVAILABLE) console.error(`[api] ${method} failed:`, err);
      throw err;
    });
  };
}

function onEvent(name, fn) {
  return (cb) => {
    const raw = getRaw();
    return raw && typeof fn === 'function' ? fn(raw, cb) : (() => {});
  };
}

export const api = {
  // Project & files
  getProjectRoot: guard('getProjectRoot', (a) => a.getProjectRoot?.()),
  setProjectRoot: guard('setProjectRoot', (a, path) => a.setProjectRoot?.(path)),
  openFile: guard('openFile', (a, path) => a.openFile?.(path)),
  saveFile: guard('saveFile', (a, pathOrOpts, content) => a.saveFile?.(pathOrOpts, content)),
  listDirectory: guard('listDirectory', (a, path) => a.listDirectory?.(path)),
  listWorkspaceFiles: guard('listWorkspaceFiles', (a, root, excludePatterns) => a.listWorkspaceFiles?.(root, excludePatterns)),
  createFile: guard('createFile', (a, opts) => a.createFile?.(opts)),
  createFolder: guard('createFolder', (a, opts) => a.createFolder?.(opts)),
  deletePath: guard('deletePath', (a, path) => a.deletePath?.(path)),
  renamePath: guard('renamePath', (a, opts) => a.renamePath?.(opts)),
  searchInFolder: guard('searchInFolder', (a, root, query, opts) => a.searchInFolder?.(root, query, opts)),

  // Agents
  listAgents: guard('listAgents', (a) => a.listAgents?.() ?? []),
  registerAgent: guard('registerAgent', (a, opts) => a.registerAgent?.(opts)),
  unregisterAgent: guard('unregisterAgent', (a, id) => a.unregisterAgent?.(id)),

  // Terminal & shell
  runCommand: guard('runCommand', (a, opts) => a.runCommand?.(opts)),
  cancelCommand: guard('cancelCommand', (a, terminalId) => a.cancelCommand?.(terminalId)),
  onCommandOutput: onEvent('onCommandOutput', (a, cb) => a.onCommandOutput?.(cb)),
  onCommandExit: onEvent('onCommandExit', (a, cb) => a.onCommandExit?.(cb)),

  // AI & chat
  getAiSettings: guard('getAiSettings', (a) => a.getAiSettings?.()),
  setAiSettings: guard('setAiSettings', (a, s) => a.setAiSettings?.(s)),
  chatCompletion: guard('chatCompletion', (a, opts) => a.chatCompletion?.(opts)),
  getUsage: guard('getUsage', (a) => a.getUsage?.()),
  getUsageLimits: guard('getUsageLimits', (a) => a.getUsageLimits?.()),
  setUsageLimits: guard('setUsageLimits', (a, limits) => a.setUsageLimits?.(limits)),
  resetUsage: guard('resetUsage', (a) => a.resetUsage?.()),

  // Platform API
  apiRequest: guard('apiRequest', (a, opts) => a.apiRequest?.(opts)),
  aiRequest: guard('aiRequest', (a, opts) => a.aiRequest?.(opts)),
  getTasks: guard('getTasks', (a) => a.getTasks?.()),
  createTask: guard('createTask', (a, title, desc, type) => a.createTask?.(title, desc, type)),
  classifyTask: guard('classifyTask', (a, task, desc) => a.classifyTask?.(task, desc)),
  generateChallenge: guard('generateChallenge', (a, data) => a.generateChallenge?.(data)),
  generateChallengeLocal: guard('generateChallengeLocal', (a, taskId) => a.generateChallengeLocal?.(taskId)),
  awardPoints: guard('awardPoints', (a, points) => a.awardPoints?.(points)),
  getGamificationState: guard('getGamificationState', (a) => a.getGamificationState?.()),
  syncGithubIssues: guard('syncGithubIssues', (a, repo, token) => a.syncGithubIssues?.(repo, token)),

  // LLM helpers
  getLLMHint: guard('getLLMHint', (a, task) => a.getLLMHint?.(task)),
  completeCode: guard('completeCode', (a, code, lang) => a.completeCode?.(code, lang)),

  // Session
  startSession: guard('startSession', (a, userId) => a.startSession?.(userId)),
  endSession: guard('endSession', (a) => a.endSession?.()),
  recordKeystroke: guard('recordKeystroke', (a, key, file, line, col) => a.recordKeystroke?.(key, file, line, col)),
  recordFileChange: guard('recordFileChange', (a, file, changeType, details) => a.recordFileChange?.(file, changeType, details)),

  // Config & UI
  getConfig: guard('getConfig', (a) => a.getConfig?.()),
  getAppVersion: guard('getAppVersion', (a) => a.getAppVersion?.()),
  openProject: guard('openProject', (a) => a.openProject?.()),
  openExternal: guard('openExternal', (a, url) => a.openExternal?.(url)),

  // Fabric & neural memory
  fabricSend: guard('fabricSend', (a, subject, data) => a.fabricSend?.(subject, data)),
  fabricSubscribe: guard('fabricSubscribe', (a, pattern) => a.fabricSubscribe?.(pattern)),
  fabricUnsubscribe: guard('fabricUnsubscribe', (a, opts) => a.fabricUnsubscribe?.(opts)),
  onFabricMessage: onEvent('onFabricMessage', (a, cb) => a.onFabricMessage?.(cb)),
  neuralMemoryStore: guard('neuralMemoryStore', (a, opts) => a.neuralMemoryStore?.(opts)),
  neuralMemoryQuery: guard('neuralMemoryQuery', (a, opts) => a.neuralMemoryQuery?.(opts)),
  neuralMemoryClear: guard('neuralMemoryClear', (a, opts) => a.neuralMemoryClear?.(opts)),

  // Menu events
  onMenuSettings: onEvent('onMenuSettings', (a, cb) => a.onMenuSettings?.(cb)),
  onMenuAbout: onEvent('onMenuAbout', (a, cb) => a.onMenuAbout?.(cb)),
  onMenuNewFile: onEvent('onMenuNewFile', (a, cb) => a.onMenuNewFile?.(cb)),
  onMenuOpenFolder: onEvent('onMenuOpenFolder', (a, cb) => a.onMenuOpenFolder?.(cb)),
  onMenuSave: onEvent('onMenuSave', (a, cb) => a.onMenuSave?.(cb)),

  // Helox
  runHeloxPipeline: guard('runHeloxPipeline', (a, opts) => a.runHeloxPipeline?.(opts)),
  cancelHeloxPipeline: guard('cancelHeloxPipeline', (a) => a.cancelHeloxPipeline?.()),
  onHeloxOutput: onEvent('onHeloxOutput', (a, cb) => a.onHeloxOutput?.(cb)),
  onHeloxExit: onEvent('onHeloxExit', (a, cb) => a.onHeloxExit?.(cb)),

  // Extensions
  listExtensions: guard('listExtensions', (a) => a.listExtensions?.() ?? { installed: [], available: [] }),
  getIntegrationStatus: guard('getIntegrationStatus', (a) => a.getIntegrationStatus?.() ?? { connected: {} }),
  connectIntegration: guard('connectIntegration', (a, payload) => a.connectIntegration?.(payload)),
  disconnectIntegration: guard('disconnectIntegration', (a, id) => a.disconnectIntegration?.(id)),
  syncIntegration: guard('syncIntegration', (a, payload) => a.syncIntegration?.(payload)),
  integrationSupported: guard('integrationSupported', (a, id) => a.integrationSupported?.(id)),

  // CLI launch: open file when app is started with a file path (e.g. emotion-desktop -- /path/to/file)
  onOpenFileFromCli: onEvent('onOpenFileFromCli', (a, cb) => a.onOpenFileFromCli?.(cb)),
  onProjectRootChanged: onEvent('onProjectRootChanged', (a, cb) => a.onProjectRootChanged?.(cb)),

  // Local DB (chat history)
  getChatHistory: guard('getChatHistory', (a, sessionId, limit) => a.getChatHistory?.(sessionId, limit)),
  appendChatMessage: guard('appendChatMessage', (a, payload) => a.appendChatMessage?.(payload)),
  clearChatHistory: guard('clearChatHistory', (a, sessionId) => a.clearChatHistory?.(sessionId)),
};

export default api;
