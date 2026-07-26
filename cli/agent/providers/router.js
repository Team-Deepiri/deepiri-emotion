/**
 * Provider router: walks the configured chain, skipping unavailable / unauthenticated
 * providers, falling through on recoverable errors, and surfacing real failures.
 */
import { EVENTS } from '../../core/eventBus.js';
import { isFallThroughError } from './base.js';
import { configFor, getProviderClass } from './registry.js';

export const DEFAULT_CHAIN = ['ollama', 'claude-cli', 'cursor', 'openai', 'cyrex'];

function emitProviderStep(bus, kind, message) {
  if (!bus || typeof bus.emit !== 'function') return;
  bus.emit(EVENTS.AGENT_STEP, {
    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'thinking',
    status: 'complete',
    message: `Provider ${kind}: ${message}`,
  });
}

/**
 * Try each provider in `config.providerChain` (or DEFAULT_CHAIN). Returns the
 * name of the provider that handled the request, or throws if none could.
 */
export async function streamWithFallback(bus, prompt, opts = {}, config = {}) {
  const chain = Array.isArray(config.providerChain) && config.providerChain.length
    ? config.providerChain
    : DEFAULT_CHAIN;
  const errors = [];

  for (const name of chain) {
    const ProviderClass = getProviderClass(name);
    if (!ProviderClass) {
      emitProviderStep(bus, 'skip', `${name} (unknown provider)`);
      continue;
    }

    const options = configFor(name, config);

    let available;
    try {
      available = await ProviderClass.isAvailable(options);
    } catch (err) {
      available = false;
      errors.push({ name, stage: 'isAvailable', err });
    }
    if (!available) {
      emitProviderStep(bus, 'skip', `${name} (not available)`);
      continue;
    }

    let authed;
    try {
      authed = await ProviderClass.isAuthenticated(options);
    } catch (err) {
      authed = false;
      errors.push({ name, stage: 'isAuthenticated', err });
    }
    if (!authed) {
      emitProviderStep(bus, 'skip', `${name} (not authenticated)`);
      continue;
    }

    emitProviderStep(bus, 'using', name);
    if (bus && typeof bus.emit === 'function') {
      bus.emit(EVENTS.PROVIDER_SELECTED, { provider: name });
      bus.emit(EVENTS.PROVIDER_RESOLVED, { provider: name, model: options.model || null });
    }
    try {
      const provider = new ProviderClass(options);
      await provider.stream(bus, prompt, opts);
      return name;
    } catch (err) {
      errors.push({ name, stage: 'stream', err });
      if (isFallThroughError(err)) {
        emitProviderStep(bus, 'fallthrough', `${name} (${err.message})`);
        continue;
      }
      throw err;
    }
  }

  const summary = errors
    .map((e) => `${e.name}/${e.stage}: ${e.err?.message || e.err}`)
    .join('; ');
  const err = new Error(
    `No provider in chain could serve the request. Tried: ${chain.join(' → ')}.${summary ? ' ' + summary : ''}`,
  );
  err.providerChainExhausted = true;
  err.attempts = errors;
  throw err;
}

/**
 * Walk the chain the same way `streamWithFallback` does, but only as far as
 * isAvailable/isAuthenticated — no request is sent. Used to resolve the active
 * provider/model at CLI startup so the header/welcome screen doesn't have to
 * wait for the first real turn.
 */
export async function resolveActiveProvider(config = {}) {
  const chain = Array.isArray(config.providerChain) && config.providerChain.length
    ? config.providerChain
    : DEFAULT_CHAIN;

  for (const name of chain) {
    const ProviderClass = getProviderClass(name);
    if (!ProviderClass) continue;

    const options = configFor(name, config);
    try {
      if (!(await ProviderClass.isAvailable(options))) continue;
      if (!(await ProviderClass.isAuthenticated(options))) continue;
    } catch {
      continue;
    }
    return { provider: name, model: options.model || null };
  }
  return null;
}
