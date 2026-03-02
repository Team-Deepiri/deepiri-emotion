# Deepiri IDE Desktop — Documentation

| Document | Description |
|----------|-------------|
| **[install.md](install.md)** | How to get installers (.exe, .deb, .AppImage, .dmg, .pkg) and set up the project (dev, first-run, optional backends). |
| **[architecture.md](architecture.md)** | Tech stack (Electron, React, Vite, Monaco), main vs renderer, optional services, security and packaging. |
| **[refactoring.md](refactoring.md)** | Refactoring plan: full merger of Cyrex UI and Helox pipelines into the desktop IDE (phases, IPC, deliverables). |

**Development:** Run `npm run lint` and `npm test` before committing. CI (GitHub Actions) runs lint, tests, renderer build, and icon build on push/PR to `main` or `master`.

For quick start and project overview, see the [root README](../README.md).
