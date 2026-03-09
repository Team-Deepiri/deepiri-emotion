# Deepiri Emotion CLI

Interactive TUI (terminal UI) in the style of Claude CLI: event bus, state-driven rendering, **real LLM streaming**, agent step timeline, and spinners.

## Run

```bash
npm run cli
# with a workspace (tools run in that directory)
npm run cli -- /path/to/project
# dev: auto-restart on file changes
npm run cli:dev

# or
node cli/index.js [--help | --version] [--] [workspace-dir]
```

**Must be run in an interactive terminal** (real TTY). Piping or running under CI will show “Raw mode is not supported” because Ink needs keyboard input.

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
