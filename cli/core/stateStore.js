/**
 * Initial state shape for the CLI TUI.
 * Actual state lives in React (App); this is the schema and defaults.
 */
export const INITIAL_STATE = {
  messages: [],
  streamingMessage: '',
  agentStatus: 'idle', // idle | thinking | responding | tool_running
  statusMessage: '',
  steps: [],
  spinnerFrame: 0,
  inputBuffer: '',
  error: null
};

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
export const NUM_SPINNER_FRAMES = SPINNER_FRAMES.length;
