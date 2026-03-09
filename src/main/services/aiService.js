/**
 * AI service: settings, usage, chat-completion, detect-runtime, classify-task, generate-challenge.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import axios from 'axios';
import { app } from 'electron';
import { IPC } from '../../shared/ipcChannels.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
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

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ desktopHeaders: object, agentRuntime: { emit: (a: string, b: object) => void } }} deps
 */
export function registerAiService(ipcMain, deps) {
  const { desktopHeaders, agentRuntime } = deps;

  ipcMain.handle(IPC.DETECT_RUNTIME, async () => detectRuntime());

  ipcMain.handle(IPC.GET_AI_SETTINGS, async () => {
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

  ipcMain.handle(IPC.SET_AI_SETTINGS, async (_event, settings) => {
    const current = await loadAiSettings();
    const merged = { ...current, ...settings };
    delete merged._detectedRuntime;
    await saveAiSettings(merged);
    return merged;
  });

  ipcMain.handle(IPC.GET_USAGE, async () => {
    const usage = await loadUsage();
    const day = todayKey();
    const today = usage.daily?.[day] || { requests: 0, inputTokens: 0, outputTokens: 0 };
    return { today, daily: usage.daily || {}, recentRequestTimestamps: usage.recentRequestTimestamps || [] };
  });

  ipcMain.handle(IPC.GET_USAGE_LIMITS, async () => loadUsageLimits());
  ipcMain.handle(IPC.SET_USAGE_LIMITS, async (_event, limits) => {
    const current = await loadUsageLimits();
    const merged = { ...current, ...limits };
    await saveUsageLimits(merged);
    return merged;
  });
  ipcMain.handle(IPC.RESET_USAGE, async () => {
    await saveUsage(defaultUsage());
    return { ok: true };
  });

  ipcMain.handle(IPC.CHAT_COMPLETION, async (event, { messages, systemPrompt, context, fileContent, agentProfile }) => {
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
        agentRuntime.emit('ai/request', { endpoint: '/agent/chat', data: payload });
        const res = await axios.post(`${baseUrl}/agent/chat`, payload, {
          headers: { ...desktopHeaders, 'Content-Type': 'application/json' }
        });
        agentRuntime.emit('ai/response', { endpoint: '/agent/chat', data: res.data });
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

  ipcMain.handle(IPC.CLASSIFY_TASK, async (_event, { task, description }) => {
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/agent/task/classify`,
        { task, description },
        { headers: desktopHeaders }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  });

  ipcMain.handle(IPC.GENERATE_CHALLENGE, async (_event, taskData) => {
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/agent/challenge/generate`,
        { task: taskData },
        { headers: desktopHeaders }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  });
}
