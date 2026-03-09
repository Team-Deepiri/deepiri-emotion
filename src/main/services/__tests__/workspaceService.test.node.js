/**
 * Main process workspaceService tests (Node env).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getProjectRoot, setProjectRoot } from '../workspaceService.js';

describe('workspaceService', () => {
  beforeEach(() => {
    setProjectRoot(null);
  });

  it('getProjectRoot returns null initially', () => {
    expect(getProjectRoot()).toBeNull();
  });

  it('setProjectRoot sets and getProjectRoot returns value', () => {
    setProjectRoot('/some/path');
    expect(getProjectRoot()).toBe('/some/path');
  });

  it('setProjectRoot with empty string does not set', () => {
    setProjectRoot('/first');
    setProjectRoot('');
    expect(getProjectRoot()).toBe('/first');
  });

  it('setProjectRoot with non-string does not set', () => {
    setProjectRoot('/first');
    setProjectRoot(123);
    expect(getProjectRoot()).toBe('/first');
  });
});
