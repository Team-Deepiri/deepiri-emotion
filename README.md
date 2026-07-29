# Deepiri Emotion

**A free AI coding environment, in two forms:**

- **Desktop IDE** — Electron app with a workspace, Monaco editor, AI chat, and an integrated terminal.
- **Terminal CLI (`emotion`)** — a standalone agentic coding assistant: multi-provider LLM streaming, a real tool-calling agent loop, MCP server support, checkpoints, and project memory. Runs anywhere, no IDE required.

Both are free to download, install, and use. Optional Cyrex/Helox backends plug into either.

<img width="958" height="344" alt="image" src="https://github.com/user-attachments/assets/b184734c-08be-4050-b465-44173d9a921e" />

---

## Download & install

**End users:** Get a built installer and run the IDE with no dev setup.

| Platform | Build command (on that OS) | Installer output |
|----------|----------------------------|------------------|
| **Windows** | `npm install && npm run build:win` | `dist/Deepiri Emotion Setup 1.0.0.exe` — run to install, then launch from Start or Desktop. |
| **macOS** | `npm install && npm run build:mac` | `dist/Deepiri Emotion-1.0.0.dmg` — open and drag to Applications. |
| **Linux** | `npm install && npm run build:linux` | `dist/deepiri-emotion-desktop_1.0.0_amd64.deb` — `sudo dpkg -i …` or `dist/Deepiri Emotion-1.0.0.AppImage` — `chmod +x` and run. |

After install, open **Deepiri Emotion** like any other app. Open a folder to start coding; use **File → Settings** to change theme or API URLs. No backend is required for editing and terminal; AI and tasks use optional services (see [docs/install.md](docs/install.md)).

### Terminal CLI

Put the `emotion` command on your PATH:

```bash
npm install
npm run install:cli
```

Then from any project directory:

```bash
emotion                          # interactive TUI in the current folder
emotion /path/to/project         # open a specific workspace
emotion -p "summarize the auth flow"   # headless, one-shot (no TTY needed)
emotion --help
```

Prefer not to install globally? `npm run cli` does the same thing from the repo root. Full docs: **[cli/README.md](cli/README.md)**.

---

## Features

### Desktop IDE

- **Workspace** — Open a folder, browse and edit files with a real file tree; create, rename, delete files and folders.
- **Monaco Editor** — Syntax highlighting, themes (dark/light/hc), multiple tabs, save (Ctrl+S), cursor/selection for AI context.
- **AI** — Context-aware chat (current file + selection), “Apply to file”; optional Cyrex backend for classification, challenges, RAG.
- **Quick Open & Command Palette** — Ctrl+P (go to file), Ctrl+Shift+P (commands).
- **Welcome** — Recent folders, quick actions, getting started.
- **Terminal** — Integrated panel with project-root cwd and streamed output.
- **Cyrex & Helox** — Tabs for Cyrex UI (when running) and Helox pipeline runs; optional backend services.
- **Tasks, Challenges, Gamification** — Platform API integration; mission cards and progress tracking.
- **Local data** — Settings and chat history stored locally (userData + SQLite); no account required. See [docs/local-storage.md](docs/local-storage.md).

### Terminal CLI (`emotion`)

- **8 LLM providers** — Ollama (local), OpenAI, Anthropic, Gemini, OpenRouter, Claude CLI, Cursor, and Cyrex. Switch live with `/provider`, or fall back automatically down a provider chain.
- **Bring your own key** — `/connect` pastes an API key for openai/anthropic/gemini/openrouter; `/account` links subscription-style providers and opens the right signup page. Runs automatically on first launch.
- **Agentic tool loop** — 17 built-in tools: read/create/write/edit files, search, list, run commands, git status/diff, web search/fetch, memory get/set/list, delegation, and reasoning traces. The agent picks and chains them itself.
- **MCP client** — Connect external [Model Context Protocol](https://modelcontextprotocol.io) servers over stdio; their tools merge in alongside the built-ins. `/mcp` shows what's connected. Configure via `mcpServers` in `.emotion-cli.json`.
- **Confirmation gate** — Every file mutation, shell command, network call, and MCP tool pauses for approval before it runs. `/auto` and `/accept-edits` loosen it when you want speed.
- **Checkpoints and rewind** — Each turn is checkpointed. `/rewind` lists recent checkpoints and restores one, undoing both the conversation and the file edits that turn made.
- **Context management** — Live token meter in the status bar, `/compact` to summarize history on demand, and automatic compaction at 80% of the context window so long sessions don't fall over.
- **Project memory** — `/init` scans the workspace and writes a starter `EMOTION.md`, loaded into context on every launch. `/scan` picks up other guidance docs (AGENTS.md, CLAUDE.md, etc.).
- **Session history** — Every conversation is recorded under `.emotion-sessions/`; `/resume` brings one back.
- **Voice-of-reason supervisor** — An optional second LLM pass reviews risky actions before they execute. Toggle with `/guard`.
- **Parallel delegation** — The `delegate` tool fans one task out to several provider/model sub-agents at once and compares what comes back.
- **Modes** — `/plan` (read-only planning), `/debug` (full step visibility), `/teach` (explains its reasoning as it works).
- **Quality-of-life** — `@`-mention file autocomplete, clipboard image paste (macOS), slash-command autocomplete, streaming step timeline, Ctrl+L to clear.

---

## Quick start

### One-command full setup (install + build + get installers)

From the repo root:

```bash
chmod +x scripts/setup-full.sh && ./scripts/setup-full.sh
# Or: npm run setup
```

This installs dependencies, runs lint/tests, builds the app, and produces installers in `dist/`. The script then prints how to install or run the desktop app on your OS. See **[docs/setup.md](docs/setup.md)** for options (`--install-only`, `--skip-check`, etc.).

### Prerequisites

- **Node.js** 18+ (20 recommended; use [.nvmrc](.nvmrc) with nvm).
- **npm** (or yarn/pnpm).

### Install and run (development)

```bash
npm install

# Terminal 1 — Vite dev server
npm run dev:renderer

# Terminal 2 — Electron
npm run dev
```

### Launch with a folder or file

```bash
npm run dev -- -- /path/to/folder    # Open app with that folder as project root
npm run dev -- -- /path/to/file      # Open app and open that file in a tab
```

### Build installers

```bash
npm run build          # Current OS (Linux → .deb + AppImage; Windows → .exe; macOS → .dmg + .pkg)
npm run build:win      # Windows only
npm run build:mac      # macOS only
npm run build:linux    # Linux only
```

Output is in **`dist/`**. See **[docs/install.md](docs/install.md)** for exact filenames and install steps per platform.

---

## Project structure

```
deepiri-emotion-desktop/
├── src/
│   ├── main.js              # Electron entry
│   ├── main/                 # Bootstrap, orchestrator, services (workspace, file, AI, DB, …)
│   ├── preload.js            # Bridge (window.electronAPI)
│   ├── shared/               # IPC channel names, constants
│   └── renderer/             # React UI (components, features, context, hooks, services)
├── cli/                      # Terminal CLI (`emotion`)
│   ├── index.js              # Entry: config, MCP connect, headless -p, Ink render
│   ├── core/                 # Event bus, config, slash-command registry, tokens, modes
│   ├── agent/                # Agent loop, tools, providers, MCP client, memory, sessions
│   └── ui/                   # Ink components (messages, timeline, status bar, prompt)
├── extensions/               # Built-in extension manifests (cyrex, helox, github, notion)
├── scripts/
├── assets/
├── docs/                     # Install, architecture, local-storage, cli plan, setup
├── .vscode/                  # Launch configs, tasks
├── .env.example
├── .editorconfig
├── .nvmrc
├── package.json
└── vite.config.js
```

---

## Documentation

| Doc | Content |
|-----|---------|
| **[docs/setup.md](docs/setup.md)** | **Full setup guide** — prerequisites, clone, dev run, build, optional backends, env, verify. |
| **[docs/install.md](docs/install.md)** | Installers, dev setup, optional backends, Terminal CLI (2.2b). |
| **[docs/architecture.md](docs/architecture.md)** | Tech stack, main vs renderer, optional services, security, packaging. |
| **[docs/local-storage.md](docs/local-storage.md)** | Where user data is stored (userData, localStorage, SQLite); when to add a DB. |
| **[cli/README.md](cli/README.md)** | **Terminal CLI** — install, slash commands, tools, providers, MCP, config. |
| **[docs/cli-tui-plan.md](docs/cli-tui-plan.md)** | CLI TUI architecture and implementation phases. |
| **[docs/cli-tui-v2-plan.md](docs/cli-tui-v2-plan.md)** | CLI v2 plan (agent loop, tools, providers). |
| **[docs/RELEASE.md](docs/RELEASE.md)** | Release and versioning process. |
| **[CHANGELOG.md](CHANGELOG.md)** | Release notes per version. |
| **[AGENTS.md](AGENTS.md)** | Instructions for AI agents (run, structure, IPC, tests). |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | How to contribute; SECURITY: [SECURITY.md](SECURITY.md). |

---

## Configuration

Copy [.env.example](.env.example) to `.env` to override defaults (optional):

- `API_URL` — Platform API (default `http://localhost:5000/api`).
- `AI_SERVICE_URL` — Cyrex AI (default `http://localhost:8000`).
- `CYREX_INTERFACE_URL` — Cyrex web UI for embedded tab (default `http://localhost:5175`).
- `HELOX_PATH` — Path to Helox repo for pipeline runs.

The app runs without `.env`; these are for custom endpoints and keys.

### Terminal CLI

The CLI keeps its own config, so you don't need `.env` for it. First file found wins:

1. `.emotion-cli.json` in the current workspace (project-local)
2. `~/.config/deepiri-emotion/cli.json` (user-global)

`/connect` and `/account` write to the user-global file for you — hand-editing is only needed for MCP servers:

```jsonc
{
  "provider": "anthropic",
  "anthropicModel": "claude-sonnet-5",
  "mcpServers": [
    { "name": "filesystem", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."] }
  ]
}
```

Environment variables still override config when set: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_HOST`, `OLLAMA_MODEL`, `AI_SERVICE_URL`. See [cli/README.md](cli/README.md) for the full list.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run setup` | Full setup: install deps, lint, test, build, produce installers. |
| `npm run setup:install` | Setup, dependencies only (`--install-only`). |
| `npm run dev` | Run Electron in dev mode (use with `npm run dev:renderer` in another terminal). |
| `npm run dev:renderer` | Start Vite dev server (HMR) for the renderer. |
| `npm run dev:app` | Start renderer + Electron together in one command. |
| `npm start` | Run Electron against the last built renderer. |
| `npm run start:prod` | Build the renderer, then run Electron. |
| `npm run cli` | Run Terminal CLI (interactive; requires TTY). `npm run cli -- /path` to set workspace. |
| `npm run cli:dev` | Run CLI with `--watch` (auto-restart on file changes). |
| `npm run install:cli` | Install the `emotion` command onto your PATH. |
| `npm run uninstall:cli` | Remove the `emotion` command from your PATH. |
| `npm run build` | Icons + renderer + electron-builder for current OS. |
| `npm run build:icons` | Regenerate `assets/icon.ico` and `assets/icon.icns` from `assets/icon.png`. |
| `npm run build:renderer` | Vite production build → `dist-renderer/`. |
| `npm run build:win` / `build:mac` / `build:linux` | Build installers for that platform. |
| `npm test` | Run unit tests (Vitest: renderer + Node/main + CLI). |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run test:coverage` | Run tests with coverage report. |
| `npm run lint` | Lint `src` and `cli` with ESLint. |
| `npm run lint:fix` | Lint and fix what can be auto-fixed. |
| `npm run check` | Lint + test + build renderer (CI-style full check). |
<img width="953" height="307" alt="image" src="https://github.com/user-attachments/assets/1a91e04f-74bf-4e57-973b-93780a3913a9" />

---

## License

Apache-2.0 — see [LICENSE](LICENSE).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute. Security issues: [SECURITY.md](SECURITY.md).
