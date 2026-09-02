/**
 * Slash-command registry — single source of truth for name + description.
 * Read by both /help (runner.js) and the autocomplete menu (Autocomplete.js).
 */
export const COMMANDS = [
  { name: '/models', description: 'interactive model picker (use / pull / browse)' },
  { name: '/account', description: 'link cloud accounts, pick plans, open provider sites' },
  { name: '/provider', description: 'show or switch LLM provider' },
  { name: '/connect', description: 'BYOK: paste an API key for openai/anthropic/gemini/openrouter' },
  { name: '/mcp', description: 'show connected MCP servers and the tools they offer' },
  { name: '/skills', description: 'browse local Cursor-style skills' },
  { name: '/status', description: 'show cwd, provider, model, and plans' },
  { name: '/teach', description: 'explain reasoning as it works' },
  { name: '/debug', description: 'full step visibility' },
  { name: '/plan', description: 'planning only, no mutations' },
  { name: '/auto', description: 'apply edits without confirmation' },
  { name: '/accept-edits', description: 'auto-approve file edits only' },
  { name: '/guard', description: 'toggle voice-of-reason supervisor review' },
  { name: '/review', description: 'AI code review of your staged changes (--fix to apply patches)' },
  { name: '/scan', description: 'scan workspace for guidance docs' },
  { name: '/resume', description: 'resume a previous session' },
  { name: '/clear', description: 'reset the conversation' },
  { name: '/compact', description: 'summarize conversation history to free up context' },
  { name: '/rewind', description: 'list or restore a recent checkpoint (undoes a turn and its file edits)' },
  { name: '/init', description: 'scan workspace and write starter EMOTION.md' },
  { name: '/remember', description: 'extract durable facts from recent sessions and propose adding them to EMOTION.md' },
  { name: '/memory', description: 'show what EMOTION.md currently remembers and when it last changed' },
  { name: '/help', description: 'show this list' },
];

export function formatCommandList() {
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  return ['Available commands:', ...COMMANDS.map((c) => `${c.name.padEnd(width + 2)}${c.description}`)].join('\n');
}
