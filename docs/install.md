# Deepiri IDE Desktop — Install & Setup

This document is the single reference for **how to get the installers** and **how to set up** the project (dev and first-run).

---

## Part 1: How to get the installers

### Prerequisites for building

| Requirement | Notes |
|-------------|--------|
| **Node.js** | 18+ (20+ recommended for `icon-gen` on macOS icons). Use `.nvmrc` if using nvm. |
| **npm** | Comes with Node (or use yarn/pnpm) |
| **OS for building** | Build **Windows** installers on Windows; **macOS** on macOS; **Linux** on Linux. Cross-compiling Windows/mac from Linux is possible with extra tooling but not covered here. |

### Build steps (same for all platforms)

Every installer build runs three steps in order:

1. **Icons** — `npm run build:icons`  
   Generates `assets/icon.png`, `assets/icon.ico` (Windows), `assets/icon.icns` (macOS).

2. **Renderer** — `npm run build:renderer`  
   Builds the React UI into `dist-renderer/` (Vite).

3. **Packager** — `electron-builder`  
   Packages the app and produces installers in `dist/`.

You can run the full chain with one command, or run steps individually.

### Commands and outputs

| Goal | Command | Where you run it | Output in `dist/` |
|------|---------|------------------|-------------------|
| Build for **current** OS | `npm run build` | Windows / macOS / Linux | Installers for that OS only |
| **Windows** installers | `npm run build:win` | **Windows** | See Windows row below |
| **macOS** installers | `npm run build:mac` | **macOS** | See macOS row below |
| **Linux** installers | `npm run build:linux` | **Linux** | See Linux row below |

### Exact installer filenames and formats

**Windows** (run `npm run build:win` on Windows):

| File | Format | Use |
|------|--------|-----|
| `Deepiri IDE Setup 1.0.0.exe` | NSIS installer | Double-click to install. Optional install path, Desktop + Start Menu shortcuts, Add/Remove Programs uninstall. |

**macOS** (run `npm run build:mac` on macOS):

| File | Format | Use |
|------|--------|-----|
| `Deepiri IDE-1.0.0.dmg` | Disk image (x64 + arm64) | Open, drag app to Applications. |
| `Deepiri IDE-1.0.0.pkg` | Package installer (x64 + arm64) | Run for guided install. |

**Linux** (run `npm run build:linux` on Linux):

| File | Format | Use |
|------|--------|-----|
| `desktop-ide-deepiri_1.0.0_amd64.deb` | Debian package | `sudo dpkg -i desktop-ide-deepiri_1.0.0_amd64.deb` (fix deps with `sudo apt -f install` if needed). |
| `Deepiri IDE-1.0.0.AppImage` | AppImage | `chmod +x "Deepiri IDE-1.0.0.AppImage"` then run; no system install. |

Version `1.0.0` comes from `package.json` → `version`; change it there and rebuild to get new numbers in filenames.

### Optional: run steps separately

```bash
npm run build:icons      # Only regenerate icons
npm run build:renderer   # Only rebuild UI (no electron-builder)
# Then for installers (includes icons + renderer):
npm run build            # current OS
npm run build:win        # Windows
npm run build:mac        # macOS
npm run build:linux      # Linux
```

### Custom app icon

- Replace `assets/icon.png` with your own **256×256 PNG**.
- Run `npm run build:icons` to regenerate `icon.ico` and `icon.icns`.
- Then run the desired build command (e.g. `npm run build:linux`).

---

## Part 2: How to set up

### 2.1 First-time project setup (dev machine)

```bash
# 1. Clone or open the repo
cd /path/to/Deepiri/deepiri-ide-desktop

# 2. Install dependencies (required for both dev and building installers)
npm install

# 3. (Optional) Environment
# Create .env if you need to override API/backend URLs or keys.
# The app works without .env (uses defaults / local fallbacks).
cp .env.example .env
# Edit .env with: API_URL, AI_SERVICE_URL, CYREX_INTERFACE_URL, HELOX_PATH, PYAGENT_API_KEY
```

After this you can either **run in development** or **build installers** (see below).

### 2.2 Running in development (two terminals)

The UI is served by Vite; Electron loads it in dev mode.

```bash
# Terminal 1 — Vite dev server (port 5173)
npm run dev:renderer

# Terminal 2 — Electron (loads http://localhost:5173, opens DevTools)
npm run dev
```

- **Requires:** `npm install` done once.
- **Optional:** Backend services (see 2.4) for full features.

### 2.3 Running the built app (no install)

Without building installers you can still run the packaged app from the build output:

```bash
# After at least one full build (e.g. npm run build:linux)
# Linux:
./dist/linux-unpacked/deepiri-ide-deepiri   # or "Deepiri IDE" binary name

# Or install from the installer, then launch "Deepiri IDE" from the OS.
```

### 2.4 Optional backend services (for full IDE features)

The app runs standalone; these are optional for tasks, AI, Cyrex UI, and Helox pipelines.

| Service | Default URL | Purpose |
|---------|-------------|---------|
| Platform API | `http://localhost:5000/api` | Tasks, sessions, gamification (env: `API_URL`) |
| Cyrex AI | `http://localhost:8000` | Classification, challenges, RAG, agents (env: `AI_SERVICE_URL`) |
| Cyrex UI | `http://localhost:5175` | Embedded “Cyrex” tab in the IDE (env: `CYREX_INTERFACE_URL`) |
| Helox | `../deepiri-platform/diri-helox` or `HELOX_PATH` | Pipelines tab: run training from the IDE |

**Setup (optional):** Start platform API and Cyrex in their repos; start Cyrex interface on 5175; set `HELOX_PATH` if needed. No `.env` is required; use it to override defaults.

### 2.5 Summary: setup by scenario

| Scenario | Steps |
|----------|--------|
| **Only build installers** | `npm install` → `npm run build` (or `build:win` / `build:mac` / `build:linux`) |
| **Develop the IDE** | `npm install` → Terminal 1: `npm run dev:renderer` → Terminal 2: `npm run dev` |
| **Use installers on another machine** | Copy `.exe` / `.deb` / `.AppImage` / `.dmg` / `.pkg` from `dist/` and install/run per table in Part 1 |
| **Full features (tasks, AI, Cyrex, pipelines)** | Same as above + run platform API, Cyrex, Cyrex UI, and (optional) set `HELOX_PATH` |

---

## Quick reference

- **Get installers:** `npm install` then `npm run build` (or `build:win` / `build:mac` / `build:linux`). Output in `dist/`.
- **Setup dev:** `npm install`, then `npm run dev:renderer` + `npm run dev` in two terminals.
- **Config (optional):** `.env` or env vars for `API_URL`, `AI_SERVICE_URL`, `CYREX_INTERFACE_URL`, `HELOX_PATH`, `PYAGENT_API_KEY`.
