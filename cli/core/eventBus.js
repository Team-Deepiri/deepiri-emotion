/**
 * Central event bus for the CLI TUI.
 * All components and the agent emit/on events; UI never prints directly.
 */
import { EventEmitter } from 'events';

export const EVENTS = {
  USER_MESSAGE: 'USER_MESSAGE',
  LLM_TOKEN: 'LLM_TOKEN',
  LLM_DONE: 'LLM_DONE',
  AGENT_STATUS: 'AGENT_STATUS',
  AGENT_STEP: 'AGENT_STEP',
  AGENT_ERROR: 'AGENT_ERROR',
  TOOL_START: 'TOOL_START',
  TOOL_END: 'TOOL_END',
  SPINNER_TICK: 'SPINNER_TICK',
  KEY: 'KEY'
};

export function createEventBus() {
  const bus = new EventEmitter();
  bus.setMaxListeners(50);
  return bus;
}
