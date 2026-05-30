/**
 * Provider base class + fall-through error classes used by the router.
 *
 * A "fall-through" error means the router should silently try the next provider
 * in the chain (e.g. CLI not installed, not logged in, rate-limited, transient
 * network failure). Any other error is surfaced as-is — no silent retry.
 */

export class Provider {
  static providerName = 'unknown';

  /** Cheap check: is the underlying CLI/endpoint usable at all? */
  static async isAvailable(_config) {
    return true;
  }

  /** Cheap check: does the user have valid auth for this provider? */
  static async isAuthenticated(_config) {
    return true;
  }

  /** Stream a completion. Emit LLM_TOKEN on the bus per chunk. Throw on error. */
  async stream(_bus, _prompt, _opts) {
    throw new Error('Provider.stream not implemented');
  }
}

export class ProviderUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

export class ProviderRateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderRateLimitError';
  }
}

const FALL_THROUGH_NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

export function isFallThroughError(err) {
  if (!err) return false;
  if (err instanceof ProviderUnavailableError) return true;
  if (err instanceof ProviderAuthError) return true;
  if (err instanceof ProviderRateLimitError) return true;
  if (err.code && FALL_THROUGH_NETWORK_CODES.has(err.code)) return true;
  if (err.cause && err.cause.code && FALL_THROUGH_NETWORK_CODES.has(err.cause.code)) return true;
  return false;
}
