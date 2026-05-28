/**
 * Default configuration values.
 * Shared by Electron main and renderer so both sides stay in sync.
 */
export const DEFAULT_AI_SETTINGS = {
  provider: 'openai',
  openaiApiKey: '',
  anthropicApiKey: '',
  googleApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  googleModel: 'gemini-1.5-flash',
  localType: 'ollama',
  localCyrexUrl: '',
  localOllamaUrl: 'http://localhost:11434',
  localOllamaModel: 'llama3.2'
};

export const DEFAULT_APP_SETTINGS = {
  apiUrl: 'http://localhost:5000/api',
  aiServiceUrl: 'http://localhost:8000',
  theme: 'dark',
  autoSave: true,
  fontSize: 14
};

export const DEFAULT_TABS_SETTINGS = {
  doubleClickToClose: false,
  showFullPathInTab: false,
  confirmCloseUnsaved: true
};

export const DEFAULT_INDEXING_SETTINGS = {
  indexOnOpen: true,
  excludePatterns: 'node_modules, .git, dist',
  docSources: []
};

export const DEFAULT_TOOLS_SETTINGS = {
  nodePath: '',
  pythonPath: '',
  gitPath: ''
};

export const DEFAULT_SKIP_DIRS = ['node_modules', '.git', 'dist', 'dist-renderer', 'build', '.next', '__pycache__', '.venv', 'venv'];
