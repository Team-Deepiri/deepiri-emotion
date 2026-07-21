/**
 * Slash-command registry — single source of truth for name + description.
 * Read by both /help (runner.js) and the autocomplete menu (Autocomplete.js).
 */
export const COMMANDS = [
  { name: '/teach', description: 'explain reasoning as it works' },
  { name: '/debug', description: 'full step visibility' },
  { name: '/plan', description: 'planning only, no mutations' },
  { name: '/auto', description: 'apply edits without confirmation' },
  { name: '/accept-edits', description: 'auto-approve file edits only' },
  { name: '/scan', description: 'scan workspace for guidance docs' },
  { name: '/resume', description: 'resume a previous session' },
  { name: '/clear', description: 'reset the conversation' },
  { name: '/init', description: 'scan workspace and write starter EMOTION.md' },
  { name: '/help', description: 'show this list' },
];

export function formatCommandList() {
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  return ['Available commands:', ...COMMANDS.map((c) => `${c.name.padEnd(width + 2)}${c.description}`)].join('\n');
}
