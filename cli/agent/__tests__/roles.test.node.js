import { describe, it, expect } from 'vitest';
import {
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  DEFAULT_ROLE,
  listRoleNames,
  isRole,
  getRole,
  isToolAllowedForRole,
  formatRolesForPrompt,
} from '../roles.js';
import { BUILTIN_TOOL_METADATA } from '../toolRegistry.js';

describe('role definitions', () => {
  it('defines the five specialist roles plus a generalist fallback', () => {
    expect(listRoleNames().sort()).toEqual(
      ['architect', 'generalist', 'implementer', 'reviewer', 'security', 'tester'],
    );
  });

  it('gives every role a non-empty system prompt, summary and tool list', () => {
    for (const name of listRoleNames()) {
      const role = getRole(name);
      expect(role.name, name).toBe(name);
      expect(role.systemPrompt.length, name).toBeGreaterThan(0);
      expect(role.summary.length, name).toBeGreaterThan(0);
      expect(role.allowedTools.length, name).toBeGreaterThan(0);
      expect(['strong', 'cheap'], name).toContain(role.preferredTier);
    }
  });

  it('only references tools that actually exist in the registry', () => {
    const known = new Set(BUILTIN_TOOL_METADATA.map((t) => t.name));
    for (const name of listRoleNames()) {
      for (const tool of getRole(name).allowedTools) {
        expect(known.has(tool), `${name} -> ${tool}`).toBe(true);
      }
    }
  });
});

describe('tool access per role', () => {
  it('lets every role read the workspace', () => {
    for (const name of listRoleNames()) {
      for (const tool of READ_ONLY_TOOLS) {
        expect(isToolAllowedForRole(name, tool), `${name} -> ${tool}`).toBe(true);
      }
    }
  });

  it('denies the reviewer write access', () => {
    for (const tool of WRITE_TOOLS) {
      expect(isToolAllowedForRole('reviewer', tool), tool).toBe(false);
    }
    expect(isToolAllowedForRole('reviewer', 'run_command')).toBe(false);
  });

  it('denies the security auditor write access', () => {
    for (const tool of WRITE_TOOLS) {
      expect(isToolAllowedForRole('security', tool), tool).toBe(false);
    }
    expect(isToolAllowedForRole('security', 'run_command')).toBe(false);
  });

  it('denies the architect write access', () => {
    for (const tool of WRITE_TOOLS) {
      expect(isToolAllowedForRole('architect', tool), tool).toBe(false);
    }
  });

  it('grants the implementer and tester write access', () => {
    for (const tool of [...WRITE_TOOLS, 'run_command']) {
      expect(isToolAllowedForRole('implementer', tool), tool).toBe(true);
      expect(isToolAllowedForRole('tester', tool), tool).toBe(true);
    }
  });

  it('denies every role the ability to delegate, so fan-out cannot recurse', () => {
    for (const name of listRoleNames()) {
      expect(isToolAllowedForRole(name, 'delegate'), name).toBe(false);
    }
  });

  it('denies every role the network tools, which need a human to confirm', () => {
    for (const name of listRoleNames()) {
      expect(isToolAllowedForRole(name, 'web_search'), name).toBe(false);
      expect(isToolAllowedForRole(name, 'web_fetch'), name).toBe(false);
    }
  });

  it('refuses MCP tools, whose side effects are unknown ahead of time', () => {
    expect(isToolAllowedForRole('implementer', 'mcp__github__create_issue')).toBe(false);
  });
});

describe('getRole', () => {
  it('falls back to the generalist for an unknown role', () => {
    expect(getRole('wizard').name).toBe(DEFAULT_ROLE);
    expect(getRole(undefined).name).toBe(DEFAULT_ROLE);
    expect(getRole('').name).toBe(DEFAULT_ROLE);
  });

  it('does not let a caller mutate the shared definition', () => {
    getRole('reviewer').allowedTools.push('write_file');
    expect(isToolAllowedForRole('reviewer', 'write_file')).toBe(false);
  });

  it('rejects inherited Object properties as role names', () => {
    expect(isRole('toString')).toBe(false);
    expect(isRole('constructor')).toBe(false);
    expect(getRole('constructor').name).toBe(DEFAULT_ROLE);
  });
});

describe('formatRolesForPrompt', () => {
  it('lists every role with its summary, one per line', () => {
    const lines = formatRolesForPrompt().split('\n');
    expect(lines).toHaveLength(listRoleNames().length);
    for (const name of listRoleNames()) {
      expect(formatRolesForPrompt()).toContain(`- ${name}: `);
    }
  });
});
