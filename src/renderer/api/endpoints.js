/**
 * API endpoint constants for backend and AI services.
 */
export const ENDPOINTS = {
  DEFAULT_API_BASE: 'http://localhost:5000/api',
  DEFAULT_AI_SERVICE: 'http://localhost:8000',
  /** Optional embed URL; set via CYREX_INTERFACE_URL — no default. */
  DEFAULT_CYREX_UI: ''
};

export function resolveApiUrl(configured) {
  return configured || ENDPOINTS.DEFAULT_API_BASE;
}

export function resolveAiServiceUrl(configured) {
  return configured || ENDPOINTS.DEFAULT_AI_SERVICE;
}
