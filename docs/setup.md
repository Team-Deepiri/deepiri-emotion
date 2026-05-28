# Deepiri Emotion Desktop — Full setup guide

Everything you need to **run the app** (dev or built) and to run it **fully** with optional backends. Use this as the single reference for getting from clone to a working IDE.

---

## 0. One-command full setup (automated)

A script automates **install dependencies → (optional lint/test) → build → produce installers** so you can then install or run the desktop app.

**From the repo root** (after cloning):

```bash
# Make the script executable (once)
chmod +x scripts/setup-full.sh

# Full setup: install deps, run check, build installers for this OS
./scripts/setup-full.sh
```

Or via npm (no chmod needed):

```bash
npm run setup
```

When it finishes, it prints where the installers are (`dist/`) and how to install or run the app on your OS (e.g. `.deb` / AppImage on Linux, `.exe` on Windows, `.dmg` / `.pkg` on macOS).

**Options:**

| Option | Effect |
|--------|--------|
| `--install-only` | Only run `npm install`; do not build. Use this if you only want to run in dev. |
| `--no-env` | Do not create `.env` from `.env.example`. |
| `--skip-check` | Skip lint and tests before building (faster, less safe). |

**Examples:**

```bash
./scripts/setup-full.sh --install-only    # Just npm install
./scripts/setup-full.sh --skip-check     # Install + build without running tests
npm run setup:install                     # Same as --install-only via npm
```

**Requirements:** Node.js 18+ and npm (see section 1). The script checks the Node version and exits with a clear message if it’s too old. Build installers for the **current OS** (e.g. build on Linux → Linux installers).

---

## 1. Prerequisites

| Requirement | Version / notes |
|-------------|------------------|
| **Node.js** | **18+** (20+ recommended; use [.nvmrc](.nvmrc) with nvm: `nvm use`). |
| **npm** | Comes with Node (or use yarn/pnpm; commands below use `npm`). |
| **Git** | To clone the repo. |
| **OS for building installers** | Build **Windows** on Windows, **macOS** on macOS, **Linux** on Linux. |

---

## 2. Clone and install

```bash
# Clone (or open your existing clone)
git clone https://github.com/deepiri/deepiri-ide-desktop.git
cd deepiri-ide-desktop

# Or if the repo is named differently:
# cd path/to/deepiri-emotion-desktop

# Install dependencies (required for dev and for building)
npm install
```

After this you can run in **development** or **build installers** (sections 3–5).

---

## 3. Run in development (two terminals)

The UI is served by Vite; Electron loads it with hot reload and DevTools.

**Terminal 1 — Vite dev server (port 5173):**

```bash
npm run dev:renderer
```

Leave this running. You should see: `Local: http://localhost:5173/`

**Terminal 2 — Electron:**

```bash
npm run dev
```

Electron opens the app window and loads `http://localhost:5173`. DevTools open automatically in dev mode.

- **Requires:** `npm install` done once.
- **Without backends:** You get the full UI: workspace, editor, terminal, tabs. AI chat, tasks, and Cyrex tabs work with reduced or mock behavior until you start the optional services (section 7).

---

## 4. Run the built app (no installer)

To run the packaged app without building an installer:

```bash
# Build renderer + run Electron (no installer)
npm run start:prod
```

Or build then run the unpacked binary:

```bash
npm run build:renderer
npm run build:icons
# Then one of (depends on OS after electron-builder):
# Linux:   ./dist/linux-unpacked/deepiri-emotion   # or similar
# Windows: dist\win-unpacked\Deepiri Emotion.exe
# macOS:   dist/mac/Deepiri Emotion.app
```

For a proper installer (`.exe`, `.deb`, `.AppImage`, `.dmg`, etc.), use section 5.

---

## 5. Build installers

Full build (icons + renderer + packager) for the **current OS**:

```bash
npm run build
```

**Per platform** (run on that OS for best results):

| Goal | Command | Output in `dist/` |
|------|---------|-------------------|
| Windows | `npm run build:win` | `Deepiri Emotion Setup 1.0.0.exe` (NSIS) |
| macOS | `npm run build:mac` | `Deepiri Emotion-1.0.0.dmg`, `Deepiri Emotion-1.0.0.pkg` |
| Linux | `npm run build:linux` | `deepiri-emotion-desktop_1.0.0_amd64.deb`, `Deepiri Emotion-1.0.0.AppImage` |

**Steps separately (optional):**

```bash
npm run build:icons      # Regenerate assets/icon.ico, icon.icns from icon.png
npm run build:renderer   # Vite build → dist-renderer/
npm run build            # Icons + renderer + electron-builder for current OS
```

After building, install and launch the app like any normal application (e.g. run the `.exe`, drag the app from the `.dmg`, or `sudo dpkg -i …` for the `.deb`).

---

## 6. Optional: environment variables

The app runs with built-in defaults. Override them only if you need different URLs or keys.

**Create `.env` from the example:**

```bash
cp .env.example .env
# Edit .env with your values
```

**Variables (all optional):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `API_URL` | `http://localhost:5000/api` | Platform API (tasks, sessions, gamification). |
| `AI_SERVICE_URL` | `http://localhost:8000` | Cyrex AI (classification, challenges, RAG, chat). |
| `CYREX_INTERFACE_URL` | `http://localhost:5175` | Cyrex web UI (embedded in the “Cyrex” tab). |
| `HELOX_PATH` | Auto-detected relative to repo | Path to `diri-helox` (Helox pipelines). |
| `PYAGENT_API_KEY` | (none) | API key sent to backend if required. |

You can also set these in your shell instead of using `.env`. The app does **not** require `.env` to run.

---

## 7. Running with full features (optional backends)

To get **tasks, AI chat, Cyrex tab, and Helox pipelines** working end-to-end, run these services. The desktop app works without them; with them you get the full IDE experience.

### 7.1 Platform API (tasks, sessions, gamification)

- **Default URL:** `http://localhost:5000/api`
- **What to run:** Your Deepiri platform API server (or mock) that exposes tasks, sessions, gamification.
- **In the app:** Tasks panel, session tracking, gamification state.

**How:** Start the API in its repo (e.g. `npm run start` or your usual command) so it listens on port 5000. Set `API_URL` in `.env` if it runs elsewhere.

### 7.2 Cyrex AI (classification, challenges, RAG, chat)

- **Default URL:** `http://localhost:8000`
- **What to run:** Cyrex AI service (or compatible backend).
- **In the app:** AI chat, “Apply to file”, classification, challenge generation, hints, code completion.

**How:** Start the Cyrex backend in its repo so it listens on port 8000. Set `AI_SERVICE_URL` in `.env` if different.

### 7.3 Cyrex web UI (embedded tab)

- **Default URL:** `http://localhost:5175`
- **What to run:** Cyrex web interface (e.g. Vite dev server or built app).
- **In the app:** The “Cyrex” tab shows this UI in an iframe.

**How:** Run the Cyrex UI dev server (or serve the built assets) on port 5175. Set `CYREX_INTERFACE_URL` in `.env` if different.

### 7.4 Helox (pipelines)

- **Path:** `HELOX_PATH` or default relative to repo (e.g. `../deepiri-platform/diri-helox`).
- **What to run:** The Helox / diri-helox repo available on disk.
- **In the app:** Pipelines tab — run training pipelines from the IDE.

**How:** Clone or symlink the Helox repo and set `HELOX_PATH` in `.env` to its path if it’s not at the default location.

### 7.5 Summary: “run fully”

| Step | Action |
|------|--------|
| 1 | `npm install` in this repo. |
| 2 | Start **Platform API** (port 5000). |
| 3 | Start **Cyrex AI** (port 8000). |
| 4 | Start **Cyrex UI** (port 5175). |
| 5 | Set **HELOX_PATH** if Helox is not at default path. |
| 6 | Terminal 1: `npm run dev:renderer` |
| 7 | Terminal 2: `npm run dev` |

Then open a folder in the app and use Tasks, AI Chat, Cyrex tab, and Pipelines.

---

## 8. Verify setup (lint, test, build)

Before committing or distributing, run:

```bash
npm run check
```

This runs:

1. **Lint** — `eslint src`
2. **Tests** — Vitest (renderer + Node indexing tests)
3. **Build** — `vite build` (renderer)

Optional:

- `npm run test:coverage` — tests with coverage.
- `npm run lint:fix` — auto-fix lint where possible.

---

## 9. First run checklist

1. **Launch** — From installer or `npm run dev` (with `npm run dev:renderer` in another terminal).
2. **Welcome** — Use “Open Folder” to choose a project directory (or “Recent” if you’ve opened one before).
3. **Explorer** — Open files from the sidebar; edit in the Monaco editor; **Ctrl+S** to save.
4. **Terminal** — Bottom panel; runs in project root.
5. **Settings** — **File → Settings** (or **Ctrl+,**) for theme, font size, API URLs.
6. **AI / Tasks** — If you started the optional backends (section 7), use AI Chat and Tasks; otherwise the UI still works for editing, search, and terminal.

---

## Quick reference

| Goal | Command / step |
|------|-----------------|
| **Automated full setup** | `./scripts/setup-full.sh` or `npm run setup` (install + build + installer in `dist/`) |
| **Install deps only** | `npm install` or `npm run setup:install` |
| **Dev (two terminals)** | `npm run dev:renderer` then `npm run dev` |
| **Run built app** | `npm run start:prod` |
| **Build installers** | `npm run build` (or `build:win` / `build:mac` / `build:linux`) |
| **Full features** | Start Platform API (5000), Cyrex AI (8000), Cyrex UI (5175); set `HELOX_PATH` if needed |
| **Config** | Copy `.env.example` to `.env` and set `API_URL`, `AI_SERVICE_URL`, `CYREX_INTERFACE_URL`, `HELOX_PATH`, `PYAGENT_API_KEY` as needed |
| **Verify** | `npm run check` |

For installer filenames and per-platform install steps, see **[install.md](install.md)**. For architecture and tech stack, see **[architecture.md](architecture.md)**.
