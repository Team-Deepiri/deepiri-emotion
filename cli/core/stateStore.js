/**
 * Initial state shape for the CLI TUI.
 * Actual state lives in React (App); this is the schema and defaults.
 */
import { DEFAULT_CONTEXT_LIMIT } from './tokens.js';

export const INITIAL_STATE = {
  messages: [],
  streamingMessage: '',
  agentStatus: 'idle', // idle | thinking | responding | tool_running
  statusMessage: '',
  steps: [],
  plan: [],
  spinnerFrame: 0,
  inputBuffer: '',
  error: null,
  errorHint: null,
  activeProvider: null,
  activeModel: null,
  teachMode: false,
  supportMode: false,
  activeModes: new Set(),
  autoMode: false,
  acceptEdits: false,
  pendingConfirmation: null,
  pendingSelect: null,
  pendingTextInput: null,
  activeTool: null,
  queuedMessage: null,
  allowedCount: 0,
  guardMode: true,
  /** Summaries from BACKGROUND_TASKS_CHANGED — [{ id, status, text, ... }]. */
  backgroundTasks: [],
  tokenUsage: { used: 0, limit: DEFAULT_CONTEXT_LIMIT },
  /** Live provider progress from LLM_PROGRESS (null when idle). */
  llmProgress: null,
};

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
export const NUM_SPINNER_FRAMES = SPINNER_FRAMES.length;
