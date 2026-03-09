# Deepiri Emotion Desktop — Install & Setup

This document covers **how to get the installers** and **how to set up** the project (dev and first-run). For a single guide that includes everything to run the app fully (prerequisites, dev, build, backends, env, verify), see **[setup.md](setup.md)**.

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
| `Deepiri Emotion Setup 1.0.0.exe` | NSIS installer | Double-click to install. Optional install path, Desktop + Start Menu shortcuts, Add/Remove Programs uninstall. |

**macOS** (run `npm run build:mac` on macOS):

| File | Format | Use |
|------|--------|-----|
| `Deepiri Emotion-1.0.0.dmg` | Disk image (x64 + arm64) | Open, drag app to Applications. |
| `Deepiri Emotion-1.0.0.pkg` | Package installer (x64 + arm64) | Run for guided install. |

**Linux** (run `npm run build:linux` on Linux):

| File | Format | Use |
|------|--------|-----|
| `deepiri-emotion-desktop_1.0.0_amd64.deb` | Debian package | `sudo dpkg -i deepiri-emotion-desktop_1.0.0_amd64.deb` (fix deps with `sudo apt -f install` if needed). |
| `Deepiri Emotion-1.0.0.AppImage` | AppImage | `chmod +x "Deepiri Emotion-1.0.0.AppImage"` then run; no system install. |

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
cd /path/to/Deepiri/deepiri-emotion-desktop

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
- **Optional:** Backend services (see 2.5) for full features.

### 2.3 Running the built app (no install)

Without building installers you can still run the packaged app from the build output:

```bash
# After at least one full build (e.g. npm run build:linux)
# Linux:
./dist/linux-unpacked/deepiri-emotion   # or "Deepiri Emotion" binary name

# Or install from the installer, then launch "Deepiri Emotion" from the OS.
```

### 2.4 AI & coding agent: get started

The **coding agent** (AI Chat, Emotion agents, inline help) can use **cloud API keys** or **local runtimes**—no key required for the latter.

#### Option A: Use an API key (fastest to start)

1. Open **File → Settings** (or **Ctrl+,** / **Cmd+,**).
2. Go to **API & Model** (or the **AI** / **Provider** section in Settings).
3. Choose **API / Provider**: **OpenAI (GPT)**, **Anthropic (Claude)**, or **Google (Gemini)**.
4. Enter your **API key** in the field (keys are stored locally in app userData, not sent anywhere except the chosen provider).
5. Pick a **model** (e.g. `gpt-4o-mini`, `claude-3-5-sonnet`, `gemini-1.5-flash`).
6. Click **Save**.

You can start using **AI Chat** and **Emotion** agents immediately. For strong coding assistance, prefer **Claude** or **GPT-4**-class models when using cloud APIs.

#### Option B: No API key — use a local runtime

Two no-key options: **Cyrex runtime** (diri-cyrex) or **Ollama**. The app **auto-detects** when either is running: if Cyrex is available at `http://localhost:8000` (or your `AI_SERVICE_URL`), or Ollama at `http://localhost:11434`, it finds and uses that URL so you don’t have to type it.

| Option | What to do | Best for |
|--------|------------|----------|
| **Cyrex / Runtime (diri-cyrex)** | Run the Cyrex backend (e.g. from a repo such as `diri-cyrex`; the path is your own—e.g. `../diri-cyrex` is only an example). Start the service so it listens (default `http://localhost:8000`). In Settings → API & Model, choose **Cyrex / Runtime (diri-cyrex)**. The app detects when Cyrex is running and fills in the URL; you can change it if your service is on another port. | Full coding agent, RAG, and custom agents when the backend is running. |
| **Ollama** | Install [Ollama](https://ollama.com), then run e.g. `ollama run llama3.2`. In Settings → API & Model, choose **Local (Ollama or Cyrex runtime)**, select **Ollama**. The app detects Ollama at `http://localhost:11434` when it’s running; set your model and Save. | Local-only, no API key; good for code models (e.g. `llama3.2`, `codellama`). |

- **Cyrex runtime** is beneficial when you want the full Cyrex stack (agents, RAG, classification). The repo path (e.g. `../diri-cyrex`) depends on your machine; you run that project’s server and the desktop app finds it when it’s running.
- **Ollama** needs no extra repo: install Ollama, pull a model; when Ollama is running, the app detects it automatically.

Settings are saved per app install (in userData). You can switch provider or model anytime in Settings.

### 2.5 Optional backend services (for full IDE features)

The app runs standalone; these are optional for tasks, AI, Cyrex UI, and Helox pipelines.

| Service | Default URL | Purpose |
|---------|-------------|---------|
| Platform API | `http://localhost:5000/api` | Tasks, sessions, gamification (env: `API_URL`) |
| Cyrex AI | `http://localhost:8000` | Classification, challenges, RAG, agents (env: `AI_SERVICE_URL`) |
| Cyrex UI | `http://localhost:5175` | Embedded “Cyrex” tab in the IDE (env: `CYREX_INTERFACE_URL`) |
| Helox | `../deepiri-platform/diri-helox` or `HELOX_PATH` | Pipelines tab: run training from the IDE |

**Setup (optional):** Start platform API and Cyrex in their repos; start Cyrex interface on 5175; set `HELOX_PATH` if needed. No `.env` is required; use it to override defaults.

### 2.6 First run (after installing from an installer)

1. Launch **Deepiri Emotion** from your OS (Start menu, Applications, or desktop shortcut).
2. You’ll see the **Welcome** screen. Click **Open Folder** and choose a project directory (or use **Recent** if you’ve opened one before).
3. Use the **Explorer** sidebar to open files. Edit in the **Monaco** editor; use **Ctrl+S** to save.
4. **Terminal** (bottom panel) runs in your project root. **AI Chat** and **Tasks** work if you run the optional backends; otherwise you can still edit, search, and use the terminal.
5. **File → Settings** (or **Ctrl+,**) to set **API & Model** for the coding agent (see 2.4), and to change theme, font size, or API URLs.

### 2.7 Summary: setup by scenario

| Scenario | Steps |
|----------|--------|
| **Only build installers** | `npm install` → `npm run build` (or `build:win` / `build:mac` / `build:linux`) |
| **Develop the IDE** | `npm install` → Terminal 1: `npm run dev:renderer` → Terminal 2: `npm run dev` |
| **Use coding agent (API key)** | File → Settings → API & Model → pick OpenAI / Anthropic / Google → paste key → Save. Use AI Chat or Emotion. |
| **Use coding agent (no key)** | Run **Cyrex** (e.g. at `http://localhost:8000`) or **Ollama** (e.g. at `http://localhost:11434`). The app auto-detects when either is running and uses it; in Settings → API & Model choose Cyrex or Local → Ollama if needed. |
| **Use installers on another machine** | Copy `.exe` / `.deb` / `.AppImage` / `.dmg` / `.pkg` from `dist/` and install/run per table in Part 1 |
| **Full features (tasks, AI, Cyrex, pipelines)** | Same as above + run platform API, Cyrex, Cyrex UI, and (optional) set `HELOX_PATH` |

---

## Quick reference

- **Get installers:** `npm install` then `npm run build` (or `build:win` / `build:mac` / `build:linux`). Output in `dist/`.
- **Setup dev:** `npm install`, then `npm run dev:renderer` + `npm run dev` in two terminals.
- **Coding agent:** File → Settings → API & Model. Use an **API key** (OpenAI / Anthropic / Google) or **no key** with **Cyrex runtime** or **Ollama** (see 2.4). The app auto-detects when Cyrex or Ollama is running. The app **auto-detects** when Cyrex or Ollama is running and uses it.
- **Config (optional):** `.env` or env vars for `API_URL`, `AI_SERVICE_URL`, `CYREX_INTERFACE_URL`, `HELOX_PATH`, `PYAGENT_API_KEY`.
