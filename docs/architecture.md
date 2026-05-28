# Deepiri Emotion Desktop — Architecture

High-level architecture of the desktop application and how it fits into the Deepiri platform.

---

## Tech stack (actual)

### Desktop & UI

| Layer | Technology | Role |
|-------|------------|------|
| **Desktop runtime** | Electron 28 | Main process, window management, IPC, native menus |
| **Renderer** | React 18 (JSX) | UI components, state, routing (single-page) |
| **Build** | Vite 5 | Dev server (HMR), production bundle for renderer |
| **Editor** | Monaco Editor (@monaco-editor/react) | Code editing, syntax highlighting, themes |

### Shared and main process (Node.js)

- **Shared:** `src/shared/` — `defaults.js`, `constants.js`, and `ipcChannels.js` (single source of IPC channel names for main and preload). Renderer config re-exports from shared where applicable.
- **Indexing:** `src/indexing.js` — workspace listing and exclude patterns; used by main process file service.
- **Main entry:** `src/main.js` — thin entry; calls `createApp()` from `src/main/index.js` on `app.whenReady()`.
- **Main orchestrator:** `src/main/index.js` — creates window, menu, and registers all IPC services. Bootstrap: `src/main/bootstrap-env.js` (paths, API URLs), `src/main/bootstrap-args.js` (isDev, getLaunchArgs for CLI folder/file).
- **Services:** `src/main/services/*.js` — each service registers its IPC handlers with `ipcMain`: `workspaceService`, `fileService`, `terminalService`, `aiService`, `agentService`, `platformService`, `heloxService`, `shellService`, `extensionsService`, `integrationService`, `dbService`. Handlers use channel names from `src/shared/ipcChannels.js`. **Integrations:** `integrationService` stores credentials in userData; GitHub sync (issues) and Notion (list databases) are implemented; other syncs return a clear “not implemented for X” where applicable. **DB:** `dbService` uses sql.js to persist chat history in `userData/app.db`. `extensionsService` lists built-in extensions from `extensions/` and the platform catalog in `src/shared/integrationsCatalog.js`.
- **Preload:** `src/preload.js` — exposes `window.electronAPI`; methods call Electron `ipcRenderer.invoke` handlers.

### Renderer (React)

- **Entry:** `src/renderer/main.jsx` → `App.jsx`
- **Structure:** `components/`, `features/`, `context/`, `hooks/`, `services/`, `api/`, `styles/`, `integrations/`.
- **State:** React state + context (Theme, Notifications, Emotion); no global store (Redux) by default.
- **API layer:** `src/renderer/api/` — `getElectronAPI()`, `api` (null-safe facade), `ENDPOINTS`. Use `api.runCommand()`, `api.getAiSettings()`, etc. instead of `window.electronAPI` for consistent error handling and when API is missing.

---

## Architecture layers

### 1. Main process (Electron)

- Creates `BrowserWindow`, loads renderer (dev: Vite URL; prod: `dist-renderer/index.html`).
- **IPC:** All channel names in `src/shared/ipcChannels.js`. Handlers live in `src/main/services/` (file, workspace, terminal, AI, agent, platform, Helox, shell, extensions). CLI args after `--` (e.g. `electron . -- /path/to/folder`) set project root at startup.
- **Multi-terminal:** Shell processes keyed by `terminalId`; output/exit events include `terminalId` so the renderer can route to the correct tab.
- **Subagents:** Agent runtime (`agentRuntime.js`) supports `registerAgent`, `unregisterAgent`, `listAgents`; exposed via IPC for the Emotion panel.
- No direct DOM access; all file/shell access goes through main.
- **Local data:** Main process stores AI settings, usage, and limits as JSON files in `app.getPath('userData')`. The renderer uses `localStorage` (Chromium-backed, same directory). A **local SQLite DB** (sql.js) in `userData/app.db` stores chat history (see `dbService.js`). See **[Local storage](local-storage.md)** for the full picture and when to add more DB usage.

### 2. Renderer (React)

- **Activity bar + sidebar:** Explorer (workspace tree), Tasks, Challenges, Gamification, Integrations, Cyrex, Pipelines, Search, Outline, Keybindings, Extensions, API & Models, Emotion (agents + runtime subagents).
- **Editor area:** Tabs (with settings: full path, double-click to close, confirm unsaved), Monaco editor, breadcrumbs; optional Cyrex embed, Pipelines view, Search panel, Visual canvas.
- **Bottom panel:** Terminal (multiple tabs, + to add), Output, Debug Console, Ports, Problems, Fine-tune, **Tools** (run_command, read_file; registry for AI/automation).
- **Overlays:** Command palette (Ctrl+Shift+P), Quick Open (Ctrl+P), Notifications, Diff view, Create launcher (Ctrl+Shift+N).
- **Hooks:** Lifecycle hooks (beforeSave, afterSave, afterOpen, beforeClose) via `hooksRegistry`; App calls them on save/open. Register in code; Settings documents the API.

### 3. Optional backend services

- **Platform API** (`API_URL`): Tasks, sessions, gamification.
- **Cyrex AI** (`AI_SERVICE_URL`): Classification, challenges, RAG, chat completion, agents.
- **Cyrex UI** (`CYREX_INTERFACE_URL`): Embedded iframe in Cyrex tab.
- **Helox** (`HELOX_PATH`): Training pipelines run via main process (subprocess/scripts).

---

## Key features (implemented)

- **Workspace:** Open folder → real file tree; create/rename/delete files and folders; open files in tabs; Workspace view lists files with refresh; indexing settings (index on open, exclude patterns).
- **Monaco editor:** Syntax highlighting, themes (ThemeContext), save (Ctrl+S), cursor/selection for AI context, go to line/symbol.
- **AI:** Context-aware chat (current file + selection), “Apply to file”, diff view; **model selection** shown in chat header (from Settings → AI Provider); Emotion agents (predefined + custom) with system prompts.
- **Multi-terminal:** Terminal panel with tabs; add/close terminals; each has its own output and input; Run/Preview use default terminal.
- **Subagents:** Emotion panel → Runtime subagents: list/register/unregister in-process agents (Fabric bus).
- **Tools:** Registry (`toolsRegistry.js`) with built-ins (run_command, read_file); Tools panel in bottom panel; invokable from UI or for future AI function calling.
- **Hooks:** `hooksRegistry` with beforeSave, afterSave, afterOpen, beforeClose; App runs them; Settings → Hooks documents usage.
- **Quick Open / Command palette:** Ctrl+P file picker, Ctrl+Shift+P commands (including Open Tools panel).
- **Welcome:** Recent folders/files, quick actions, rotating tips (terminals, subagents, tools, hooks, model).
- **Settings:** Account, Agents, Tabs, Networking, Indexing & Docs, Tools, Hooks; saved to storage; settings-saved event so tabs/theme apply without restart.
- **Chat history:** Persisted in local SQLite (`dbService`); loaded and appended per session (project root or default); clear from AI Chat header.
- **Cyrex & Helox:** Tabs and IPC to backend/pipelines; optional services.

---

## Security and packaging

- **Context isolation:** Preload script only exposes whitelisted API; no `nodeIntegration` in renderer.
- **Build:** `electron-builder` produces installers (NSIS, DMG/PKG, deb/AppImage); `dist-renderer/` is generated by Vite and included in the app package.
- **Packaged contents:** The desktop installer includes `src/` (main, shared, preload, renderer source for main process), `dist-renderer/` (built React UI with Integrations panel), `extensions/` (built-in integration manifests: Notion, GitHub, Helox, Cyrex), and `assets/`. Integrations (connect, disconnect, sync with GitHub/Notion; platform catalog) are fully included and work in the packaged app; credentials are stored in the app’s userData directory.

---

## Docs

- **[Install & setup](install.md)** — Build installers, dev setup, optional backends, Terminal CLI.
- **[Local storage](local-storage.md)** — Where user data is stored (userData, JSON, localStorage, SQLite); when to add more DB usage.
- **[CLI TUI plan](cli-tui-plan.md)** — Terminal CLI architecture and implementation phases.
- **[Refactoring plan](refactoring.md)** — Merger plan for Cyrex UI and Helox integration.
