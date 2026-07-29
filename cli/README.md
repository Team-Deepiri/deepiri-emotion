# Deepiri Emotion CLI

`emotion` — an agentic coding assistant for the terminal. Multi-provider LLM streaming, a real tool-calling agent loop, MCP server support, checkpoints you can rewind, and project memory that persists across sessions.

Built on Ink (React for the terminal) with an event-bus architecture: state-driven rendering, a live agent step timeline, and a token usage meter.

## Install

Put `emotion` on your PATH:

```bash
npm install
npm run install:cli
```

Then from any directory:

```bash
emotion                                # interactive TUI in the current folder
emotion /path/to/project               # open a specific workspace
emotion -p "summarize package.json"    # headless one-shot, no TTY required
emotion --help
```

Remove it later with `npm run uninstall:cli`.

Without installing globally, from the repo root:

```bash
npm run cli
npm run cli -- /path/to/project
npm run cli:dev                        # dev: auto-restart on file changes
```

The interactive TUI **needs a real TTY**. Piping it or running it under CI shows “Raw mode is not supported” because Ink requires keyboard input — use `-p` / `--print` for headless and scripted runs.

**From VS Code:** use the "Run CLI" launch configuration (integrated terminal).

## First launch

On first run, onboarding walks you through picking a provider and connecting it. You can redo any of it later:

- `/account` — link subscription-style providers (OpenAI, Claude CLI, Cursor, Cyrex). Opens the provider's site, takes your key, lets you pick a plan.
- `/connect` — bring your own API key for `openai`, `anthropic`, `gemini`, or `openrouter`. `/connect anthropic` jumps straight to one.
- `/provider` — switch the active provider. `/provider ollama` skips the menu.
- `/models` — interactive model picker: use an installed model, pull a new one, or browse the catalog.

Nothing is required to start if you have [Ollama](https://ollama.com) running locally — that's the zero-config default.

## Slash commands

Type `/` in the prompt for autocomplete.

| Command | What it does |
| --- | --- |
| `/models` | Interactive model menu (↑↓ Enter). Use installed models, pull from catalog, switch provider. |
| `/account` | Link cloud accounts: opens provider website, paste API key, pick plan. |
| `/provider` | Switch LLM provider (or `/provider ollama`). |
| `/connect` | BYOK: paste an API key for openai/anthropic/gemini/openrouter. |
| `/mcp` | Show connected MCP servers and the tools they expose. |
| `/skills` | Browse local Cursor-style skills. |
| `/status` | cwd, provider, model, and saved plans. |
| `/init` | Scan the workspace and write a starter `EMOTION.md`. |
| `/scan` | Scan for existing guidance docs (AGENTS.md, CLAUDE.md, …) and load them. |
| `/resume` | Resume a previous session. |
| `/compact` | Summarize conversation history to free up context. |
| `/rewind` | List recent checkpoints; `/rewind <n>` restores one, undoing that turn's file edits. |
| `/clear` | Reset the conversation. |
| `/plan` | Planning only — no mutations. |
| `/auto` | Apply edits without confirmation. |
| `/accept-edits` | Auto-approve file edits only (still confirms shell and network). |
| `/guard` | Toggle the voice-of-reason supervisor review. |
| `/teach` | Explain reasoning as it works. |
| `/debug` | Full step visibility. |
| `/help` | Full command list. |

Power-user shortcuts still work: `/models use <name>`, `/models pull <name>`.

**Keys:** `@` for file autocomplete, `Ctrl+V` to paste a clipboard image (macOS), `Ctrl+L` to clear the screen.

## Tools

The agent picks and chains these itself — you don't invoke them directly.

| Group | Tools |
| --- | --- |
| Files | `read_file`, `create_file`, `write_file`, `edit_file`, `list_files`, `search` |
| Shell | `run_command` (timeout-bounded, output capped) |
| Git | `git_status`, `git_diff` |
| Web | `web_search`, `web_fetch` |
| Memory | `memory_set`, `memory_get`, `memory_list` (backed by `.emotion-memory.json`) |
| Reasoning | `thoughts`, `explain` |
| Delegation | `delegate` — fan a task out to several provider/model sub-agents in parallel |

Plus every tool exposed by your connected MCP servers, namespaced `mcp__<server>__<tool>`.

### Confirmation gate

File mutations, `run_command`, network tools (`web_search`, `web_fetch`), and **all** MCP tools pause for your approval before executing. `/auto` approves everything for the session; `/accept-edits` approves file edits only. Read-only tools never prompt.

### Checkpoints

Every turn is checkpointed before it runs, capturing the conversation state and the original contents of any file it's about to touch. `/rewind` lists them newest-first; `/rewind 2` restores that point, reverting both the history and the file edits.

## Context and memory

- **Token meter** — live usage against the model's context window, in the status bar.
- **Compaction** — `/compact` summarizes history on demand; the agent also auto-compacts at 80% of the window so long sessions don't hit the wall.
- **`EMOTION.md`** — written by `/init`, loaded into system context at every launch (first 16KB). This is where project conventions and architecture notes belong.
- **Guidance docs** — `/scan` finds and loads AGENTS.md, CLAUDE.md, and similar files already in the repo.
- **Sessions** — every conversation is recorded to `.emotion-sessions/<id>.json` (last 30 kept). `/resume` loads one back.

## Providers

| Provider | Notes |
| --- | --- |
| `ollama` | Local models, streaming NDJSON. Zero config if Ollama is running. |
| `openai` | Streaming SSE. |
| `anthropic` | Native Anthropic Messages API. |
| `gemini` | Via the OpenAI-compatible endpoint. |
| `openrouter` | Via the OpenAI-compatible endpoint; `openrouter/auto` by default. |
| `claude-cli` | Drives a locally installed Claude CLI binary. |
| `cursor` | Drives a locally installed Cursor CLI binary. |
| `cyrex` | Optional Deepiri backend; stub fallback when unreachable. |

Adapters live in `agent/providers/`, wired up in `agent/providers/registry.js`. When the active provider fails, the CLI falls back down `providerChain`.

## MCP servers

Connect external [Model Context Protocol](https://modelcontextprotocol.io) servers over stdio. Their tools merge in alongside the built-ins and go through the same confirmation gate.

Add them to `mcpServers` in `.emotion-cli.json` (or the user-global `cli.json`):

```jsonc
{
  "mcpServers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  ]
}
```

Servers connect once at launch, so **restart the CLI after editing config**. `/mcp` shows what connected, what failed, and which tools each server offers. A server that fails to connect is reported and skipped — it never blocks startup.

## Config

First file found wins:

1. `.emotion-cli.json` in the workspace (project-local)
2. `~/.config/deepiri-emotion/cli.json` (user-global)

`/connect`, `/account`, `/provider`, and `/models` write here for you. Environment variables override config when set:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | OpenAI |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL` | Anthropic |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | OpenRouter |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | Ollama |
| `AI_SERVICE_URL` | Cyrex backend |
| `AGENT_MAX_STEPS` / `AGENT_MAX_TOOL_CALLS` / `AGENT_TIMEOUT_MS` | Agent loop bounds (default 5 / 8 / 60s) |
| `SUPERVISOR_ENABLED` | Set `false` to disable the supervisor by default |

## Architecture

- **Event bus** (`core/eventBus.js`) — central pub/sub for `USER_MESSAGE`, `LLM_TOKEN`, `AGENT_STATUS`, `AGENT_STEP`, `TOOL_START`, `TOOL_END`, `SPINNER_TICK`.
- **Runner** (`agent/runner.js`) — subscribes to `USER_MESSAGE`, dispatches slash commands, manages checkpoints and auto-compaction, and drives the agent loop.
- **Agent loop** (`agent/AgentWorker.js`) — streams from the provider, parses tool calls, executes them through the confirmation gate, feeds results back, repeats until done or bounded out.
- **Tools** (`agent/tools.js`, `agent/toolRegistry.js`) — `BUILTIN_TOOL_METADATA` declares each tool's name and required args; `TOOL_HANDLERS` dispatches the call. MCP tools are merged into the same registry.
- **Providers** (`agent/providers/`) — one adapter per backend behind a common `base.js` interface, selected by `registry.js`, with fallback via `router.js`.
- **Safety** (`agent/pathSafety.js`, `agent/confirm.js`, `agent/loopGuards.js`) — workspace-relative path resolution with symlink-escape rejection, the approval gate, and loop/step bounds.
- **UI** (`ui/`) — Ink components: message list, step timeline, status bar with spinner and token meter, prompt input with autocomplete. Errors render in red above the messages.

## Tests

```bash
npm test              # renderer (Vitest) + Node/CLI tests
npm run lint          # eslint src cli
```

CLI tests live in `cli/agent/__tests__/` and `cli/core/__tests__/`.

See [docs/cli-tui-plan.md](../docs/cli-tui-plan.md) and [docs/cli-tui-v2-plan.md](../docs/cli-tui-v2-plan.md) for the design history.
