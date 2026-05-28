# Renderer API layer

Single place for all communication with the Electron bridge.

## Use the facade

```js
import { api } from '../api';

// Async methods return Promises; they reject with "Electron API not available: <method>" when the bridge is missing.
const root = await api.getProjectRoot();
await api.runCommand({ terminalId: 'default', command: 'ls', cwd: root });
const settings = await api.getAiSettings();
```

## Event subscribers

Subscribers return an unsubscribe function. When the bridge is missing, they return a no-op function.

```js
const unsub = api.onMenuSettings(() => setCurrentView('settings'));
// later: unsub();
```

## Raw bridge

When you need to pass the bridge to a third party or use a method not on the facade:

```js
import { getElectronAPI } from '../api';
const raw = getElectronAPI();
if (raw?.someMethod) raw.someMethod();
```

## Migrating from `window.electronAPI`

Replace:

- `window.electronAPI?.getProjectRoot()` → `api.getProjectRoot()` (returns Promise)
- `window.electronAPI?.onMenuSettings(cb)` → `api.onMenuSettings(cb)` (returns unsub)
- Optional chaining is unnecessary; the facade rejects when the bridge is missing.

Prefer `api` so all calls get consistent logging and error handling.
