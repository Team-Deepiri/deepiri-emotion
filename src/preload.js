const { contextBridge, ipcRenderer } = require('electron');

// IPC channel names: single source in src/shared/ipcChannels.js (main process uses IPC.*).
// Preload keeps string literals in sync; when adding channels, update ipcChannels.js and here.

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // API Requests
  apiRequest: async ({ method, endpoint, data, headers = {} }) => {
    try {
      return await ipcRenderer.invoke('api-request', { method, endpoint, data, headers });
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  },

  // AI Requests
  aiRequest: async ({ endpoint, data, headers = {} }) => {
    try {
      return await ipcRenderer.invoke('ai-request', { endpoint, data, headers });
    } catch (error) {
      console.error('AI request error:', error);
      throw error;
    }
  },

  // Task Management
  createTask: async (title, description = '', type = 'manual') => {
    try {
      return await ipcRenderer.invoke('create-task', { title, description, type });
    } catch (error) {
      console.error('Create task error:', error);
      throw error;
    }
  },

  getTasks: async () => {
    try {
      return await ipcRenderer.invoke('get-tasks');
    } catch (error) {
      console.error('Get tasks error:', error);
      throw error;
    }
  },

  // Task Classification
  classifyTask: async (task, description = null) => {
    try {
      return await ipcRenderer.invoke('classify-task', { task, description });
    } catch (error) {
      console.error('Classify task error:', error);
      throw error;
    }
  },

  // Integrations
  syncGithubIssues: async (repo = '', token = null) => {
    try {
      return await ipcRenderer.invoke('sync-github-issues', { repo, token });
    } catch (error) {
      console.error('Sync GitHub issues error:', error);
      throw error;
    }
  },

  // LLM
  getLLMHint: async (task) => {
    try {
      return await ipcRenderer.invoke('get-llm-hint', task);
    } catch (error) {
      console.error('Get LLM hint error:', error);
      return 'Hint generation unavailable';
    }
  },

  completeCode: async (code, language) => {
    try {
      return await ipcRenderer.invoke('complete-code', { code, language });
    } catch (error) {
      console.error('Complete code error:', error);
      return code;
    }
  },

  // Session Recording
  startSession: async (userId) => {
    try {
      return await ipcRenderer.invoke('start-session', userId);
    } catch (error) {
      console.error('Start session error:', error);
      throw error;
    }
  },

  recordKeystroke: async (key, file, line, column) => {
    try {
      await ipcRenderer.invoke('record-keystroke', { key, file, line, column });
    } catch (error) {
      console.error('Record keystroke error:', error);
    }
  },

  recordFileChange: async (file, changeType, details) => {
    try {
      await ipcRenderer.invoke('record-file-change', { file, changeType, details });
    } catch (error) {
      console.error('Record file change error:', error);
    }
  },

  endSession: async () => {
    try {
      return await ipcRenderer.invoke('end-session');
    } catch (error) {
      console.error('End session error:', error);
      throw error;
    }
  },

  // File System
  openFile: async (path) => {
    try {
      return await ipcRenderer.invoke('open-file', path);
    } catch (error) {
      console.error('Open file error:', error);
      throw error;
    }
  },

  saveFile: async (path, content) => {
    try {
      const payload = typeof path === 'object' && path !== null && 'path' in path
        ? path
        : { path, content };
      return await ipcRenderer.invoke('save-file', payload);
    } catch (error) {
      console.error('Save file error:', error);
      throw error;
    }
  },

  // Config (API URLs, Helox path, Cyrex UI URL)
  getConfig: () => ipcRenderer.invoke('get-config'),

  // Helox pipelines
  runHeloxPipeline: (options) => ipcRenderer.invoke('run-helox-pipeline', options),
  cancelHeloxPipeline: () => ipcRenderer.invoke('cancel-helox-pipeline'),
  onHeloxOutput: (cb) => {
    const sub = (event, data) => cb(data);
    ipcRenderer.on('helox-output', sub);
    return () => ipcRenderer.removeListener('helox-output', sub);
  },
  onHeloxExit: (cb) => {
    const sub = (event, data) => cb(data);
    ipcRenderer.on('helox-exit', sub);
    return () => ipcRenderer.removeListener('helox-exit', sub);
  },

  // IDE Utilities
  openProject: async () => {
    try {
      return await ipcRenderer.invoke('open-project');
    } catch (error) {
      console.error('Open project error:', error);
      throw error;
    }
  },

  getProjectRoot: async () => {
    return await ipcRenderer.invoke('get-project-root');
  },
  setProjectRoot: async (path) => {
    return await ipcRenderer.invoke('set-project-root', path);
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  listDirectory: async (path) => {
    return await ipcRenderer.invoke('list-directory', path);
  },
  listWorkspaceFiles: async (rootDir, excludePatterns) => {
    return await ipcRenderer.invoke('list-workspace-files', rootDir, excludePatterns);
  },
  createFile: async (opts) => {
    return await ipcRenderer.invoke('create-file', opts);
  },
  createFolder: async (opts) => {
    return await ipcRenderer.invoke('create-folder', opts);
  },
  deletePath: (path) => ipcRenderer.invoke('delete-path', path),
  renamePath: (opts) => ipcRenderer.invoke('rename-path', opts),
  searchInFolder: (rootDir, query, opts) => ipcRenderer.invoke('search-in-folder', rootDir, query, opts),

  runCommand: (opts) => ipcRenderer.invoke('run-command', opts),
  cancelCommand: (terminalId) => ipcRenderer.invoke('cancel-command', terminalId),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onCommandOutput: (cb) => {
    const sub = (event, data) => cb(data);
    ipcRenderer.on('command-output', sub);
    return () => ipcRenderer.removeListener('command-output', sub);
  },
  onCommandExit: (cb) => {
    const sub = (event, data) => { cb(data); };
    ipcRenderer.on('command-exit', sub);
    return () => ipcRenderer.removeListener('command-exit', sub);
  },

  listAgents: () => ipcRenderer.invoke('list-agents'),
  registerAgent: (opts) => ipcRenderer.invoke('register-agent', opts),
  unregisterAgent: (agentId) => ipcRenderer.invoke('unregister-agent', agentId),

  // Fabric bus (in-process semantic routing, NeuralGPTOS-inspired)
  fabricSend: (subject, data) => ipcRenderer.invoke('fabric-send', { subject, data }),
  fabricSubscribe: (subjectPattern) => ipcRenderer.invoke('fabric-subscribe', { subjectPattern }),
  fabricUnsubscribe: (opts) => ipcRenderer.invoke('fabric-unsubscribe', opts || {}),
  onFabricMessage: (cb) => {
    const sub = (event, { subject, payload }) => cb({ subject, payload });
    ipcRenderer.on('fabric-message', sub);
    return () => ipcRenderer.removeListener('fabric-message', sub);
  },

  // Neural memory (local vector store for RAG/cache)
  neuralMemoryStore: (opts) => ipcRenderer.invoke('neural-memory-store', opts),
  neuralMemoryQuery: (opts) => ipcRenderer.invoke('neural-memory-query', opts),
  neuralMemoryClear: (opts) => ipcRenderer.invoke('neural-memory-clear', opts || {}),

  onMenuSettings: (cb) => {
    const sub = () => cb();
    ipcRenderer.on('menu-settings', sub);
    return () => ipcRenderer.removeListener('menu-settings', sub);
  },
  onMenuAbout: (cb) => {
    const sub = () => cb();
    ipcRenderer.on('menu-about', sub);
    return () => ipcRenderer.removeListener('menu-about', sub);
  },
  onMenuNewFile: (cb) => {
    const sub = () => cb();
    ipcRenderer.on('menu-new-file', sub);
    return () => ipcRenderer.removeListener('menu-new-file', sub);
  },
  onMenuOpenFolder: (cb) => {
    const sub = () => cb();
    ipcRenderer.on('menu-open-folder', sub);
    return () => ipcRenderer.removeListener('menu-open-folder', sub);
  },
  onMenuSave: (cb) => {
    const sub = () => cb();
    ipcRenderer.on('menu-save', sub);
    return () => ipcRenderer.removeListener('menu-save', sub);
  },
  onOpenFileFromCli: (cb) => {
    const sub = (_event, path) => cb(path);
    ipcRenderer.on('open-file-from-cli', sub);
    return () => ipcRenderer.removeListener('open-file-from-cli', sub);
  },
  onProjectRootChanged: (cb) => {
    const sub = (_event, path) => cb(path);
    ipcRenderer.on('project-root-changed', sub);
    return () => ipcRenderer.removeListener('project-root-changed', sub);
  },

  // AI provider settings (stored in main process userData)
  getAiSettings: async () => {
    return await ipcRenderer.invoke('get-ai-settings');
  },
  detectRuntime: () => ipcRenderer.invoke('detect-runtime'),
  setAiSettings: async (settings) => {
    return await ipcRenderer.invoke('set-ai-settings', settings);
  },
  chatCompletion: (opts) => ipcRenderer.invoke('chat-completion', opts),
  getUsage: () => ipcRenderer.invoke('get-usage'),
  getUsageLimits: () => ipcRenderer.invoke('get-usage-limits'),
  setUsageLimits: (limits) => ipcRenderer.invoke('set-usage-limits', limits),
  resetUsage: () => ipcRenderer.invoke('reset-usage'),
  listExtensions: () => ipcRenderer.invoke('list-extensions'),
  getChatHistory: (sessionId, limit) => ipcRenderer.invoke('db-get-chat-history', sessionId, limit),
  appendChatMessage: (payload) => ipcRenderer.invoke('db-append-chat-message', payload),
  clearChatHistory: (sessionId) => ipcRenderer.invoke('db-clear-chat-history', sessionId),
  getIntegrationStatus: () => ipcRenderer.invoke('get-integration-status'),
  connectIntegration: (payload) => ipcRenderer.invoke('connect-integration', payload),
  disconnectIntegration: (id) => ipcRenderer.invoke('disconnect-integration', id),
  syncIntegration: (payload) => ipcRenderer.invoke('sync-integration', payload),
  integrationSupported: (id) => ipcRenderer.invoke('integration-supported', id)
});

// Expose IDE global utilities
window.ide = {
  createNewTask: async () => {
    const title = prompt('Enter task title:');
    if (title) {
      await window.electronAPI.createTask(title);
    }
  },
  openProject: async () => {
    await window.electronAPI.openProject();
  }
};
