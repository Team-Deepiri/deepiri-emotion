# Changelog

All notable changes to the Deepiri IDE Desktop project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2025-03-02

### Added

- **Desktop application** — Electron 28 + React 18 + Vite 5; single-window IDE.
- **Workspace** — Open folder, file tree (create/rename/delete), multi-tab Monaco editor, save (Ctrl+S).
- **Monaco Editor** — Syntax highlighting, themes (ThemeContext), cursor/selection for AI, breadcrumbs.
- **AI** — Context-aware chat panel (current file + selection, Apply to file); legacy AI Assistant when no file open.
- **Quick Open (Ctrl+P)** — File picker (open tabs + recent files).
- **Command Palette (Ctrl+Shift+P)** — Commands: Open Folder, Save, Toggle Terminal/Output/Problems/AI, Keybindings, Extensions, Outline, Settings, New Task.
- **Welcome screen** — Recent folders, quick actions, features list.
- **Panels** — Terminal (project-root cwd, streamed output), Output, Problems, Search; Outline, Keybindings, Extensions in sidebar.
- **Status bar** — Line/column, language, project root, problem count.
- **Cyrex & Helox** — Tabs and IPC for Cyrex UI (optional) and Helox pipeline runs.
- **Tasks, Challenges, Gamification** — Platform API integration; mission cards.
- **Build** — electron-builder: NSIS (.exe), DMG/PKG (macOS), deb/AppImage (Linux); icon generation script.
- **Docs** — `docs/install.md`, `docs/architecture.md`, `docs/refactoring.md`; root README, CONTRIBUTING, SECURITY, LICENSE, .editorconfig, .nvmrc.

### Security

- Context isolation: preload exposes whitelisted `window.electronAPI` only; no nodeIntegration in renderer.

---

[1.0.0]: https://github.com/deepiri/deepiri-ide-desktop/releases/tag/v1.0.0
