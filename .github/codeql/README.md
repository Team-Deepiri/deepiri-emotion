# CodeQL Setup for deepiri-emotion

This folder contains the CodeQL configuration used for security scanning in this repository.

## What each file does

- `.github/workflows/codeql.yml`
  - Defines when scans run and how GitHub Actions executes CodeQL.
- `.github/codeql/codeql-config.yml`
  - Defines analysis scope and ignored generated/runtime artifacts.

## CodeQL workflow breakdown (`.github/workflows/codeql.yml`)

### `name: CodeQL`
The display name shown in the GitHub Actions tab.

### `on.pull_request.branches` and `on.push.branches`

```yaml
on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]
```

Scans run when:

- A pull request targets `main` or `dev`.
- A commit is pushed directly to `main` or `dev`.

### `permissions`

```yaml
permissions:
  actions: read
  contents: read
  security-events: write
```

This uses least-privilege defaults. `security-events: write` is required so CodeQL can upload findings.

### Language setup (current)

```yaml
with:
  languages: javascript-typescript
```

This repository is primarily JavaScript/TypeScript (Electron main process, renderer, and CLI), so the workflow is configured for `javascript-typescript`.

### Checkout step

```yaml
with:
  fetch-depth: 0
```

- `fetch-depth: 0` keeps full git history (safe default for analysis and troubleshooting).

### Initialize CodeQL

```yaml
uses: github/codeql-action/init@v3
with:
  languages: javascript-typescript
  config-file: ./.github/codeql/codeql-config.yml
```

Starts CodeQL and loads this repo's CodeQL config file.

### Analyze

```yaml
uses: github/codeql-action/analyze@v3
```

Runs CodeQL queries and uploads results to GitHub Security.

## Config breakdown (`.github/codeql/codeql-config.yml`)

### `name`

```yaml
name: deepiri-emotion-codeql
```

Logical name for this repository's CodeQL config.

### `paths`

```yaml
paths:
  - src
  - cli
  - scripts
```

Scopes analysis to the repository's core JavaScript/TypeScript code areas.

### `paths-ignore`

Generated/build/runtime artifact paths are excluded to reduce noise and runtime:

```yaml
paths-ignore:
  - '**/node_modules/**'
  - '**/dist/**'
  - '**/build/**'
  - '**/coverage/**'
  - '**/logs/**'
  - '**/*.min.js'
  - '**/src-tauri/target/**'
  - '**/.vite/**'
  - '**/.turbo/**'
  - '**/.cache/**'
```

## Best practices

1. Keep trigger scope intentional.
   Use branch filters (`main`, `dev`) to control cost and noise.
2. Keep language list explicit.
   Include only languages with meaningful production code.
3. Keep `paths` focused.
   Prioritize actively maintained source directories.
4. Exclude generated/vendor artifacts.
   Keep dependencies, caches, build outputs, logs, and minified bundles in `paths-ignore`.
5. Pin to stable major action versions.
   `@v3` is the current stable major for CodeQL actions.
6. Review alerts regularly.
   Triage high/critical findings first and suppress only with documented reasoning.

## Maintenance examples

Keeping this updated as the codebase evolves is important.

### Expand language scope if needed

Current workflow:

```yaml
with:
  languages: javascript-typescript
```

Only change this when this repository adds production code in another CodeQL-supported language.

### Add additional source directories

Example:

```yaml
paths:
  - src
  - cli
  - scripts
  - new-service
```

### Exclude another generated folder

Example:

```yaml
- '**/generated/**'
```