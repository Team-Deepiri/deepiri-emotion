#!/usr/bin/env node
/**
 * Deepiri Emotion CLI - Interactive TUI (Claude-style).
 * Run: emotion   (after `npm run install:cli`)   or   npm run cli
 *
 * Env: OPENAI_API_KEY, AI_SERVICE_URL, OLLAMA_HOST, OLLAMA_MODEL.
 * Config file: .emotion-cli.json (cwd) or ~/.config/deepiri-emotion/cli.json
 *
 * Architecture: Event Bus → State (React) → Ink renderer.
 * See docs/cli-tui-plan.md for full plan.
 */
import React from 'react';
import { render } from 'ink';
import { resolve } from 'path';
import { existsSync, statSync } from 'fs';
import { createEventBus, EVENTS } from './core/eventBus.js';
import { loadConfig, needsOnboarding } from './core/config.js';
import { contextWindowFor } from './core/tokens.js';
import { resolveActiveProvider } from './agent/providers/router.js';
import { attachAgentRunner } from './agent/runner.js';
import { loadProjectMemory } from './agent/projectMemory.js';
import { bootstrapProject, formatSnapshot } from './agent/bootstrap.js';
import { attachSessionRecorder } from './agent/session.js';
import { runOnboarding } from './agent/modelsCommand.js';
import App from './ui/App.js';
import { playSplash } from './ui/splash.js';

/** Reads all of stdin as a UTF-8 string (used by -p/--print when input is piped). */
function readStdin() {
  return new Promise((resolveStdin) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolveStdin(data));
  });
}

process.on('uncaughtException', (err) => {
  process.stdout.write('\x1B[?25h\x1B[0m\n');  // restore cursor + reset colour
  process.stderr.write(`\n[deepiri-cli] uncaughtException: ${err?.stack || err}\n`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  process.stdout.write('\x1B[?25h\x1B[0m\n');
  process.stderr.write(`\n[deepiri-cli] unhandledRejection: ${reason?.stack || reason}\n`);
  process.exit(1);
});

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`
Usage: emotion [options] [--] [workspace-dir]

Options:
  -h, --help         Show this help
  -v, --version      Show version
  --teach            Enable teach mode: agent explains reasoning, concepts, and best practices
  -p, --print [text] Headless mode: run one turn, stream plain text to stdout, then exit.
                     Prompt comes from [text] and/or piped stdin.
                     Example: emotion -p "summarize package.json"
                     Example: cat file.js | emotion -p "explain this"

Workspace:
  Pass a directory path (after -- or as first argument). Tools (read_file, search, run) run in that directory.
  Example: emotion /path/to/project

Install (once, from the repo root):
  ./install.sh
  # or: npm run install:cli  (command only, if deps already installed)

Environment:
  OPENAI_API_KEY   OpenAI API key (provider: openai)
  AI_SERVICE_URL   Cyrex backend URL (default: http://localhost:8000)
  OLLAMA_HOST      Ollama URL (default: http://localhost:11434)
  OLLAMA_MODEL     Ollama model name

Config file (optional):
  .emotion-cli.json in current directory, or
  ~/.config/deepiri-emotion/cli.json
  Example: { "provider": "openai", "openaiApiKey": "sk-...", "openaiModel": "gpt-4o-mini" }
`);
  process.exit(0);
}
if (argv.includes('--version') || argv.includes('-v')) {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    console.log(pkg.version || '0.0.0');
  } catch {
    console.log('0.0.0');
  }
  process.exit(0);
}

// Headless print mode: -p/--print [prompt]. Extracted (and its consumed value
// stripped) before workspace-dir parsing below, so the prompt text isn't
// mistaken for a positional workspace path.
const printFlagIndex = argv.findIndex((a) => a === '-p' || a === '--print');
const printMode = printFlagIndex !== -1;
let printPromptArg = null;
let filteredArgv = argv;
if (printMode) {
  const next = argv[printFlagIndex + 1];
  const consumesNext = next !== undefined && !next.startsWith('-');
  if (consumesNext) printPromptArg = next;
  filteredArgv = argv.filter(
    (_, i) => i !== printFlagIndex && !(consumesNext && i === printFlagIndex + 1)
  );
}

// Optional workspace directory: after -- or first positional if it's an existing dir
let workspaceDir = null;
const dashIndex = filteredArgv.indexOf('--');
const positionals = dashIndex >= 0 ? filteredArgv.slice(dashIndex + 1) : filteredArgv.filter((a) => !a.startsWith('-'));
const candidate = positionals[0];
if (candidate) {
  const abs = resolve(process.cwd(), candidate);
  if (existsSync(abs)) {
    try {
      if (statSync(abs).isDirectory()) {
        workspaceDir = abs;
        process.chdir(abs);
      }
    } catch {
      // leave cwd unchanged
    }
  }
}

const teachMode = filteredArgv.includes('--teach');
const config = await loadConfig();
if (workspaceDir) config.workspaceDir = workspaceDir;
if (teachMode) config.teachMode = true;

// Load project memory (EMOTION.md) and auto-discovery snapshot once at startup;
// both are injected into the agent's system prompt by AgentWorker per turn.
const memoryCwd = config.workspaceDir || process.cwd();
config.projectMemory = await loadProjectMemory(memoryCwd);
const snapshotData = await bootstrapProject(memoryCwd);
config.projectSnapshot = formatSnapshot(snapshotData);

const eventBus = createEventBus();
attachAgentRunner(eventBus, config);
attachSessionRecorder(eventBus, memoryCwd);

// Headless mode: run a single turn, stream plain text to stdout, exit — no Ink UI.
// Reuses the same eventBus/runner path as the interactive TUI unchanged.
if (printMode) {
  const stdinPrompt = process.stdin.isTTY ? null : await readStdin();
  const prompt = [printPromptArg, stdinPrompt].filter((p) => p && p.trim()).join('\n\n');

  if (!prompt.trim()) {
    console.error('Error: -p/--print requires a prompt (as an argument or piped via stdin).');
    process.exit(1);
  }

  let output = '';
  let sawError = false;
  eventBus.on(EVENTS.LLM_TOKEN, ({ token }) => {
    output += token;
    process.stdout.write(token);
  });
  eventBus.on(EVENTS.AGENT_ERROR, ({ message }) => {
    sawError = true;
    process.stderr.write(`${message}\n`);
  });

  await new Promise((resolveTurn) => {
    const onDone = ({ silent } = {}) => {
      // Internal reasoning steps also emit LLM_DONE (silent) — only the real,
      // final completion of the turn should resolve here.
      if (silent) return;
      eventBus.off(EVENTS.LLM_DONE, onDone);
      resolveTurn();
    };
    eventBus.on(EVENTS.LLM_DONE, onDone);
    eventBus.emit(EVENTS.USER_MESSAGE, { text: prompt });
  });

  process.stdout.write('\n');
  process.exit(sawError || !output.trim() ? 1 : 0);
}

// Resolve the active provider/model before the first render so the welcome
// screen and header have something real to show at launch, not just after
// the first turn resolves one.
const resolvedProvider = await resolveActiveProvider(config).catch(() => null);
if (resolvedProvider?.provider) {
  config.activeProvider = resolvedProvider.provider;
  if (resolvedProvider.model) {
    // Keep session model aligned with what the router actually selected.
    if (resolvedProvider.provider === 'ollama') config.ollamaModel = resolvedProvider.model;
  }
}

await playSplash();

render(React.createElement(App, {
  eventBus,
  workspaceDir,
  teachMode: config.teachMode ?? false,
  initialProvider: resolvedProvider?.provider ?? null,
  initialModel: resolvedProvider?.model ?? null,
  initialContextWindow: contextWindowFor(config)
}));

// First-run: interactive provider/account setup once the TUI is live.
if (needsOnboarding(config)) {
  setTimeout(() => {
    runOnboarding(eventBus, config).catch((err) => {
      eventBus.emit(EVENTS.AGENT_ERROR, { message: err?.message || String(err) });
    });
  }, 50);
}
