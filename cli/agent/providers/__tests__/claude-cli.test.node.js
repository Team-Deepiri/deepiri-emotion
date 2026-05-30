import { describe, it, expect } from 'vitest';
import { ClaudeCliProvider } from '../claude-cli.js';
import { Provider } from '../base.js';

// Subprocess-level behavior (binary resolution, env stripping, real spawn) is
// validated in manual TTY testing — see PR plan. These tests cover the boring
// but important things: the module parses, the class shape is right, and
// constructor options are stored as expected.

describe('ClaudeCliProvider', () => {
  it('extends Provider and exposes providerName', () => {
    expect(ClaudeCliProvider.providerName).toBe('claude-cli');
    const p = new ClaudeCliProvider({});
    expect(p).toBeInstanceOf(Provider);
  });

  it('stores constructor options', () => {
    const p = new ClaudeCliProvider({ binPath: '/x', model: 'sonnet', timeoutMs: 1234 });
    expect(p.binPath).toBe('/x');
    expect(p.model).toBe('sonnet');
    expect(p.timeoutMs).toBe(1234);
  });

  it('defaults timeoutMs when none provided', () => {
    const p = new ClaudeCliProvider({});
    expect(p.timeoutMs).toBeGreaterThan(0);
  });

  it('has static isAvailable and isAuthenticated methods', () => {
    expect(typeof ClaudeCliProvider.isAvailable).toBe('function');
    expect(typeof ClaudeCliProvider.isAuthenticated).toBe('function');
  });
});
