# Deepiri Emotion CLI

Interactive TUI (terminal UI) in the style of Claude CLI: event bus, state-driven rendering, **real LLM streaming**, agent step timeline, and spinners.

## Run

One-shot install (deps if needed + `emotion` on PATH):

```bash
./install.sh
```

Then from any directory:

```bash
emotion
emotion /path/to/project
emotion --help
emotion -p "summarize package.json"
```

Already have deps and only need the command:

```bash
npm run install:cli
```

Without installing globally:

```bash
npm run cli
npm run cli -- /path/to/project
# dev: auto-restart on file changes
npm run cli:dev
```

**Must be run in an interactive terminal** (real TTY). Piping or running under CI will show “Raw mode is not supported” because Ink needs keyboard input. Use `-p` / `--print` for headless/non-TTY runs.

## Slash commands

Type `/` in the prompt for autocomplete. Highlights:

| Command | What it does |
| --- | --- |
| `/models` | **Interactive** model menu (↑↓ Enter). Use installed models, install from catalog, switch provider. |
| `/account` | Link cloud accounts: opens provider website, paste API key, pick plan. Also runs on first launch. |
| `/provider` | Interactive provider switch (or `/provider ollama`). |
| `/connect` | BYOK: paste an API key for openai/anthropic/gemini/openrouter (or `/connect anthropic`). |
| `/mcp` | Show connected MCP servers and the tools they offer. Configure servers via `mcpServers` in `.emotion-cli.json` / `cli.json` — they connect once at launch. |
| `/skills` | Interactive skill browser. |
| `/status` | cwd + provider/model + saved plans. |
| `/help` | Full command list. |

Plans are stored in `~/.config/deepiri-emotion/cli.json` (not env-only). Env still overrides when set (`OPENAI_PLAN`, etc.).

Power-user shortcuts still work: `/models use <name>`, `/models pull <name>`.

## Architecture

- **Event bus** (`core/eventBus.js`) – central pub/sub for `USER_MESSAGE`, `LLM_TOKEN`, `AGENT_STATUS`, `AGENT_STEP`, `SPINNER_TICK`, etc.
- **State** – held in React state in `App.js`; updated by event handlers.
- **Agent runner** – on `USER_MESSAGE`, optionally runs a **tool** (read_file, search) then streams LLM. Emits `AGENT_STATUS`, `AGENT_STEP`, `TOOL_START`, `TOOL_END`.
- **Tools** (`agent/tools.js`) – `read_file`, `search`, `run_command`. Triggered by e.g. "read file package.json", "search for hello", "run npm test". Command run has a 30s timeout; output is capped and passed to the LLM as context.
- **UI** – Ink (React for CLI): message list, step timeline, status bar with spinner, prompt input. **Ctrl+L** clears the screen. **Errors** (e.g. API failure) are shown in red above the messages.

## Config & providers

- **Config** – `cli/core/config.js` loads from env and optional config file. Files (first found): `.emotion-cli.json` (cwd), `~/.config/deepiri-emotion/cli.json`. Env: `OPENAI_API_KEY`, `AI_SERVICE_URL`, `OLLAMA_HOST`, `OLLAMA_MODEL`.
- **Providers** – `agent/llmStream.js`: **OpenAI** (streaming SSE), **Ollama** (streaming NDJSON), **Cyrex** (POST then simulated tokens; stub fallback if unreachable).

**Run from VS Code:** use the "Run CLI" launch configuration (integrated terminal).

**Tests:** `npm test` runs renderer and Node tests; CLI tools are covered in `cli/agent/__tests__/tools.test.node.js`.

See [docs/cli-tui-plan.md](../docs/cli-tui-plan.md) for the full plan and phases.
