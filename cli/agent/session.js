/**
 * Session recorder: persists conversation history per-workspace as JSON files
 * under `.emotion-sessions/`. Listens to the event bus — no runner.js changes
 * required. Disk failures are silently swallowed; recording never breaks the
 * agent.
 */
import { readFile, writeFile, mkdir, readdir, unlink, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { EVENTS } from '../core/eventBus.js';
import { safeWorkspacePath } from './pathSafety.js';

const SESSIONS_DIR = '.emotion-sessions';
const MAX_SESSIONS = 30;
const MAX_MESSAGE_BYTES = 64 * 1024;
const MAX_MESSAGES_PER_SESSION = 500;

/**
 * Returns the canonical sessions directory if safe, or null if the path is
 * unsafe (symlink-escape, blocked pattern, etc.). All session operations go
 * through this gate so disk activity stays inside the workspace.
 */
async function safeSessionsDir(cwd) {
  const safety = await safeWorkspacePath(SESSIONS_DIR, cwd);
  if (safety.error) return null;
  return safety.resolved;
}

async function ensureDir(cwd) {
  const dir = await safeSessionsDir(cwd);
  if (!dir) return null;
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  return dir;
}

async function writeSessionAtomic(cwd, session) {
  const dir = await ensureDir(cwd);
  if (!dir) return; // silent: sessions path unsafe
  const path = join(dir, `${session.id}.json`);
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(session, null, 2), 'utf-8');
  await rename(tmp, path);
}

async function pruneOldSessions(cwd) {
  const dir = await safeSessionsDir(cwd);
  if (!dir) return;
  if (!existsSync(dir)) return;
  const entries = await readdir(dir);
  const ids = entries
    .filter(name => name.endsWith('.json') && !name.endsWith('.tmp'))
    .map(name => name.replace(/\.json$/, ''))
    .sort()
    .reverse();
  if (ids.length <= MAX_SESSIONS) return;
  const toDelete = ids.slice(MAX_SESSIONS);
  await Promise.all(toDelete.map(id => unlink(join(dir, `${id}.json`)).catch(() => {})));
}

export function attachSessionRecorder(bus, cwd = process.cwd()) {
  let session = null;
  let pendingAssistantTokens = '';
  let pendingAssistantStart = null;

  bus.on(EVENTS.USER_MESSAGE, async ({ text }) => {
    if (!text || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    if (trimmed.startsWith('/')) return;

    if (!session) {
      session = {
        id: String(Date.now()),
        startedAt: new Date().toISOString(),
        endedAt: null,
        messages: [],
      };
    }
    if (session.messages.length >= MAX_MESSAGES_PER_SESSION) return;
    session.messages.push({
      role: 'user',
      content: text.slice(0, MAX_MESSAGE_BYTES),
      ts: new Date().toISOString(),
    });
    try {
      await writeSessionAtomic(cwd, session);
      await pruneOldSessions(cwd);
    } catch { /* recording must never break the agent */ }
    pendingAssistantTokens = '';
    pendingAssistantStart = Date.now();
  });

  bus.on(EVENTS.LLM_TOKEN, ({ token }) => {
    if (typeof token !== 'string') return;
    // Cap pending tokens to prevent unbounded growth if LLM_DONE never fires.
    // The final persisted message is sliced to MAX_MESSAGE_BYTES anyway, so
    // appending past that cap accumulates memory with no observable benefit.
    if (pendingAssistantTokens.length < MAX_MESSAGE_BYTES) {
      pendingAssistantTokens += token;
    }
  });

  bus.on(EVENTS.LLM_DONE, async () => {
    if (!session || !pendingAssistantStart) return;
    const content = pendingAssistantTokens.trim();
    if (content.length === 0) return;
    if (session.messages.length < MAX_MESSAGES_PER_SESSION) {
      session.messages.push({
        role: 'assistant',
        content: content.slice(0, MAX_MESSAGE_BYTES),
        ts: new Date().toISOString(),
      });
      try { await writeSessionAtomic(cwd, session); } catch { /* swallow */ }
    }
    pendingAssistantTokens = '';
    pendingAssistantStart = null;
  });
}

export async function listSessions(cwd = process.cwd(), limit = 5) {
  const dir = await safeSessionsDir(cwd);
  if (!dir) return [];
  if (!existsSync(dir)) return [];
  let entries;
  try { entries = await readdir(dir); } catch { return []; }
  const ids = entries
    .filter(name => name.endsWith('.json') && !name.endsWith('.tmp'))
    .map(name => name.replace(/\.json$/, ''))
    .sort()
    .reverse()
    .slice(0, limit);
  const sessions = await Promise.all(
    ids.map(async id => {
      try {
        const raw = await readFile(join(dir, `${id}.json`), 'utf-8');
        const session = JSON.parse(raw);
        const firstUserMsg = session.messages?.find(m => m.role === 'user');
        return {
          id: session.id,
          startedAt: session.startedAt,
          messageCount: session.messages?.length ?? 0,
          firstUserPreview: firstUserMsg?.content?.slice(0, 80) ?? '',
        };
      } catch { return null; }
    })
  );
  return sessions.filter(Boolean);
}

export async function loadSession(cwd, id) {
  if (typeof id !== 'string' || id.length === 0) return { error: 'session id required' };
  if (!/^\d+$/.test(id)) return { error: 'invalid session id format' };
  const dir = await safeSessionsDir(cwd);
  if (!dir) return { error: `session not found: ${id}` };
  const path = join(dir, `${id}.json`);
  if (!existsSync(path)) return { error: `session not found: ${id}` };
  try {
    const raw = await readFile(path, 'utf-8');
    return { session: JSON.parse(raw) };
  } catch (err) {
    return { error: `failed to read session: ${err.message}` };
  }
}

export async function latestSession(cwd = process.cwd()) {
  const list = await listSessions(cwd, 1);
  if (list.length === 0) return { found: false };
  const result = await loadSession(cwd, list[0].id);
  return result.error
    ? { found: false, error: result.error }
    : { found: true, session: result.session };
}
