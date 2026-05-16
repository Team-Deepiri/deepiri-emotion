import { readFile } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';

const GUIDANCE_CANDIDATES = [
  '.deepiri/agent-guidelines.md',
  '.deepiri/org-guidance.md',
  'AGENTS.md',
  'AGENT_GUIDELINES.md',
  'CONTRIBUTING.md',
  'DIRECTION.md',
  'docs/agent-guidelines.md',
  'docs/org-guidance.md',
  'README.md'
];

const MAX_CONTENT = 4000;

/**
 * Discover the first local org/project guidance file in the workspace.
 * Returns the file path (relative) and capped content, or { found: false } if none exist.
 */
export async function discoverGuidance(cwd = process.cwd()) {
  for (const candidate of GUIDANCE_CANDIDATES) {
    const abs = join(cwd, candidate);
    if (!existsSync(abs)) continue;
    try {
      const raw = await readFile(abs, 'utf-8');
      const truncated = raw.length > MAX_CONTENT;
      return {
        found: true,
        path: relative(cwd, abs),
        content: raw.slice(0, MAX_CONTENT),
        truncated
      };
    } catch {
      continue;
    }
  }
  return { found: false };
}
