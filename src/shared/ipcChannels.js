/**
 * Single source of IPC channel names for main and renderer.
 * Preload and main process should use these; keep in sync when adding channels.
 */
export const IPC = {
  // Platform & API
  API_REQUEST: 'api-request',
  AI_REQUEST: 'ai-request',
  GET_TASKS: 'get-tasks',
  CREATE_TASK: 'create-task',
  START_SESSION: 'start-session',
  END_SESSION: 'end-session',
  RECORD_KEYSTROKE: 'record-keystroke',
  RECORD_FILE_CHANGE: 'record-file-change',
  AWARD_POINTS: 'award-points',
  GET_GAMIFICATION_STATE: 'get-gamification-state',
  GENERATE_CHALLENGE_LOCAL: 'generate-challenge-local',
  SYNC_GITHUB_ISSUES: 'sync-github-issues',
  GET_LLM_HINT: 'get-llm-hint',
  COMPLETE_CODE: 'complete-code',
  // AI
  DETECT_RUNTIME: 'detect-runtime',
  GET_AI_SETTINGS: 'get-ai-settings',
  SET_AI_SETTINGS: 'set-ai-settings',
  GET_USAGE: 'get-usage',
  GET_USAGE_LIMITS: 'get-usage-limits',
  SET_USAGE_LIMITS: 'set-usage-limits',
  RESET_USAGE: 'reset-usage',
  CHAT_COMPLETION: 'chat-completion',
  CLASSIFY_TASK: 'classify-task',
  GENERATE_CHALLENGE: 'generate-challenge',
  // App & shell
  GET_APP_VERSION: 'get-app-version',
  GET_CONFIG: 'get-config',
  OPEN_EXTERNAL: 'open-external',
  // Workspace & file
  OPEN_PROJECT: 'open-project',
  SET_PROJECT_ROOT: 'set-project-root',
  GET_PROJECT_ROOT: 'get-project-root',
  OPEN_FILE: 'open-file',
  SAVE_FILE: 'save-file',
  LIST_DIRECTORY: 'list-directory',
  LIST_WORKSPACE_FILES: 'list-workspace-files',
  CREATE_FILE: 'create-file',
  CREATE_FOLDER: 'create-folder',
  DELETE_PATH: 'delete-path',
  RENAME_PATH: 'rename-path',
  SEARCH_IN_FOLDER: 'search-in-folder',
  // Terminal
  RUN_COMMAND: 'run-command',
  CANCEL_COMMAND: 'cancel-command',
  // Agents & Fabric
  LIST_AGENTS: 'list-agents',
  REGISTER_AGENT: 'register-agent',
  UNREGISTER_AGENT: 'unregister-agent',
  FABRIC_SEND: 'fabric-send',
  FABRIC_SUBSCRIBE: 'fabric-subscribe',
  FABRIC_UNSUBSCRIBE: 'fabric-unsubscribe',
  NEURAL_MEMORY_STORE: 'neural-memory-store',
  NEURAL_MEMORY_QUERY: 'neural-memory-query',
  NEURAL_MEMORY_CLEAR: 'neural-memory-clear',
  // Helox
  RUN_HELOX_PIPELINE: 'run-helox-pipeline',
  CANCEL_HELOX_PIPELINE: 'cancel-helox-pipeline',
  // Extensions
  LIST_EXTENSIONS: 'list-extensions'
};
