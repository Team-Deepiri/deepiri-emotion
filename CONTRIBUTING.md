# Contributing to Deepiri IDE Desktop

Thank you for considering contributing to Deepiri IDE.

## Development setup

1. **Clone and install**

   ```bash
   git clone https://github.com/deepiri/deepiri-ide-desktop.git
   cd deepiri-ide-desktop
   npm install
   ```

2. **Run in development**

   ```bash
   # Terminal 1
   npm run dev:renderer

   # Terminal 2
   npm run dev
   ```

3. **Optional** — Copy `.env.example` to `.env` and set `API_URL`, `AI_SERVICE_URL`, etc., if you use the platform API or Cyrex.

## Lint and test

Before submitting a PR, run:

```bash
npm run lint    # ESLint (fix with npm run lint:fix)
npm test        # Vitest unit tests
```

CI runs these plus `npm run build:renderer`. Keep tests green and fix new lint errors (or prefix intentionally unused variables with `_`).

## Code and structure

- **Main process:** `src/main.js` (Electron), `src/preload.js` (bridge). Keep IPC channel names and preload API in sync.
- **Renderer:** `src/renderer/` — React components in `components/`, feature modules in `features/`, shared state in `context/` and `hooks/`.
- **Styles:** `src/renderer/styles/` — Use existing CSS variables and layout classes where possible.
- **Formatting:** Use the project’s [.editorconfig](.editorconfig) (2 spaces, LF, trim trailing whitespace).

## Submitting changes

1. Create a branch from `main` (e.g. `fix/issue-123` or `feat/quick-open-improvements`).
2. Make your changes; keep commits focused and messages clear.
3. Run a production build to ensure nothing is broken: `npm run build:renderer` and (if you have Electron builder set up) `npm run build`.
4. Open a pull request with a short description of what changed and why. Link any related issues.

## Reporting issues

Use the [GitHub issue tracker](https://github.com/deepiri/deepiri-ide-desktop/issues). For security-sensitive issues, see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the same [Apache License 2.0](LICENSE) that covers this project.
