#!/usr/bin/env node
/**
 * Deepiri Emotion CLI - Interactive TUI (Claude-style).
 * Run: npm run cli   or   node cli/index.js [options] [--] [workspace-dir]
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
import { createEventBus } from './core/eventBus.js';
import { loadConfig } from './core/config.js';
import { attachAgentRunner } from './agent/runner.js';
import App from './ui/App.js';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`
Usage: npm run cli   or   node cli/index.js [options] [--] [workspace-dir]

Options:
  -h, --help     Show this help
  -v, --version  Show version

Workspace:
  Pass a directory path (after -- or as first argument). Tools (read_file, search, run) run in that directory.
  Example: npm run cli -- /path/to/project

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

// Optional workspace directory: after -- or first positional if it's an existing dir
let workspaceDir = null;
const dashIndex = argv.indexOf('--');
const positionals = dashIndex >= 0 ? argv.slice(dashIndex + 1) : argv.filter((a) => !a.startsWith('-'));
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

const config = await loadConfig();
if (workspaceDir) config.workspaceDir = workspaceDir;
const eventBus = createEventBus();
attachAgentRunner(eventBus, config);

render(React.createElement(App, { eventBus, workspaceDir }));
