/**
 * Default configuration values. Shared defaults from src/shared; renderer-only below.
 */
export {
  DEFAULT_AI_SETTINGS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_TABS_SETTINGS,
  DEFAULT_INDEXING_SETTINGS,
  DEFAULT_TOOLS_SETTINGS,
  DEFAULT_SKIP_DIRS
} from '../../shared/defaults.js';

export const DEFAULT_USAGE_LIMITS = {
  rateLimitRequestsPerMinute: 0,
  dailyLimitRequests: 0,
  dailyLimitTokens: 0
};

export const DEFAULT_ACCOUNT_SETTINGS = {
  displayName: '',
  email: '',
  avatarUrl: ''
};

export const DEFAULT_NETWORKING_SETTINGS = {
  proxyUrl: '',
  offlineMode: false
};
