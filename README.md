# Deepiri Emotion

**AI-powered desktop IDE** free to download, install, and use. Workspace, Monaco editor, AI chat, terminal, and optional Cyrex/Helox backends.

---

## Download & install

**End users:** Get a built installer and run the IDE with no dev setup.

| Platform | Build command (on that OS) | Installer output |
|----------|----------------------------|------------------|
| **Windows** | `npm install && npm run build:win` | `dist/Deepiri Emotion Setup 1.0.0.exe` — run to install, then launch from Start or Desktop. |
| **macOS** | `npm install && npm run build:mac` | `dist/Deepiri Emotion-1.0.0.dmg` — open and drag to Applications. |
| **Linux** | `npm install && npm run build:linux` | `dist/deepiri-emotion-desktop_1.0.0_amd64.deb` — `sudo dpkg -i …` or `dist/Deepiri Emotion-1.0.0.AppImage` — `chmod +x` and run. |

After install, open **Deepiri Emotion** like any other app. Open a folder to start coding; use **File → Settings** to change theme or API URLs. No backend is required for editing and terminal; AI and tasks use optional services (see [docs/install.md](docs/install.md)).

---

## Features

- **Workspace** — Open a folder, browse and edit files with a real file tree; create, rename, delete files and folders.
- **Monaco Editor** — Syntax highlighting, themes (dark/light/hc), multiple tabs, save (Ctrl+S), cursor/selection for AI context.
- **AI** — Context-aware chat (current file + selection), “Apply to file”; optional Cyrex backend for classification, challenges, RAG.
- **Quick Open & Command Palette** — Ctrl+P (go to file), Ctrl+Shift+P (commands).
- **Welcome** — Recent folders, quick actions, getting started.
- **Terminal** — Integrated panel with project-root cwd and streamed output.
- **Terminal CLI** — Standalone TUI (`npm run cli`): AI chat with streaming (OpenAI/Ollama/Cyrex), tools (read file, search, run command), optional workspace dir. See [cli/README.md](cli/README.md).
- **Cyrex & Helox** — Tabs for Cyrex UI (when running) and Helox pipeline runs; optional backend services.
- **Tasks, Challenges, Gamification** — Platform API integration; mission cards and progress tracking.
- **Local data** — Settings and chat history stored locally (userData + SQLite); no account required. See [docs/local-storage.md](docs/local-storage.md).

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
├── cli/                      # Terminal TUI (npm run cli): event bus, agent, tools, Ink UI
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
| **[docs/cli-tui-plan.md](docs/cli-tui-plan.md)** | CLI TUI architecture and implementation phases. |
| **[docs/refactoring.md](docs/refactoring.md)** | Plan for merging Cyrex UI and Helox into the IDE. |
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

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Run Electron in dev mode (use with `npm run dev:renderer` in another terminal). |
| `npm run dev:renderer` | Start Vite dev server (HMR) for the renderer. |
| `npm run cli` | Run Terminal CLI TUI (interactive; requires TTY). `npm run cli -- /path` to set workspace. |
| `npm run cli:dev` | Run CLI with `--watch` (auto-restart on file changes). |
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

---

## License

Apache-2.0 — see [LICENSE](LICENSE).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute. Security issues: [SECURITY.md](SECURITY.md).
