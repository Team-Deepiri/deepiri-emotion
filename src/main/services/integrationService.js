/**
 * Integration service: store platform credentials and sync data (GitHub, Notion, etc.).
 * Credentials are stored in userData; sync runs in main (e.g. GitHub API direct).
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { app } from 'electron';
import axios from 'axios';
import { IPC } from '../../shared/ipcChannels.js';

const STORE_PATH = join(app.getPath('userData'), 'integrations.json');

/** Integrations that support connect (store token) and sync. */
const SUPPORTED_IDS = new Set(['github', 'notion', 'linear', 'slack', 'jira']);

async function loadStore() {
  try {
    if (existsSync(STORE_PATH)) {
      const raw = await readFile(STORE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return {};
}

async function saveStore(store) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Sync GitHub issues from a repo. Uses stored token or token in options.
 * Returns { success, data: issues[] } or { success: false, error }.
 */
async function syncGitHub(creds, options = {}) {
  const token = options.token || creds?.token;
  const repo = options.repo || options.owner_repo; // "owner/repo"
  if (!token) return { success: false, error: 'GitHub token required' };
  if (!repo || !repo.includes('/')) return { success: false, error: 'Repository must be owner/repo' };
  try {
    const { data } = await axios.get(
      `https://api.github.com/repos/${repo.trim()}/issues`,
      {
        params: { state: 'open', per_page: 100 },
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`
        },
        timeout: 15000
      }
    );
    const issues = (Array.isArray(data) ? data : []).map((i) => ({
      id: String(i.id),
      number: i.number,
      title: i.title,
      body: i.body || '',
      url: i.html_url,
      state: i.state,
      created_at: i.created_at,
      updated_at: i.updated_at
    }));
    return { success: true, data: issues };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return { success: false, error: msg };
  }
}

/**
 * Notion: list databases via search API. Requires integration token.
 */
async function syncNotion(creds, _options = {}) {
  const token = creds?.token;
  if (!token) return { success: false, error: 'Notion token required' };
  try {
    const { data } = await axios.post(
      'https://api.notion.com/v1/search',
      { filter: { property: 'object', value: 'database' }, page_size: 20 },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    const databases = (data.results || []).map((db) => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || db.id,
      url: db.url
    }));
    return { success: true, data: databases };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return { success: false, error: msg };
  }
}

async function syncIntegration(id, creds, options) {
  switch (id) {
    case 'github':
      return syncGitHub(creds, options);
    case 'notion':
      return syncNotion(creds, options);
    default:
      return { success: false, error: `Sync not implemented for ${id}` };
  }
}

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} _deps
 */
export function registerIntegrationService(ipcMain, _deps) {
  ipcMain.handle(IPC.GET_INTEGRATION_STATUS, async () => {
    const store = await loadStore();
    const connected = {};
    for (const id of Object.keys(store)) {
      if (store[id] && (store[id].token || store[id].apiKey)) {
        connected[id] = { connectedAt: store[id].connectedAt || null, label: store[id].label || id };
      }
    }
    return { connected };
  });

  ipcMain.handle(IPC.CONNECT_INTEGRATION, async (_event, { id, token, apiKey, label }) => {
    if (!id || (!token && !apiKey)) {
      return { success: false, error: 'id and token or apiKey required' };
    }
    const store = await loadStore();
    store[id] = {
      token: token || undefined,
      apiKey: apiKey || undefined,
      connectedAt: new Date().toISOString(),
      label: label || id
    };
    await saveStore(store);
    return { success: true };
  });

  ipcMain.handle(IPC.DISCONNECT_INTEGRATION, async (_event, id) => {
    if (!id) return { success: false, error: 'id required' };
    const store = await loadStore();
    delete store[id];
    await saveStore(store);
    return { success: true };
  });

  ipcMain.handle(IPC.SYNC_INTEGRATION, async (_event, { id, options = {} }) => {
    if (!id) return { success: false, error: 'id required' };
    const store = await loadStore();
    const creds = store[id];
    if (!creds) return { success: false, error: 'Integration not connected' };
    return syncIntegration(id, creds, options);
  });

  ipcMain.handle(IPC.INTEGRATION_SUPPORTED, async (_event, id) => {
    return SUPPORTED_IDS.has(id);
  });
}
