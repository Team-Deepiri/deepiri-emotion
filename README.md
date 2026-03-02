# Deepiri IDE

**AI-powered desktop IDE** with task management, gamification, Cyrex AI, and Helox pipelines. Built with Electron, React, and Monaco Editor.

---

## Features

- **Workspace** — Open a folder, browse and edit files with a real file tree; create, rename, delete files and folders.
- **Monaco Editor** — Syntax highlighting, themes (dark/light/hc), multiple tabs, save (Ctrl+S), cursor/selection for AI context.
- **AI** — Context-aware chat (current file + selection), “Apply to file”; optional Cyrex backend for classification, challenges, RAG.
- **Quick Open & Command Palette** — Ctrl+P (go to file), Ctrl+Shift+P (commands).
- **Welcome** — Recent folders, quick actions, getting started.
- **Terminal** — Integrated panel with project-root cwd and streamed output.
- **Cyrex & Helox** — Tabs for Cyrex UI (when running) and Helox pipeline runs; optional backend services.
- **Tasks, Challenges, Gamification** — Platform API integration; mission cards and progress tracking.

---

## Quick start

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
deepiri-ide-desktop/
├── src/
│   ├── main.js              # Electron main process (IPC, window, shell, file system)
│   ├── preload.js           # Bridge (window.electronAPI)
│   └── renderer/            # React UI
│       ├── main.jsx         # Entry (providers + App)
│       ├── App.jsx           # Shell (activity bar, sidebar, editor, panels)
│       ├── components/      # Editor, workspace, panels, UI
│       ├── features/        # Quick open, AI chat, diff view
│       ├── context/         # Theme, notifications
│       ├── hooks/            # Keybindings, session
│       ├── services/        # AI, tasks, challenges, recent
│       ├── styles/
│       └── integrations/
├── scripts/
│   └── generate-icons.cjs   # Build icon.ico / icon.icns from icon.png
├── assets/                  # icon.png (256×256); generated .ico, .icns
├── docs/                    # Install, architecture, refactoring
├── .env.example             # Optional env (API_URL, AI_SERVICE_URL, etc.)
├── .editorconfig
├── .gitignore
├── .nvmrc
├── LICENSE
├── package.json
└── vite.config.js
```

---

## Documentation

| Doc | Content |
|-----|---------|
| **[docs/install.md](docs/install.md)** | Installers, dev setup, optional backends (Platform API, Cyrex, Helox). |
| **[docs/architecture.md](docs/architecture.md)** | Tech stack, main vs renderer, security, packaging. |
| **[docs/refactoring.md](docs/refactoring.md)** | Plan for merging Cyrex UI and Helox into the IDE. |

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
| `npm run build` | Icons + renderer + electron-builder for current OS. |
| `npm run build:icons` | Regenerate `assets/icon.ico` and `assets/icon.icns` from `assets/icon.png`. |
| `npm run build:renderer` | Vite production build → `dist-renderer/`. |
| `npm run build:win` / `build:mac` / `build:linux` | Build installers for that platform. |
| `npm test` | Run unit tests (Vitest). |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run test:coverage` | Run tests with coverage report. |
| `npm run lint` | Lint source with ESLint. |
| `npm run lint:fix` | Lint and fix what can be auto-fixed. |

---

## License

MIT — see [LICENSE](LICENSE).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute. Security issues: [SECURITY.md](SECURITY.md).
