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

const MAX_CHARS_PER_FILE = 2000;
const MAX_TOTAL_CHARS = 6000;

/**
 * Discover all local org/project guidance files in the workspace.
 * Reads every candidate that exists, up to MAX_TOTAL_CHARS combined.
 * Returns structured metadata so the agent knows which key docs were found.
 */
export async function discoverGuidance(cwd = process.cwd()) {
  const files = [];
  let total_chars = 0;
  let direction_present = false;
  let readme_present = false;

  for (const candidate of GUIDANCE_CANDIDATES) {
    if (total_chars >= MAX_TOTAL_CHARS) break;

    const abs = join(cwd, candidate);
    if (!existsSync(abs)) continue;

    let raw;
    try {
      raw = await readFile(abs, 'utf-8');
    } catch {
      continue;
    }

    const remaining = MAX_TOTAL_CHARS - total_chars;
    const cap = Math.min(MAX_CHARS_PER_FILE, remaining);
    const content = raw.slice(0, cap);
    const truncated = raw.length > content.length;
    const path = relative(cwd, abs);

    files.push({ path, content, truncated });
    total_chars += content.length;

    if (candidate === 'DIRECTION.md') direction_present = true;
    if (candidate === 'README.md') readme_present = true;
  }

  if (files.length === 0) {
    return { found: false, files: [], direction_present: false, readme_present: false, total_chars: 0 };
  }

  return { found: true, files, direction_present, readme_present, total_chars };
}
