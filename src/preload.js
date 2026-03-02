const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // API Requests
  apiRequest: async ({ method, endpoint, data, headers = {} }) => {
    try {
      if (window.__TAURI__) {
        // Tauri environment
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('api_request', { method, endpoint, data });
      } else {
        // Electron environment
        return await ipcRenderer.invoke('api-request', { method, endpoint, data, headers });
      }
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  },

  // AI Requests
  aiRequest: async ({ endpoint, data, headers = {} }) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('api_request', { 
          method: 'POST', 
          endpoint: `/ai${endpoint}`, 
          data 
        });
      } else {
        return await ipcRenderer.invoke('ai-request', { endpoint, data, headers });
      }
    } catch (error) {
      console.error('AI request error:', error);
      throw error;
    }
  },

  // Task Management
  createTask: async (title, description = '', type = 'manual') => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('create_task', { title, description, task_type: type });
      } else {
        return await ipcRenderer.invoke('create-task', { title, description, type });
      }
    } catch (error) {
      console.error('Create task error:', error);
      throw error;
    }
  },

  getTasks: async () => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('get_tasks');
      } else {
        return await ipcRenderer.invoke('get-tasks');
      }
    } catch (error) {
      console.error('Get tasks error:', error);
      throw error;
    }
  },

  // Challenge Management
  generateChallenge: async (taskData) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('api_request', {
          method: 'POST',
          endpoint: '/challenge/generate',
          data: { task: taskData }
        });
      } else {
        return await ipcRenderer.invoke('generate-challenge', taskData);
      }
    } catch (error) {
      console.error('Generate challenge error:', error);
      throw error;
    }
  },

  generateChallengeLocal: async (taskId) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('generate_challenge_local', { task_id: taskId });
      } else {
        return await ipcRenderer.invoke('generate-challenge-local', taskId);
      }
    } catch (error) {
      console.error('Generate local challenge error:', error);
      throw error;
    }
  },

  // Task Classification
  classifyTask: async (task, description = null) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('api_request', {
          method: 'POST',
          endpoint: '/task/classify',
          data: { task, description }
        });
      } else {
        return await ipcRenderer.invoke('classify-task', { task, description });
      }
    } catch (error) {
      console.error('Classify task error:', error);
      throw error;
    }
  },

  // Gamification
  awardPoints: async (points) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('award_points', { points });
      } else {
        return await ipcRenderer.invoke('award-points', points);
      }
    } catch (error) {
      console.error('Award points error:', error);
      throw error;
    }
  },

  getGamificationState: async () => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('get_gamification_state');
      } else {
        return await ipcRenderer.invoke('get-gamification-state');
      }
    } catch (error) {
      console.error('Get gamification state error:', error);
      throw error;
    }
  },

  // Integrations
  syncGithubIssues: async (repo = '', token = null) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('sync_github_issues', { repo, token });
      } else {
        return await ipcRenderer.invoke('sync-github-issues', { repo, token });
      }
    } catch (error) {
      console.error('Sync GitHub issues error:', error);
      throw error;
    }
  },

  // LLM
  getLLMHint: async (task) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('get_llm_hint', { task });
      } else {
        return await ipcRenderer.invoke('get-llm-hint', task);
      }
    } catch (error) {
      console.error('Get LLM hint error:', error);
      return 'Hint generation unavailable';
    }
  },

  completeCode: async (code, language) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('complete_code', { code, language });
      } else {
        return await ipcRenderer.invoke('complete-code', { code, language });
      }
    } catch (error) {
      console.error('Complete code error:', error);
      return code;
    }
  },

  // Session Recording
  startSession: async (userId) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('start_session', { user_id: userId });
      } else {
        return await ipcRenderer.invoke('start-session', userId);
      }
    } catch (error) {
      console.error('Start session error:', error);
      throw error;
    }
  },

  recordKeystroke: async (key, file, line, column) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        await invoke('record_keystroke', { key, file, line, column });
      } else {
        await ipcRenderer.invoke('record-keystroke', { key, file, line, column });
      }
    } catch (error) {
      console.error('Record keystroke error:', error);
    }
  },

  recordFileChange: async (file, changeType, details) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        await invoke('api_request', {
          method: 'POST',
          endpoint: '/session/record-file-change',
          data: { file, change_type: changeType, details }
        });
      } else {
        await ipcRenderer.invoke('record-file-change', { file, changeType, details });
      }
    } catch (error) {
      console.error('Record file change error:', error);
    }
  },

  endSession: async () => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        return await invoke('end_session');
      } else {
        return await ipcRenderer.invoke('end-session');
      }
    } catch (error) {
      console.error('End session error:', error);
      throw error;
    }
  },

  // File System
  openFile: async (path) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        const { readTextFile } = window.__TAURI__.fs;
        return await readTextFile(path);
      } else {
        return await ipcRenderer.invoke('open-file', path);
      }
    } catch (error) {
      console.error('Open file error:', error);
      throw error;
    }
  },

  saveFile: async (path, content) => {
    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        const { writeTextFile } = window.__TAURI__.fs;
        await writeTextFile(path, content);
        return { success: true };
      } else {
        const payload = typeof path === 'object' && path !== null && 'path' in path
          ? path
          : { path, content };
        return await ipcRenderer.invoke('save-file', payload);
      }
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
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        const { open } = window.__TAURI__.dialog;
        return await open({ directory: true });
      } else {
        return await ipcRenderer.invoke('open-project');
      }
    } catch (error) {
      console.error('Open project error:', error);
      throw error;
    }
  },

  getProjectRoot: () => ipcRenderer.invoke('get-project-root'),
  setProjectRoot: (path) => ipcRenderer.invoke('set-project-root', path),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  listDirectory: (path) => ipcRenderer.invoke('list-directory', path),
  createFile: (opts) => ipcRenderer.invoke('create-file', opts),
  createFolder: (opts) => ipcRenderer.invoke('create-folder', opts),
  deletePath: (path) => ipcRenderer.invoke('delete-path', path),
  renamePath: (opts) => ipcRenderer.invoke('rename-path', opts),
  searchInFolder: (rootDir, query, opts) => ipcRenderer.invoke('search-in-folder', rootDir, query, opts),

  runCommand: (opts) => ipcRenderer.invoke('run-command', opts),
  cancelCommand: () => ipcRenderer.invoke('cancel-command'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onCommandOutput: (cb) => {
    const sub = (event, data) => cb(data);
    ipcRenderer.on('command-output', sub);
    return () => ipcRenderer.removeListener('command-output', sub);
  },
  onCommandExit: (cb) => {
    const sub = (event, data) => => cb(data);
    ipcRenderer.on('command-exit', sub);
    return () => ipcRenderer.removeListener('command-exit', sub);
  },

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
  }
});

// Expose IDE global utilities
window.ide = {
  createNewTask: async () => {
    const title = prompt('Enter task title:');
    if (title) {
      await window.electronAPI.createTask(title);
    }
  },
  generateChallenge: async () => {
    const taskText = prompt('Enter task for challenge:');
    if (taskText) {
      const task = await window.electronAPI.createTask(taskText);
      return await window.electronAPI.generateChallenge(task.data);
    }
  },
  openProject: async () => {
    await window.electronAPI.openProject();
  }
};
