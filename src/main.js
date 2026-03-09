/**
 * Deepiri Emotion - Main Process
 * Electron main process for the Deepiri Emotion desktop IDE
 * Includes in-process agent runtime, Fabric-style bus, and neural memory (NeuralGPTOS-inspired).
 */
import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile, readdir, mkdir, unlink, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import axios from 'axios';
import { createAgentRuntime } from './agentRuntime.js';
import { createNeuralMemory } from './neuralMemory.js';
import { IDE_CAPABILITIES } from './capabilities.js';
import { listWorkspaceFiles, parseExcludePatterns } from './indexing.js';
import { SEARCH_MAX_RESULTS } from './shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve Helox path: env, or relative to repo (Deepiri/deepiri-platform/diri-helox)
const DEEPIRI_ROOT = join(__dirname, '..', '..', '..');
const defaultHeloxPath = join(DEEPIRI_ROOT, 'deepiri-platform', 'diri-helox');

// API Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const CYREX_INTERFACE_URL = process.env.CYREX_INTERFACE_URL || 'http://localhost:5175';

let mainWindow;
let isDev = process.argv.includes('--dev');
let projectRoot = null;
let heloxProcess = null;
/** @type {Map<string, import('child_process').ChildProcess>} */
const shellProcesses = new Map();

// In-process agent runtime (Fabric-style bus) and neural memory
const agentRuntime = createAgentRuntime();
const neuralMemory = createNeuralMemory();
const ideAgentId = agentRuntime.registerAgent({ name: 'ide', version: '1.0.0' }, IDE_CAPABILITIES);
const rendererSubscriptions = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'Deepiri Emotion',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      enableRemoteModule: false
    },
    icon: join(__dirname, '..', 'assets', 'icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  // Load the app: dev = Vite on 5173; prod = built renderer (packaged: app.asar/dist-renderer)
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererPath = join(__dirname, '..', 'dist-renderer', 'index.html');
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const wcId = mainWindow.webContents.id;
  mainWindow.webContents.on('destroyed', () => {
    rendererSubscriptions.delete(wcId);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Menu — IDE-style (New File, Open Folder, etc.)
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-file');
          }
        },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-folder');
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu-settings');
          }
        },
        { type: 'separator' },
        {
          role: 'quit'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Gamification',
      submenu: [
        {
          label: 'Dashboard',
          click: () => {
            mainWindow.webContents.send('menu-gamification-dashboard');
          }
        },
        {
          label: 'Leaderboard',
          click: () => {
            mainWindow.webContents.send('menu-leaderboard');
          }
        },
        {
          label: 'Achievements',
          click: () => {
            mainWindow.webContents.send('menu-achievements');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            mainWindow.webContents.send('menu-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Common headers for desktop IDE identification
const desktopHeaders = {
  'Content-Type': 'application/json',
  'x-desktop-client': 'true',
  'x-api-key': process.env.PYAGENT_API_KEY || 'change-me'
};

// IPC Handlers for API communication
ipcMain.handle('api-request', async (event, { method, endpoint, data, headers = {} }) => {
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
      headers: {
        ...desktopHeaders,
        ...headers
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
});

ipcMain.handle('ai-request', async (event, { endpoint, data, headers = {} }) => {
  agentRuntime.emit('ai/request', { endpoint, data });
  try {
    const response = await axios({
      method: 'POST',
      url: `${AI_SERVICE_URL}${endpoint}`,
      data,
      headers: {
        ...desktopHeaders,
        ...headers
      }
    });
    agentRuntime.emit('ai/response', { endpoint, data: response.data });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
});

// --- AI provider settings (persist in userData) ---
const AI_SETTINGS_PATH = join(app.getPath('userData'), 'ai-settings.json');
const USAGE_PATH = join(app.getPath('userData'), 'api-usage.json');
const USAGE_LIMITS_PATH = join(app.getPath('userData'), 'usage-limits.json');

const defaultAiSettings = () => ({
  provider: 'cyrex',
  openaiApiKey: '',
  anthropicApiKey: '',
  googleApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  googleModel: 'gemini-1.5-flash',
  localType: 'cyrex',
  localCyrexUrl: AI_SERVICE_URL,
  localOllamaUrl: 'http://localhost:11434',
  localOllamaModel: 'llama3.2'
});

async function loadAiSettings() {
  try {
    if (existsSync(AI_SETTINGS_PATH)) {
      const raw = await readFile(AI_SETTINGS_PATH, 'utf-8');
      return { ...defaultAiSettings(), ...JSON.parse(raw) };
    }
  } catch { /* ignore */ }
  return defaultAiSettings();
}

async function saveAiSettings(settings) {
  await mkdir(dirname(AI_SETTINGS_PATH), { recursive: true });
  await writeFile(AI_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

// Auto-detect Cyrex and Ollama runtimes (probe with short timeout)
const DETECT_TIMEOUT_MS = 1800;
const CYREX_PROBE_URLS = [AI_SERVICE_URL, 'http://localhost:8000', 'http://127.0.0.1:8000'];
const OLLAMA_PROBE_URL = 'http://localhost:11434';

async function probeUrl(url, path) {
  const base = url.replace(/\/$/, '');
  const target = path.startsWith('http') ? path : base + (path.startsWith('/') ? path : '/' + path);
  try {
    const res = await axios.get(target, { timeout: DETECT_TIMEOUT_MS, validateStatus: () => true });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function detectRuntime() {
  const out = { cyrex: { url: null, available: false }, ollama: { url: null, available: false } };
  for (const url of CYREX_PROBE_URLS) {
    if (await probeUrl(url, '/')) {
      out.cyrex.url = url.replace(/\/$/, '');
      out.cyrex.available = true;
      break;
    }
    try {
      const r = await axios.post(url.replace(/\/$/, '') + '/agent/chat', { prompt: '' }, { timeout: 800, validateStatus: () => true });
      if (r.status === 200 || r.status === 400 || r.status === 422) {
        out.cyrex.url = url.replace(/\/$/, '');
        out.cyrex.available = true;
        break;
      }
    } catch { /* skip */ }
  }
  try {
    const r = await axios.get(OLLAMA_PROBE_URL + '/api/tags', { timeout: 1200, validateStatus: () => true });
    if (r.status === 200) {
      out.ollama.url = OLLAMA_PROBE_URL;
      out.ollama.available = true;
    }
  } catch { /* skip */ }
  return out;
}

ipcMain.handle('detect-runtime', async () => detectRuntime());

ipcMain.handle('get-ai-settings', async () => {
  const s = await loadAiSettings();
  const detected = await detectRuntime();
  const defaultUrl = AI_SERVICE_URL.replace(/\/$/, '');
  const cyrexWanted = s.provider === 'cyrex' || (s.provider === 'local' && s.localType === 'cyrex');
  const cyrexUrlEmptyOrDefault = !s.localCyrexUrl || s.localCyrexUrl.replace(/\/$/, '') === defaultUrl;
  if (cyrexWanted && cyrexUrlEmptyOrDefault && detected.cyrex.available && detected.cyrex.url) {
    s.localCyrexUrl = detected.cyrex.url;
  }
  if ((s.provider === 'local' && s.localType === 'ollama') && (!s.localOllamaUrl || s.localOllamaUrl.replace(/\/$/, '') === 'http://localhost:11434') && detected.ollama.available && detected.ollama.url) {
    s.localOllamaUrl = detected.ollama.url;
  }
  s._detectedRuntime = detected;
  return s;
});

ipcMain.handle('set-ai-settings', async (event, settings) => {
  const current = await loadAiSettings();
  const merged = { ...current, ...settings };
  delete merged._detectedRuntime;
  await saveAiSettings(merged);
  return merged;
});

// --- API usage tracking and limits ---
const defaultUsage = () => ({ daily: {}, recentRequestTimestamps: [] });
const defaultUsageLimits = () => ({
  rateLimitRequestsPerMinute: 0,
  dailyLimitRequests: 0,
  dailyLimitTokens: 0
});

async function loadUsage() {
  try {
    if (existsSync(USAGE_PATH)) {
      const raw = await readFile(USAGE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      return { ...defaultUsage(), ...data, recentRequestTimestamps: data.recentRequestTimestamps || [] };
    }
  } catch { /* ignore */ }
  return defaultUsage();
}

async function saveUsage(data) {
  await mkdir(dirname(USAGE_PATH), { recursive: true });
  await writeFile(USAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

async function loadUsageLimits() {
  try {
    if (existsSync(USAGE_LIMITS_PATH)) {
      const raw = await readFile(USAGE_LIMITS_PATH, 'utf-8');
      return { ...defaultUsageLimits(), ...JSON.parse(raw) };
    }
  } catch { /* ignore */ }
  return defaultUsageLimits();
}

async function saveUsageLimits(limits) {
  await mkdir(dirname(USAGE_LIMITS_PATH), { recursive: true });
  await writeFile(USAGE_LIMITS_PATH, JSON.stringify(limits, null, 2), 'utf-8');
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RECENT_TIMESTAMPS_MAX = 200;

async function checkUsageLimits() {
  const limits = await loadUsageLimits();
  const usage = await loadUsage();
  const now = Date.now();
  const recent = (usage.recentRequestTimestamps || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (limits.rateLimitRequestsPerMinute > 0 && recent.length >= limits.rateLimitRequestsPerMinute) {
    return { allowed: false, reason: `Rate limit: max ${limits.rateLimitRequestsPerMinute} requests per minute.` };
  }

  const day = todayKey();
  const dayUsage = usage.daily?.[day] || { requests: 0, inputTokens: 0, outputTokens: 0 };
  const totalTokens = (dayUsage.inputTokens || 0) + (dayUsage.outputTokens || 0);

  if (limits.dailyLimitRequests > 0 && dayUsage.requests >= limits.dailyLimitRequests) {
    return { allowed: false, reason: `Daily request limit reached (${limits.dailyLimitRequests}).` };
  }
  if (limits.dailyLimitTokens > 0 && totalTokens >= limits.dailyLimitTokens) {
    return { allowed: false, reason: `Daily token limit reached (${limits.dailyLimitTokens}).` };
  }
  return { allowed: true };
}

async function recordUsage(inputTokens = 0, outputTokens = 0) {
  const usage = await loadUsage();
  const day = todayKey();
  if (!usage.daily) usage.daily = {};
  if (!usage.daily[day]) usage.daily[day] = { requests: 0, inputTokens: 0, outputTokens: 0 };
  usage.daily[day].requests += 1;
  usage.daily[day].inputTokens = (usage.daily[day].inputTokens || 0) + inputTokens;
  usage.daily[day].outputTokens = (usage.daily[day].outputTokens || 0) + outputTokens;
  usage.recentRequestTimestamps = usage.recentRequestTimestamps || [];
  usage.recentRequestTimestamps.push(Date.now());
  usage.recentRequestTimestamps = usage.recentRequestTimestamps.slice(-RECENT_TIMESTAMPS_MAX);
  await saveUsage(usage);
}

ipcMain.handle('get-usage', async () => {
  const usage = await loadUsage();
  const day = todayKey();
  const today = usage.daily?.[day] || { requests: 0, inputTokens: 0, outputTokens: 0 };
  return { today, daily: usage.daily || {}, recentRequestTimestamps: usage.recentRequestTimestamps || [] };
});

ipcMain.handle('get-usage-limits', async () => loadUsageLimits());
ipcMain.handle('set-usage-limits', async (event, limits) => {
  const current = await loadUsageLimits();
  const merged = { ...current, ...limits };
  await saveUsageLimits(merged);
  return merged;
});
ipcMain.handle('reset-usage', async () => {
  await saveUsage(defaultUsage());
  return { ok: true };
});

// --- Unified chat completion (OpenAI, Anthropic, Google, Ollama, Cyrex) ---
ipcMain.handle('chat-completion', async (event, { messages, systemPrompt, context, fileContent, agentProfile }) => {
  const limitCheck = await checkUsageLimits();
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.reason };
  }

  const s = await loadAiSettings();

  const buildOpenAIMessages = () => {
    const out = [];
    const systemParts = [];
    if (agentProfile?.systemPrompt) systemParts.push(agentProfile.systemPrompt);
    if (systemPrompt) systemParts.push(systemPrompt);
    if (context) systemParts.push(`Context: ${context}`);
    if (fileContent) systemParts.push(`Current file content:\n${fileContent.slice(0, 12000)}`);
    if (systemParts.length) out.push({ role: 'system', content: systemParts.join('\n\n') });
    messages.forEach(({ role, content }) => { if (role && content) out.push({ role, content }); });
    return out;
  };

  try {
    if (s.provider === 'openai' && s.openaiApiKey) {
      const body = { model: s.openaiModel || 'gpt-4o-mini', messages: buildOpenAIMessages() };
      const res = await axios.post('https://api.openai.com/v1/chat/completions', body, {
        headers: { 'Authorization': `Bearer ${s.openaiApiKey}`, 'Content-Type': 'application/json' }
      });
      const content = res.data?.choices?.[0]?.message?.content ?? '';
      const usage = res.data?.usage;
      await recordUsage(usage?.prompt_tokens || 0, usage?.completion_tokens || 0);
      return { success: true, data: { reply: content, content } };
    }

    if (s.provider === 'anthropic' && s.anthropicApiKey) {
      const systemParts = [];
      if (agentProfile?.systemPrompt) systemParts.push(agentProfile.systemPrompt);
      if (systemPrompt) systemParts.push(systemPrompt);
      if (context) systemParts.push(`Context: ${context}`);
      if (fileContent) systemParts.push(`File:\n${fileContent.slice(0, 12000)}`);
      const system = systemParts.filter(Boolean).join('\n\n');
      const anthropicMessages = messages.map(({ role, content }) => ({ role: role === 'assistant' ? 'assistant' : 'user', content }));
      const body = {
        model: s.anthropicModel || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: system || undefined,
        messages: anthropicMessages
      };
      const res = await axios.post('https://api.anthropic.com/v1/messages', body, {
        headers: {
          'x-api-key': s.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });
      const content = res.data?.content?.[0]?.text ?? '';
      const usage = res.data?.usage;
      await recordUsage(usage?.input_tokens || 0, usage?.output_tokens || 0);
      return { success: true, data: { reply: content, content } };
    }

    if (s.provider === 'google' && s.googleApiKey) {
      const systemParts = [];
      if (agentProfile?.systemPrompt) systemParts.push(agentProfile.systemPrompt);
      if (systemPrompt) systemParts.push(systemPrompt);
      if (context) systemParts.push(`Context: ${context}`);
      if (fileContent) systemParts.push(`File:\n${fileContent.slice(0, 12000)}`);
      const system = systemParts.filter(Boolean).join('\n\n');
      const contents = [];
      if (system) contents.push({ role: 'user', parts: [{ text: `System: ${system}` }] });
      messages.forEach(({ role, content }) => {
        contents.push({ role: role === 'assistant' ? 'model' : 'user', parts: [{ text: content }] });
      });
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${s.googleModel || 'gemini-1.5-flash'}:generateContent?key=${s.googleApiKey}`;
      const res = await axios.post(url, { contents }, { headers: { 'Content-Type': 'application/json' } });
      const content = res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const meta = res.data?.usageMetadata;
      await recordUsage(meta?.promptTokenCount || 0, meta?.candidatesTokenCount || 0);
      return { success: true, data: { reply: content, content } };
    }

    if (s.provider === 'local' && s.localType === 'ollama') {
      const url = (s.localOllamaUrl || 'http://localhost:11434').replace(/\/$/, '');
      const msgs = buildOpenAIMessages().filter(m => m.role !== 'system');
      const system = buildOpenAIMessages().find(m => m.role === 'system')?.content;
      const all = system ? [{ role: 'system', content: system }, ...msgs] : msgs;
      const res = await axios.post(`${url}/api/chat`, {
        model: s.localOllamaModel || 'llama3.2',
        messages: all,
        stream: false
      });
      const content = res.data?.message?.content ?? '';
      await recordUsage(0, 0);
      return { success: true, data: { reply: content, content } };
    }

    if ((s.provider === 'local' && s.localType === 'cyrex') || s.provider === 'cyrex') {
      const baseUrl = (s.localCyrexUrl || AI_SERVICE_URL).replace(/\/$/, '');
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      const payload = {
        prompt: lastUser?.content ?? '',
        context: context ?? '',
        file_content: fileContent?.slice(0, 8000) ?? '',
        selection: null
      };
      if (agentProfile) {
        payload.agent_id = agentProfile.id;
        payload.agent_name = agentProfile.name;
        payload.agent_tone = agentProfile.tone;
        payload.agent_personality = agentProfile.personality;
        if (agentProfile.systemPrompt) payload.agent_system_prompt = agentProfile.systemPrompt;
      }
      const res = await axios.post(`${baseUrl}/agent/chat`, payload, {
        headers: { ...desktopHeaders, 'Content-Type': 'application/json' }
      });
      const reply = res.data?.reply ?? res.data?.content ?? res.data?.message ?? (typeof res.data === 'string' ? res.data : '');
      await recordUsage(0, 0);
      return { success: true, data: { reply, content: reply } };
    }

    return { success: false, error: 'No AI provider configured. Set an API key or local URL in Settings.' };
  } catch (err) {
    const msg = err.response?.data?.error?.message ?? err.response?.data?.message ?? err.message ?? 'Request failed';
    return { success: false, error: String(msg) };
  }
});

// --- Subagents (list / register with agent runtime) ---
ipcMain.handle('list-agents', async () => {
  const list = agentRuntime.listAgents();
  return list.map((a) => ({ id: a.id, name: a.name, version: a.version, capabilities: a.capabilities }));
});

ipcMain.handle('register-agent', async (_event, { name, version = '1.0.0', capabilities = 0 }) => {
  const { resolveCapabilities } = await import('./capabilities.js');
  const capMask = typeof capabilities === 'number' ? capabilities : resolveCapabilities(capabilities);
  const id = agentRuntime.registerAgent({ name: (name || 'subagent').slice(0, 63), version: (version || '1.0.0').slice(0, 15) }, capMask);
  return { id, name: (name || 'subagent').slice(0, 63), version: (version || '1.0.0').slice(0, 15) };
});

ipcMain.handle('unregister-agent', async (_event, agentId) => {
  if (Number(agentId) === ideAgentId) return { success: false, error: 'Cannot unregister IDE agent' };
  agentRuntime.unregisterAgent(Number(agentId));
  return { success: true };
});

// --- Fabric bus (in-process semantic routing) ---
ipcMain.handle('fabric-send', async (event, { subject, data }) => {
  try {
    const result = agentRuntime.send(ideAgentId, subject || 'event', data);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

let nextSubscriptionId = 0;
const subscriptionIds = new Map();

ipcMain.handle('fabric-subscribe', (event, { subjectPattern }) => {
  const senderId = event.sender.id;
  if (!rendererSubscriptions.has(senderId)) rendererSubscriptions.set(senderId, []);
  const id = ++nextSubscriptionId;
  const unsub = agentRuntime.on(subjectPattern || '*', (payload) => {
    if (event.sender.isDestroyed()) return;
    event.sender.send('fabric-message', { subject: subjectPattern, payload });
  });
  rendererSubscriptions.get(senderId).push({ id, unsub });
  subscriptionIds.set(id, senderId);
  return { subscribed: true, subscriptionId: id, subjectPattern: subjectPattern || '*' };
});

ipcMain.handle('fabric-unsubscribe', (event, { subscriptionId } = {}) => {
  const senderId = event.sender.id;
  const subs = rendererSubscriptions.get(senderId);
  if (subscriptionId != null) {
    const entry = subs?.find(s => s.id === subscriptionId);
    if (entry) {
      entry.unsub();
      subs.splice(subs.indexOf(entry), 1);
      subscriptionIds.delete(subscriptionId);
    }
  } else if (subs) {
    subs.forEach(s => { s.unsub(); subscriptionIds.delete(s.id); });
    rendererSubscriptions.delete(senderId);
  }
  return { unsubscribed: true };
});

// --- Neural memory (local vector store for RAG/cache) ---
ipcMain.handle('neural-memory-store', async (event, { agentId, embedding, metadata, ttlSec }) => {
  try {
    const id = neuralMemory.store(agentId ?? 0, embedding, metadata, ttlSec ?? 3600);
    return { success: true, memoryId: id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('neural-memory-query', async (event, { agentId, queryVector, topK, threshold }) => {
  try {
    const results = neuralMemory.query(agentId ?? 0, queryVector, topK ?? 5, threshold ?? 0);
    return { success: true, results };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('neural-memory-clear', async (event, { agentId }) => {
  try {
    neuralMemory.clear(agentId ?? null);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('classify-task', async (event, { task, description }) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/task/classify`,
      { task, description },
      {
        headers: desktopHeaders
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
});

ipcMain.handle('generate-challenge', async (event, taskData) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/challenge/generate`,
      { task: taskData },
      {
        headers: desktopHeaders
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
});

// App version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Config for renderer (API URLs, Helox path, Cyrex UI URL)
ipcMain.handle('get-config', () => {
  const heloxPath = process.env.HELOX_PATH || defaultHeloxPath;
  return {
    apiBaseUrl: API_BASE_URL,
    aiServiceUrl: AI_SERVICE_URL,
    cyrexInterfaceUrl: CYREX_INTERFACE_URL,
    heloxPath,
    isDev
  };
});

// --- Tasks (proxy to platform API or local fallback) ---
ipcMain.handle('get-tasks', async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/tasks`, { headers: desktopHeaders });
    return { success: true, data: response.data || [] };
  } catch {
    return { success: true, data: [] };
  }
});

ipcMain.handle('create-task', async (event, { title, description = '', type = 'manual' }) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/tasks`,
      { title, description, task_type: type },
      { headers: desktopHeaders }
    );
    return { success: true, data: response.data };
  } catch {
    const fallback = { id: `local-${Date.now()}`, title, description, task_type: type };
    return { success: true, data: fallback };
  }
});

// --- Session ---
ipcMain.handle('start-session', async (event, userId) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/sessions`,
      { user_id: userId },
      { headers: desktopHeaders }
    );
    return response.data?.session_id || response.data?.id || `session-${Date.now()}`;
  } catch {
    return `session-${Date.now()}`;
  }
});

ipcMain.handle('end-session', async () => {
  try {
    await axios.post(`${API_BASE_URL}/sessions/end`, {}, { headers: desktopHeaders });
    return { success: true };
  } catch {
    return { success: true };
  }
});

ipcMain.handle('record-keystroke', async (event, { key, file, line, column }) => {
  try {
    await axios.post(
      `${API_BASE_URL}/session/record-keystroke`,
      { key, file, line, column },
      { headers: desktopHeaders }
    );
  } catch {
    // no-op
  }
});

ipcMain.handle('record-file-change', async (event, { file, changeType, details }) => {
  try {
    await axios.post(
      `${API_BASE_URL}/session/record-file-change`,
      { file, change_type: changeType, details },
      { headers: desktopHeaders }
    );
  } catch {
    // no-op
  }
});

// --- File system ---
ipcMain.handle('open-file', async (event, path) => {
  try {
    const content = await readFile(path, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(error.message || 'Failed to open file');
  }
});

ipcMain.handle('save-file', async (event, { path, content }) => {
  try {
    await writeFile(path, content, 'utf-8');
    return { success: true };
  } catch (error) {
    throw new Error(error.message || 'Failed to save file');
  }
});

ipcMain.handle('open-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) throw new Error('Canceled');
  projectRoot = result.filePaths[0];
  return projectRoot;
});

ipcMain.handle('set-project-root', (event, path) => {
  if (path && typeof path === 'string') projectRoot = path;
  return projectRoot;
});

ipcMain.handle('get-project-root', () => projectRoot);

const SKIP_DIRS = parseExcludePatterns();
const TEXT_EXT = new Set(['js', 'jsx', 'ts', 'tsx', 'json', 'md', 'html', 'css', 'scss', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'yaml', 'yml', 'sh', 'bash', 'sql', 'xml', 'txt', 'log', 'env']);

async function searchInFolderRecursive(rootDir, query, opts, results, maxResults = SEARCH_MAX_RESULTS) {
  if (results.length >= maxResults) return;
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  const caseSensitive = opts?.caseSensitive ?? false;
  const wholeWord = opts?.wholeWord ?? false;
  const _q = caseSensitive ? query : query.toLowerCase();
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = wholeWord
    ? new RegExp(`\\b${escaped}\\b`, caseSensitive ? 'g' : 'gi')
    : new RegExp(escaped, caseSensitive ? 'g' : 'gi');

  for (const e of entries) {
    if (results.length >= maxResults) break;
    const fullPath = join(rootDir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await searchInFolderRecursive(fullPath, query, opts, results, maxResults);
    } else {
      const ext = e.name.split('.').pop()?.toLowerCase();
      if (!ext || !TEXT_EXT.has(ext)) continue;
      let content;
      try {
        content = await readFile(fullPath, 'utf-8');
      } catch {
        continue;
      }
      const lines = content.split('\n');
      for (let i = 0; i < lines.length && results.length < maxResults; i++) {
        const line = lines[i];
        let match;
        while ((match = re.exec(line)) !== null) {
          results.push({
            path: fullPath,
            name: e.name,
            line: i + 1,
            column: match.index + 1,
            text: line.trim().slice(0, 100)
          });
        }
      }
    }
  }
}

ipcMain.handle('search-in-folder', async (event, rootDir, query, opts = {}) => {
  const results = [];
  if (!rootDir || !query?.trim()) return results;
  await searchInFolderRecursive(rootDir, query.trim(), opts, results);
  return results;
});

// --- File system (for real file tree) ---
ipcMain.handle('list-workspace-files', async (event, rootDir, excludePatterns) => {
  return listWorkspaceFiles(rootDir, excludePatterns);
});

ipcMain.handle('list-directory', async (event, dirPath) => {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      path: join(dirPath, e.name),
      isDirectory: e.isDirectory()
    }));
  } catch (error) {
    throw new Error(error.message || 'Failed to list directory');
  }
});

ipcMain.handle('create-file', async (event, { dirPath, name }) => {
  const fullPath = join(dirPath, name);
  if (existsSync(fullPath)) throw new Error('File already exists');
  const parent = dirname(fullPath);
  await mkdir(parent, { recursive: true });
  await writeFile(fullPath, '', 'utf-8');
  return { path: fullPath };
});

ipcMain.handle('create-folder', async (event, { dirPath, name }) => {
  const fullPath = join(dirPath, name);
  if (existsSync(fullPath)) throw new Error('Folder already exists');
  await mkdir(fullPath, { recursive: true });
  return { path: fullPath };
});

ipcMain.handle('delete-path', async (event, targetPath) => {
  const s = await stat(targetPath);
  if (s.isDirectory()) {
    await rm(targetPath, { recursive: true });
  } else {
    await unlink(targetPath);
  }
  return { success: true };
});

ipcMain.handle('rename-path', async (event, { oldPath, newName }) => {
  const parent = dirname(oldPath);
  const newPath = join(parent, newName);
  if (existsSync(newPath)) throw new Error('Target already exists');
  const { rename } = await import('fs/promises');
  await rename(oldPath, newPath);
  return { path: newPath };
});

// --- Run shell command (for Terminal panel; supports multiple terminals by terminalId) ---
ipcMain.handle('run-command', async (event, { terminalId = 'default', command, cwd }) => {
  const workDir = cwd || projectRoot || process.cwd();
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'cmd' : 'bash';
  const args = isWin ? ['/c', command] : ['-c', command];

  const existing = shellProcesses.get(terminalId);
  if (existing) {
    try { existing.kill('SIGTERM'); } catch { /* process may already be gone */ }
    shellProcesses.delete(terminalId);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: workDir,
      env: process.env,
      shell: false
    });
    shellProcesses.set(terminalId, proc);
    proc.stdout.on('data', (data) => {
      mainWindow?.webContents?.send('command-output', { terminalId, type: 'stdout', text: data.toString() });
    });
    proc.stderr.on('data', (data) => {
      mainWindow?.webContents?.send('command-output', { terminalId, type: 'stderr', text: data.toString() });
    });
    proc.on('close', (code, signal) => {
      shellProcesses.delete(terminalId);
      mainWindow?.webContents?.send('command-exit', { terminalId, code, signal });
      resolve({ code, signal });
    });
    proc.on('error', (err) => {
      shellProcesses.delete(terminalId);
      mainWindow?.webContents?.send('command-exit', { terminalId, code: -1, error: err.message });
      reject(err);
    });
  });
});

ipcMain.handle('cancel-command', async (_event, terminalId) => {
  if (terminalId) {
    const proc = shellProcesses.get(terminalId);
    if (proc) {
      try { proc.kill('SIGTERM'); } catch { /* ignore */ }
      shellProcesses.delete(terminalId);
      return { success: true };
    }
    return { success: false };
  }
  let cancelled = false;
  for (const [id, proc] of shellProcesses) {
    try { proc.kill('SIGTERM'); cancelled = true; } catch { /* ignore */ }
    shellProcesses.delete(id);
  }
  return { success: cancelled };
});

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
});

// --- Gamification ---
ipcMain.handle('award-points', async (event, points) => {
  try {
    await axios.post(`${API_BASE_URL}/gamification/award`, { points }, { headers: desktopHeaders });
    return { success: true };
  } catch {
    return { success: true };
  }
});

ipcMain.handle('get-gamification-state', async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/gamification/state`, { headers: desktopHeaders });
    return response.data || {};
  } catch {
    return { points: 0, level: 1, streak: 0, badges: [] };
  }
});

// --- Challenge (local generate) ---
ipcMain.handle('generate-challenge-local', async (event, taskId) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/challenge/generate`,
      { task_id: taskId },
      { headers: desktopHeaders }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
});

// --- Integrations ---
ipcMain.handle('sync-github-issues', async (event, { repo = '', token = null }) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/integrations/github/sync`,
      { repo, token },
      { headers: desktopHeaders }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
});

// --- LLM / AI (Cyrex) ---
ipcMain.handle('get-llm-hint', async (event, { task }) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/hint`,
      { task },
      { headers: desktopHeaders }
    );
    return response.data?.hint || response.data || 'Hint unavailable';
  } catch {
    return 'Hint generation unavailable';
  }
});

ipcMain.handle('complete-code', async (event, { code, language }) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/agent/complete`,
      { code, language },
      { headers: desktopHeaders }
    );
    return response.data?.completion ?? code;
  } catch {
    return code;
  }
});

// --- Helox pipelines ---
ipcMain.handle('run-helox-pipeline', async (event, { pipelineId, args = [], cwd: customCwd }) => {
  const heloxPath = process.env.HELOX_PATH || defaultHeloxPath;
  const cwd = customCwd || heloxPath;

  const scripts = {
    'full-training': ['scripts/pipelines/run_training_pipeline.py', []],
    'quick-train': ['scripts/pipelines/quick_train.sh', []],
    'rag-training': ['pipelines/training/rag_training_pipeline.py', ['--config', 'config.json']]
  };

  const [scriptRelative, defaultArgs] = scripts[pipelineId] || [pipelineId, args];
  const scriptPath = join(cwd, scriptRelative);
  const allArgs = defaultArgs.length ? defaultArgs : args;

  return new Promise((resolve, reject) => {
    const isPy = scriptPath.endsWith('.py');
    const cmd = isPy ? 'python3' : 'bash';
    const cmdArgs = isPy ? [scriptPath, ...allArgs] : [scriptPath, ...allArgs];

    heloxProcess = spawn(cmd, cmdArgs, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    heloxProcess.stdout.on('data', (data) => {
      mainWindow?.webContents?.send('helox-output', { type: 'stdout', text: data.toString() });
    });
    heloxProcess.stderr.on('data', (data) => {
      mainWindow?.webContents?.send('helox-output', { type: 'stderr', text: data.toString() });
    });
    heloxProcess.on('close', (code, signal) => {
      heloxProcess = null;
      mainWindow?.webContents?.send('helox-exit', { code, signal });
      resolve({ code, signal });
    });
    heloxProcess.on('error', (err) => {
      heloxProcess = null;
      mainWindow?.webContents?.send('helox-exit', { code: -1, error: err.message });
      reject(err);
    });
  });
});

ipcMain.handle('cancel-helox-pipeline', async () => {
  if (heloxProcess) {
    heloxProcess.kill('SIGTERM');
    heloxProcess = null;
    return { success: true };
  }
  return { success: false };
});

