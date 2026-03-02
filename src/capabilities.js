/**
 * Capability-based access control (NeuralGPTOS-inspired).
 * Used to gate file, shell, and API access for agents and plugins.
 */

export const CAP = {
  MEMORY_READ: 1 << 0,
  MEMORY_WRITE: 1 << 1,
  FABRIC_SEND: 1 << 2,
  FABRIC_RECV: 1 << 3,
  SENSOR_READ: 1 << 4,
  FILE_READ: 1 << 5,
  FILE_WRITE: 1 << 6,
  SHELL_RUN: 1 << 7,
  API_REQUEST: 1 << 8,
  AI_REQUEST: 1 << 9,
  TASKS_CREATE: 1 << 10,
  CHALLENGES_GENERATE: 1 << 11,
};

const CAP_NAMES = {
  [CAP.MEMORY_READ]: 'memory_read',
  [CAP.MEMORY_WRITE]: 'memory_write',
  [CAP.FABRIC_SEND]: 'fabric_send',
  [CAP.FABRIC_RECV]: 'fabric_recv',
  [CAP.SENSOR_READ]: 'sensor_read',
  [CAP.FILE_READ]: 'file_read',
  [CAP.FILE_WRITE]: 'file_write',
  [CAP.SHELL_RUN]: 'shell_run',
  [CAP.API_REQUEST]: 'api_request',
  [CAP.AI_REQUEST]: 'ai_request',
  [CAP.TASKS_CREATE]: 'tasks_create',
  [CAP.CHALLENGES_GENERATE]: 'challenges_generate',
};

/** Default capabilities for the IDE shell (renderer): full access */
export const IDE_CAPABILITIES = (
  CAP.MEMORY_READ | CAP.MEMORY_WRITE | CAP.FABRIC_SEND | CAP.FABRIC_RECV |
  CAP.SENSOR_READ | CAP.FILE_READ | CAP.FILE_WRITE | CAP.SHELL_RUN |
  CAP.API_REQUEST | CAP.AI_REQUEST | CAP.TASKS_CREATE | CAP.CHALLENGES_GENERATE
);

/** Default capabilities for plugins: tasks, challenges, UI, storage, fabric, memory read */
export const PLUGIN_DEFAULT_CAPABILITIES = (
  CAP.MEMORY_READ | CAP.FABRIC_SEND | CAP.FABRIC_RECV |
  CAP.API_REQUEST | CAP.TASKS_CREATE | CAP.CHALLENGES_GENERATE
);

/**
 * Check if a capability set has the required flag(s).
 * @param {number} granted - Bitmask of granted capabilities
 * @param {number} required - Single cap or bitmask of required caps (all must be present)
 */
export function hasCapability(granted, required) {
  return (granted & required) === required;
}

/**
 * Assert capability; throws if not granted.
 */
export function requireCapability(granted, required, context = '') {
  if (!hasCapability(granted, required)) {
    const name = CAP_NAMES[required] || `0x${required.toString(16)}`;
    throw new Error(`Permission denied: missing capability ${name}${context ? ` (${context})` : ''}`);
  }
}

/**
 * Resolve capabilities from a string array (e.g. plugin manifest).
 */
export function resolveCapabilities(names) {
  const byName = Object.fromEntries(Object.entries(CAP_NAMES).map(([k, v]) => [v, Number(k)]));
  let mask = 0;
  for (const name of names || []) {
    const cap = byName[name];
    if (cap !== undefined) mask |= cap;
  }
  return mask;
}
