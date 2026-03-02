# Refactoring Plan: Deepiri IDE Desktop — Full Merger with Cyrex AI & Helox Pipelines

This document is an in-depth plan for refactoring the **Deepiri IDE Desktop** into a single, fully integrated desktop application that:

1. **Merges the Cyrex interface visually** — The desktop IDE adopts the Cyrex testing/admin UI (Agent Playground, RAG, Workflows, etc.) as first-class panels/views inside the same window.
2. **Powers applications with Cyrex AI** — All existing Cyrex API usage (task classification, challenge generation, RAG, orchestration, agents) continues and is extended so the IDE can "power up" apps and workflows from the desktop.
3. **Embeds Helox pipelines** — Training and data pipelines from Helox are runnable and monitorable from the IDE (run pipelines, view logs, optional config UI).

The goal is **integration and merger**, not a straight copy-paste: one codebase, one Electron app, one unified UX.

---

## 1. Current State Summary

### 1.1 Deepiri IDE Desktop (`deepiri-ide-desktop/`)

| Aspect | Current State |
|--------|----------------|
| **Stack** | Electron 28, React (JSX), Vite dev server (port 5173), no React Router |
| **Entry** | `src/main.js` (main), `src/preload.js` (bridge), `src/renderer/App.jsx` |
| **Layout** | Activity bar → Sidebar (Explorer, Tasks, Challenges, Gamification, Integrations, AI) → Editor area → AI panel → Mission cards → Status bar |
| **IPC implemented** | `api-request`, `ai-request`, `classify-task`, `generate-challenge`, `get-app-version` only |
| **Backend** | Platform API: `http://localhost:5000/api`; Cyrex AI: `http://localhost:8000` |
| **Gaps** | Many preload APIs (`openFile`, `saveFile`, `getTasks`, `createTask`, `startSession`, etc.) have **no `ipcMain.handle`** in main process; docs mention Tauri but app is Electron-only |

### 1.2 Cyrex Backend & UI

| Aspect | Current State |
|--------|----------------|
| **Backend** | `deepiri-platform/diri-cyrex/app/` — FastAPI on port 8000 (challenge, task, RAG, agent, workflow, orchestration, etc.) |
| **Cyrex UI** | `deepiri-platform/diri-cyrex/cyrex-interface/` — Vite + React + TypeScript, port 5175; **separate web app**, not embedded in desktop |
| **Tabs** | Agent Playground, Infrastructure Suite, Orchestration, Workflows, LangGraph Workflow, Local LLM, RAG/Vector Store, Tools, State Management, Monitoring, Safety/Guardrails, Chat, Vendor Fraud, Document Indexing, Health, History |
| **Desktop link** | Desktop only calls Cyrex **API** (8000); no shared UI bundle or iframe |

### 1.3 Helox

| Aspect | Current State |
|--------|----------------|
| **Location** | `deepiri-platform/diri-helox/` |
| **Content** | Training pipelines (`pipelines/training/`), scripts (`scripts/pipelines/`), e.g. `run_training_pipeline.py`, `quick_train.sh` |
| **Integration** | `integrations/cyrex_rag_bridge.py` connects Helox to Cyrex RAG; no HTTP API, no desktop integration |
| **Run method** | CLI / Python (e.g. `python scripts/pipelines/run_training_pipeline.py`) |

### 1.4 Web Frontend (Platform)

- **Status:** The main platform web frontend (`deepiri-web-frontend`) is **not present** in this workspace (submodule or separate repo). Merge of "web frontend" into desktop will require that repo to be available; this plan assumes it can be added later as a second phase of UI merge (routes/pages into desktop renderer or as a loadable bundle).

---

## 2. Target Architecture

### 2.1 Single Desktop Application

- **One Electron app** — `deepiri-ide-desktop` remains the only desktop entry point.
- **One renderer process** — One React tree (with optional code-splitting by view), not multiple BrowserWindows for Cyrex vs IDE.
- **Unified shell** — Activity bar + sidebar combine:
  - **IDE views:** Explorer, Tasks, Challenges, Gamification, Integrations, (existing) AI Assistant.
  - **Cyrex views:** Agent Playground, Workflows, RAG, Orchestration, Local LLM, Tools, State, Monitoring, Safety, Chat, Vendor Fraud, Document Indexing, Health, History, Infrastructure Suite.
  - **Helox view:** Pipelines (run, config, logs).
- **Cyrex AI** — All Cyrex-backed features (challenges, classification, RAG, agents, workflows) are used from this shell; no separate Cyrex "app" window.
- **Helox** — Pipelines are started and monitored from the IDE (e.g. "Pipelines" sidebar section + output panel).

### 2.2 Data Flow

- **Platform API (5000)** — Tasks, challenges, users, sessions (when implemented) via existing `api-request` IPC.
- **Cyrex (8000)** — All AI/orchestration/RAG/agent endpoints via `ai-request` and dedicated handlers (e.g. `classify-task`, `generate-challenge`), plus any new IPC for workflows, RAG, chat, etc.
- **Helox** — Invoked by main process (e.g. `child_process.spawn` Python) or via a small local "Helox runner" service; status/logs streamed back via IPC to renderer.

### 2.3 File Layout (Target)

```
deepiri-ide-desktop/
├── src/
│   ├── main.js              # Electron main: windows, menu, IPC (incl. Helox runner)
│   ├── preload.js           # Exposes electronAPI + ide; all channels implemented in main
│   └── renderer/
│       ├── index.html
│       ├── main.jsx         # Single entry; wraps app in providers
│       ├── App.jsx          # Shell: activity bar, sidebar, editor area, panels
│       ├── routes/          # (Optional) If web frontend merged with router
│       ├── views/           # Top-level views
│       │   ├── ide/         # Explorer, Tasks, Challenges, Gamification, Integrations
│       │   ├── cyrex/       # All Cyrex tabs as views (Agent Playground, RAG, Workflows, …)
│       │   └── helox/       # Pipeline list, run config, log viewer
│       ├── components/      # Shared + IDE-specific components
│       ├── context/         # UIContext (extended with Cyrex tab state), Session, etc.
│       ├── services/        # aiService, challengeService, taskService, cyrexApi, heloxRunner
│       ├── integrations/
│       └── styles/
├── package.json
└── docs/                    # Documentation (this file in docs/refactoring.md)
```

Cyrex-interface code is **merged** into `src/renderer/views/cyrex/` and `src/renderer/components/` (and context), not dropped in as a separate app.

---

## 3. Refactoring Phases

### Phase 1: Foundation — IPC, Preload, and Main Process

**Goal:** Every preload API used by the renderer has a corresponding IPC handler in main; desktop can talk to platform API and Cyrex reliably.

1. **Audit preload vs main** — List all `window.electronAPI.*` usages; add `ipcMain.handle` for each missing channel.
2. **Standardize channels** — Use `api-request` / `ai-request` for generic calls; add named handlers where beneficial.
3. **Environment** — Keep `API_BASE_URL` and `AI_SERVICE_URL` configurable (env or config file).

**Deliverables:** Updated `main.js` and `preload.js`; all existing IDE features that rely on IPC work.

---

### Phase 2: Merge Cyrex Interface into Desktop Renderer

**Goal:** The Cyrex UI (sidebar tabs + content) lives inside the same React tree as the IDE.

1. **Dependencies** — Add any deps from `cyrex-interface/package.json`.
2. **Context** — Copy or adapt Cyrex UIContext; extend IDE state with Cyrex tab state.
3. **Layout** — One sidebar with sections: IDE, Cyrex, Pipelines; Cyrex nav and tab content as views.
4. **Component migration** — Create `src/renderer/views/cyrex/*` and `components/cyrex/*`; replace `fetch`/`axios` with IPC.
5. **Styling** — Merge Cyrex CSS under a namespace (e.g. `.cyrex-panel`).
6. **API base URL** — From main via `get-config` IPC.

**Deliverables:** Single IDE window with IDE + Cyrex views; Cyrex tabs functional via IPC.

---

### Phase 3: Cyrex AI "Powering" Desktop Applications

**Goal:** IDE uses Cyrex AI for tasks, challenges, assistant, editor actions.

1. **Existing usage** — Keep task classification and challenge generation from Task Manager and Challenge Panel.
2. **Extensions** — AI Assistant backed by Cyrex chat; optional editor "AI actions" (summarize, generate tests).
3. **RAG in IDE** — Same RAG collections queryable from AI Assistant or "Search knowledge" command.

**Deliverables:** Documented flows; code changes in AIAssistant and any new AI actions.

---

### Phase 4: Helox Pipeline Integration

**Goal:** Users can run and monitor Helox pipelines from the IDE.

1. **Runner** — IPC `run-helox-pipeline` in main; `child_process.spawn` Python script; stream stdout/stderr to renderer.
2. **Paths** — Helox root from `HELOX_PATH` or config; script path (e.g. `scripts/pipelines/run_training_pipeline.py`).
3. **UI** — Pipelines sidebar/view: list of pipelines, Run button, output panel.
4. **Cyrex RAG bridge** — No change in Helox; IDE only triggers same scripts.

**Deliverables:** `run-helox-pipeline` IPC; Pipelines view; docs for Helox path and scripts.

---

### Phase 5: Web Frontend Merge (When Available)

**Goal:** If/when `deepiri-web-frontend` is available, integrate its routes into the desktop (e.g. React Router, shared layout).

**Deliverables:** Route map; decision record; implementation after web frontend repo is available.

---

### Phase 6: Polish, Docs, and Consistency

1. **Documentation** — Update architecture docs; remove Tauri references; add Development section.
2. **Menu and shortcuts** — Add Cyrex/Pipelines menu items if useful.
3. **Build** — Ensure electron-builder includes new assets; smoke-test on target platforms.
4. **Testing** — Smoke: Cyrex tab, Pipelines run; regression: tasks, challenges, file explorer, AI assistant.

---

## 4. IPC Reference (Existing + Proposed)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `api-request` | renderer → main | Generic platform API (5000). |
| `ai-request` | renderer → main | Generic Cyrex API (8000). |
| `classify-task` | renderer → main | Cyrex task classification. |
| `generate-challenge` | renderer → main | Cyrex challenge generation. |
| `get-app-version` | renderer → main | App version. |
| `get-config` | renderer → main | (New) Return `{ apiBaseUrl, aiServiceUrl, heloxPath }` from env/config. |
| `open-file` / `save-file` | renderer → main | (Implement) File read/write. |
| `get-tasks` / `create-task` | renderer → main | (Implement) Proxy to platform API or local. |
| `start-session` / `end-session` | renderer → main | (Implement) Proxy to platform API. |
| `run-helox-pipeline` | renderer → main | (New) Spawn Helox script; stream output. |
| `cancel-helox-pipeline` | renderer → main | (Optional) Kill running process. |

---

## 5. Risks and Dependencies

- **Cyrex backend must be running (8000):** Desktop will show errors or fallbacks if Cyrex is down.
- **Platform API (5000):** Same for tasks/sessions; implement local fallbacks or clear messaging for offline.
- **Helox Python environment:** Document and optionally detect in IDE.
- **Web frontend missing:** Phase 5 blocked until that repo is available.
- **Bundle size:** Use code-splitting (lazy load Cyrex views) if needed.

---

## 6. Success Criteria

- One desktop app, one window: activity bar + unified sidebar (IDE + Cyrex + Pipelines) + editor + panels.
- Cyrex UI: all Cyrex tabs usable inside that window via IPC.
- Cyrex AI: powers classification, challenges, and (optionally) assistant and editor actions.
- Helox: user can run at least one pipeline from the IDE and see output.
- All preload-exposed APIs have corresponding main-process handlers.

---

## 7. Next Steps

1. Implement Phase 1 (IPC/preload/main) and verify existing IDE features.
2. Create `views/cyrex/` and `components/cyrex/`; migrate one Cyrex tab as a template.
3. Add Pipelines view and `run-helox-pipeline` IPC; test with one Helox script.
4. Proceed with remaining Cyrex tabs and Phase 5 when web frontend is available.
