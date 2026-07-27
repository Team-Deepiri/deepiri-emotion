# Instructions for AI coding agents

This document describes how AI assistants and coding agents should work with the Deepiri Emotion Desktop repository.

## Running the app

- **Development:** Run the renderer dev server and Electron in two terminals:
  - Terminal 1: `npm run dev:renderer` (Vite on port 5173)
  - Terminal 2: `npm run dev` (Electron, loads http://localhost:5173)
- **Production build:** `npm run build:renderer` then `npx electron .` (or `npm run start:prod`).
- **Launch with folder or file:** `npm run dev -- -- /path/to/folder` or `npm run dev -- -- /path/to/file` (args after `--` set project root and/or open a file).

## Terminal CLI

- **Install:** From the repo root: `./install.sh` (installs npm deps only if missing/stale, then puts `emotion` on PATH).
- **Global command:** After install, run `emotion` (or `emotion /path/to/project`) from any directory. CLI-only re-link: `npm run install:cli`.
- **Without linking:** `npm run cli` (must run in a real TTY). Use `npm run cli -- /path/to/project`; `npm run cli:dev` for watch mode.
- **Help/version:** `emotion --help` / `emotion --version`.
- **Config:** Env vars `OPENAI_API_KEY`, `AI_SERVICE_URL`, `OLLAMA_HOST`; or config file `.emotion-cli.json` (cwd) or `~/.config/deepiri-emotion/cli.json`.
- **Tools:** Say e.g. "read file package.json", "search for openFile", "run npm test". Shift+Enter for newline, Enter to send. See `cli/README.md` and `docs/cli-tui-plan.md`.

## Before committing

- Run `npm run check` (lint + test + build renderer). Fix any new lint errors or failing tests.
- Main process code lives under `src/main/` (bootstrap in `src/main/bootstrap-*.js`, services in `src/main/services/*.js`). Do not add new IPC handlers in a single monolithic file; add or extend a service and register it in `src/main/index.js`.
- IPC channel names are defined in `src/shared/ipcChannels.js`. When adding a new channel, add it there and use `IPC.CHANNEL_NAME` in the main service; keep preload string literals in sync (see comment in `src/preload.js`).

## Structure

- **Main process:** `src/main.js` (entry) → `src/main/index.js` (orchestrator: window, menu, service registration). Services: `workspaceService`, `fileService`, `terminalService`, `aiService`, `agentService`, `platformService`, `heloxService`, `shellService`, `extensionsService`, `integrationService`, `dbService`.
- **Renderer:** `src/renderer/` — React app; `components/`, `features/`, `context/`, `hooks/`, `services/`, `api/`.
- **Shared:** `src/shared/` — constants, defaults, IPC channel names (`ipcChannels.js`).
- **CLI:** `cli/` — standalone TUI (event bus, agent runner, tools, Ink UI); no Electron. Entry: `cli/index.js`.
- **Local data:** Main process stores AI settings and usage as JSON in `app.getPath('userData')`; renderer uses `localStorage`. A local SQLite DB (sql.js) in `userData/app.db` stores chat history. See [docs/local-storage.md](docs/local-storage.md).

## Tests

- `npm test` runs Vitest for renderer and Node (main + CLI). Main process service tests live in `src/main/services/__tests__/`; CLI tools in `cli/agent/__tests__/`.
- Use `getElectronAPI()` or the `api` facade from `src/renderer/api/` in the renderer instead of `window.electronAPI` directly when you need consistent error handling.

## Docs

- [Architecture](docs/architecture.md), [Install & setup](docs/install.md), [Local storage](docs/local-storage.md), [CLI plan](docs/cli-tui-plan.md), [Contributing](CONTRIBUTING.md).
