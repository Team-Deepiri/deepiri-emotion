/**
 * Interactive /models, /provider, /account, /skills, /status.
 */
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { listOllamaModels, modelMatches } from './providers/ollama.js';
import { rankOllamaCatalog, OLLAMA_CATALOG } from '../core/ollamaCatalog.js';
import { getCloudCatalog, listCloudPlanNames } from '../core/cloudModels.js';
import { EVENTS } from '../core/eventBus.js';
import { DEFAULT_PROVIDER_CHAIN, saveUserConfig, saveProjectConfig } from '../core/config.js';
import { requestSelect, requestTextInput, openBrowser } from '../core/select.js';

function trimSlash(url) {
  return String(url || 'http://localhost:11434').replace(/\/$/, '');
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '';
  const gb = n / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = n / 1024 / 1024;
  return `${mb.toFixed(0)}MB`;
}

function say(bus, token) {
  bus.emit(EVENTS.LLM_TOKEN, { token });
}

function done(bus) {
  bus.emit(EVENTS.LLM_DONE, {});
}

export async function pullOllamaModel(baseUrl, name, { onStatus } = {}) {
  const base = trimSlash(baseUrl);
  const res = await fetch(`${base}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama pull failed (${res.status}): ${body.slice(0, 200) || res.statusText}`);
  }
  if (!res.body) throw new Error('Ollama pull returned an empty body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let lastStatus = '';
  while (true) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let evt;
      try {
        evt = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (evt.error) throw new Error(String(evt.error));
      const status = evt.status || '';
      if (status && status !== lastStatus) {
        lastStatus = status;
        const pct =
          evt.total && evt.completed
            ? ` ${Math.min(100, Math.round((evt.completed / evt.total) * 100))}%`
            : '';
        onStatus?.(`${status}${pct}`);
      }
    }
  }
  return name;
}

function setSessionModel(config, provider, model) {
  switch (provider) {
    case 'ollama':
      config.ollamaModel = model;
      break;
    case 'openai':
      config.openaiModel = model;
      break;
    case 'claude-cli':
      config.claudeCliModel = model;
      break;
    case 'cursor':
      config.cursorModel = model;
      break;
    default:
      break;
  }
}

async function activateModel(bus, config, provider, model) {
  setSessionModel(config, provider, model);
  if (!process.env.VITEST) {
    try {
      const key =
        provider === 'ollama'
          ? 'ollamaModel'
          : provider === 'openai'
            ? 'openaiModel'
            : provider === 'claude-cli'
              ? 'claudeCliModel'
              : provider === 'cursor'
                ? 'cursorModel'
                : null;
      if (key) await saveProjectConfig(config, { [key]: model });
    } catch {
      /* session-only ok */
    }
  }
  bus.emit(EVENTS.PROVIDER_RESOLVED, { provider, model });
  say(bus, `Active model → ${provider} / ${model}`);
}

const ACCOUNT_LINKS = {
  openai: {
    label: 'OpenAI',
    planKey: 'openaiPlan',
    keyField: 'openaiApiKey',
    pages: [
      { id: 'keys', label: 'Open API keys page', url: 'https://platform.openai.com/api-keys' },
      { id: 'usage', label: 'Open usage / billing', url: 'https://platform.openai.com/usage' },
      { id: 'limits', label: 'Open rate limits (plan tier)', url: 'https://platform.openai.com/settings/organization/limits' },
    ],
  },
  'claude-cli': {
    label: 'Anthropic / Claude',
    planKey: 'anthropicPlan',
    keyField: null,
    pages: [
      { id: 'claude', label: 'Open Claude.ai (Pro / Max)', url: 'https://claude.ai' },
      { id: 'console', label: 'Open Anthropic Console (API)', url: 'https://console.anthropic.com/' },
      { id: 'plans', label: 'Open Claude plans', url: 'https://claude.ai/upgrade' },
    ],
  },
  cursor: {
    label: 'Cursor',
    planKey: 'cursorPlan',
    keyField: 'cursorApiKey',
    pages: [
      { id: 'settings', label: 'Open Cursor Settings / Account', url: 'https://cursor.com/settings' },
      { id: 'dashboard', label: 'Open Cursor Dashboard', url: 'https://cursor.com/dashboard' },
      { id: 'pricing', label: 'Open Cursor pricing', url: 'https://cursor.com/pricing' },
    ],
  },
  cyrex: {
    label: 'Cyrex',
    planKey: null,
    keyField: null,
    pages: [{ id: 'docs', label: 'Cyrex uses AI_SERVICE_URL — set in config', url: null }],
  },
};

const PLAN_LABELS = {
  openai: {
    free: 'Free / trial',
    tier1: 'API Tier 1 (typical paid)',
    tier2: 'API Tier 2',
    tier3: 'API Tier 3',
    enterprise: 'Enterprise',
  },
  'claude-cli': {
    free: 'Claude Free',
    pro: 'Claude Pro',
    max: 'Claude Max',
    api: 'Anthropic API (usage-billed)',
  },
  cursor: {
    hobby: 'Hobby',
    pro: 'Pro',
    pro_plus: 'Pro+',
    ultra: 'Ultra',
  },
};

export async function pickCloudPlan(bus, config, provider) {
  const plans = listCloudPlanNames(provider);
  if (!plans.length) return null;
  const labels = PLAN_LABELS[provider] || {};
  const current =
    provider === 'openai'
      ? config.openaiPlan
      : provider === 'claude-cli'
        ? config.anthropicPlan
        : provider === 'cursor'
          ? config.cursorPlan
          : null;
  const choice = await requestSelect(bus, {
    title: `Select your ${ACCOUNT_LINKS[provider]?.label || provider} plan`,
    subtitle: current ? `Current: ${current}` : 'Not set yet — this filters /models',
    items: [
      ...plans.map((p) => ({
        id: p,
        label: labels[p] || p,
        description: current === p ? '← current' : '',
      })),
      { id: 'cancel', label: 'Cancel' },
    ],
  });
  if (!choice || choice === 'cancel') return null;

  const partial =
    provider === 'openai'
      ? { openaiPlan: choice }
      : provider === 'claude-cli'
        ? { anthropicPlan: choice }
        : provider === 'cursor'
          ? { cursorPlan: choice }
          : {};
  const path = await saveUserConfig(config, partial);
  say(bus, `Saved ${provider} plan → ${choice}\n(${path})`);
  return choice;
}

export async function linkAccount(bus, config, provider) {
  const meta = ACCOUNT_LINKS[provider];
  if (!meta) {
    say(bus, `No account linking flow for ${provider}.`);
    return;
  }

  while (true) {
    const items = [
      ...meta.pages
        .filter((p) => p.url)
        .map((p) => ({ id: `open:${p.id}`, label: p.label, description: p.url })),
      meta.keyField
        ? { id: 'paste-key', label: 'Paste API key / token', description: 'saved to ~/.config/deepiri-emotion/cli.json' }
        : null,
      meta.planKey ? { id: 'plan', label: 'Choose subscription / API plan…' } : null,
      provider === 'claude-cli'
        ? { id: 'claude-login', label: 'Run `claude` login (browser)', description: 'if Claude Code CLI is installed' }
        : null,
      { id: 'done', label: 'Done' },
    ].filter(Boolean);

    const choice = await requestSelect(bus, {
      title: `Link ${meta.label}`,
      subtitle: 'Opens the provider site in your browser, then you paste keys / pick plan here.',
      items,
    });
    if (!choice || choice === 'done') return;

    if (choice.startsWith('open:')) {
      const pageId = choice.slice(5);
      const page = meta.pages.find((p) => p.id === pageId);
      if (page?.url) {
        const ok = await openBrowser(page.url);
        say(bus, ok ? `Opened ${page.url}` : `Could not open browser. Visit:\n${page.url}`);
      }
      continue;
    }

    if (choice === 'paste-key' && meta.keyField) {
      const value = await requestTextInput(bus, {
        title: `Paste ${meta.label} API key / token`,
        placeholder: 'sk-… or token · Enter to save',
        secret: true,
      });
      if (value) {
        await saveUserConfig(config, { [meta.keyField]: value.trim() });
        say(bus, `Saved ${meta.keyField}.`);
      }
      continue;
    }

    if (choice === 'plan') {
      await pickCloudPlan(bus, config, provider);
      continue;
    }

    if (choice === 'claude-login') {
      try {
        const { spawn } = await import('child_process');
        const child = spawn(config.claudeCliPath || 'claude', ['/login'], {
          stdio: 'ignore',
          detached: true,
        });
        child.unref();
        say(bus, 'Launched `claude /login` (check your browser / terminal).');
      } catch (err) {
        say(bus, `Could not launch claude login: ${err.message}`);
        await openBrowser('https://claude.ai');
      }
    }
  }
}

async function installFromCatalog(bus, config, { recommendedOnly = true } = {}) {
  const installed = await listOllamaModels(config.ollamaUrl);
  const ranked = rankOllamaCatalog(installed.map((m) => m.name));
  const pool = recommendedOnly
    ? [...ranked.groups.recommended, ...ranked.groups.usable].filter((e) => !e.installed)
    : [
        ...ranked.groups.recommended,
        ...ranked.groups.usable,
        ...ranked.groups.marginal,
      ].filter((e) => !e.installed);

  if (!pool.length) {
    say(bus, 'Nothing left to install in this list (or everything suitable is already installed).');
    return;
  }

  const PAGE = 14;
  let offset = 0;
  while (true) {
    const slice = pool.slice(offset, offset + PAGE);
    const items = [
      ...slice.map((e) => ({
        id: `pull:${e.name}`,
        label: e.name,
        description: `${e.size} — ${e.description} [${e.fit}]`,
      })),
      offset + PAGE < pool.length ? { id: 'more', label: 'More…' } : null,
      { id: 'custom', label: 'Custom tag…', description: 'any ollama.com model name' },
      { id: 'back', label: 'Back' },
    ].filter(Boolean);

    const choice = await requestSelect(bus, {
      title: recommendedOnly ? 'Install recommended / usable' : 'Install from catalog',
      subtitle: `${ranked.ramGb}GB RAM · ${ranked.vramGb}GB VRAM · setup ${ranked.setup}`,
      items,
    });
    if (!choice || choice === 'back') return;
    if (choice === 'more') {
      offset += PAGE;
      continue;
    }
    if (choice === 'custom') {
      const name = await requestTextInput(bus, {
        title: 'Ollama model tag to pull',
        placeholder: 'e.g. gemma2:9b',
      });
      if (name) await doPull(bus, config, name.trim());
      return;
    }
    if (choice.startsWith('pull:')) {
      await doPull(bus, config, choice.slice(5));
      return;
    }
  }
}

async function doPull(bus, config, name) {
  bus.emit(EVENTS.AGENT_STATUS, { status: 'thinking', message: `Pulling ${name}...` });
  say(bus, `Pulling ${name}…\n`);
  try {
    await pullOllamaModel(config.ollamaUrl, name, {
      onStatus: (msg) => bus.emit(EVENTS.AGENT_STATUS, { status: 'thinking', message: msg }),
    });
    bus.emit(EVENTS.AGENT_STATUS, { status: 'idle', message: '' });
    const use = await requestSelect(bus, {
      title: `Pulled ${name}`,
      items: [
        { id: 'use', label: 'Use it now', description: 'set as active model' },
        { id: 'later', label: 'Keep current model' },
      ],
    });
    if (use === 'use') await activateModel(bus, config, 'ollama', name);
    else say(bus, `Installed ${name}.`);
  } catch (err) {
    bus.emit(EVENTS.AGENT_STATUS, { status: 'idle', message: '' });
    throw err;
  }
}

async function switchProviderInteractive(bus, config) {
  const known = DEFAULT_PROVIDER_CHAIN;
  const choice = await requestSelect(bus, {
    title: 'Switch provider',
    subtitle: `Current: ${config.activeProvider || config.provider || '(auto)'}`,
    items: [
      ...known.map((p) => ({
        id: p,
        label: p,
        description: config.activeProvider === p ? '← active' : '',
      })),
      { id: 'cancel', label: 'Cancel' },
    ],
  });
  if (!choice || choice === 'cancel') return;
  config.provider = choice;
  config.providerChain = [choice];
  config.activeProvider = choice;
  await saveUserConfig(config, { provider: choice, providerChain: [choice] }).catch(() => {});
  const model =
    choice === 'ollama'
      ? config.ollamaModel
      : choice === 'openai'
        ? config.openaiModel
        : choice === 'claude-cli'
          ? config.claudeCliModel
          : choice === 'cursor'
            ? config.cursorModel
            : null;
  bus.emit(EVENTS.PROVIDER_SELECTED, { provider: choice });
  bus.emit(EVENTS.PROVIDER_RESOLVED, { provider: choice, model: model || null });
  say(bus, `Provider → ${choice}${model ? ` / ${model}` : ''}`);

  if (choice !== 'ollama') {
    const planKey =
      choice === 'openai' ? 'openaiPlan' : choice === 'claude-cli' ? 'anthropicPlan' : choice === 'cursor' ? 'cursorPlan' : null;
    if (planKey && !config[planKey]) {
      await pickCloudPlan(bus, config, choice);
    }
  }
}

async function runOllamaModelsMenu(bus, config) {
  while (true) {
    const installed = await listOllamaModels(config.ollamaUrl);
    const ranked = rankOllamaCatalog(installed.map((m) => m.name));
    const items = [
      {
        id: '_hdr_installed',
        label: `Installed (${installed.length})`,
        disabled: true,
      },
      ...installed
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({
          id: `use:${m.name}`,
          label: m.name,
          description: `${formatBytes(m.size)}${modelMatches(m.name, config.ollamaModel) ? ' ← active' : ''}`,
        })),
      { id: '_hdr_actions', label: 'Actions', disabled: true },
      { id: 'install', label: 'Install recommended…', description: 'hardware-ranked Emotion catalog' },
      { id: 'catalog', label: 'Browse full catalog…', description: `${OLLAMA_CATALOG.length} models` },
      { id: 'provider', label: 'Switch provider…' },
      { id: 'done', label: 'Done' },
    ];

    const choice = await requestSelect(bus, {
      title: 'Ollama models',
      subtitle: `${trimSlash(config.ollamaUrl)} · ${ranked.ramGb}GB RAM · ${ranked.vramGb}GB VRAM · setup ${ranked.setup}`,
      items,
    });

    if (!choice || choice === 'done') return;
    if (choice.startsWith('use:')) {
      await activateModel(bus, config, 'ollama', choice.slice(4));
      return;
    }
    if (choice === 'install') {
      await installFromCatalog(bus, config, { recommendedOnly: true });
      continue;
    }
    if (choice === 'catalog') {
      await installFromCatalog(bus, config, { recommendedOnly: false });
      continue;
    }
    if (choice === 'provider') {
      await switchProviderInteractive(bus, config);
      return;
    }
  }
}

async function runCloudModelsMenu(bus, config, provider) {
  while (true) {
    const catalog = getCloudCatalog(provider, config);
    const current =
      provider === 'openai'
        ? config.openaiModel
        : provider === 'claude-cli'
          ? config.claudeCliModel
          : provider === 'cursor'
            ? config.cursorModel
            : null;

    const items = [
      {
        id: '_hdr',
        label: `Plan: ${catalog.plan}${config[provider === 'openai' ? 'openaiPlan' : provider === 'claude-cli' ? 'anthropicPlan' : 'cursorPlan'] ? '' : ' (default — set via Link account)'}`,
        disabled: true,
      },
      ...catalog.models.map((m) => ({
        id: `use:${m.id}`,
        label: m.id,
        description: `${m.label || ''}${m.note ? ` — ${m.note}` : ''}${current === m.id ? ' ← active' : ''}`,
      })),
      { id: '_act', label: 'Actions', disabled: true },
      { id: 'plan', label: 'Change plan…' },
      { id: 'link', label: 'Link / sign in to account…', description: 'open provider site + paste key' },
      { id: 'provider', label: 'Switch provider…' },
      { id: 'done', label: 'Done' },
    ];

    const choice = await requestSelect(bus, {
      title: `${provider} models`,
      subtitle: catalog.note || '',
      items,
    });

    if (!choice || choice === 'done') return;
    if (choice.startsWith('use:')) {
      await activateModel(bus, config, provider, choice.slice(4));
      return;
    }
    if (choice === 'plan') {
      await pickCloudPlan(bus, config, provider);
      continue;
    }
    if (choice === 'link') {
      await linkAccount(bus, config, provider);
      continue;
    }
    if (choice === 'provider') {
      await switchProviderInteractive(bus, config);
      return;
    }
  }
}

export async function runModelsInteractive(bus, config) {
  const provider = config.activeProvider || config.provider || 'ollama';
  if (provider === 'ollama') await runOllamaModelsMenu(bus, config);
  else await runCloudModelsMenu(bus, config, provider);
}

export async function runAccountInteractive(bus, config) {
  const choice = await requestSelect(bus, {
    title: 'Accounts & plans',
    subtitle: 'Link cloud providers, pick plan, or switch default provider',
    items: [
      { id: 'openai', label: 'OpenAI', description: config.openaiPlan ? `plan ${config.openaiPlan}` : 'not set' },
      { id: 'claude-cli', label: 'Anthropic / Claude', description: config.anthropicPlan ? `plan ${config.anthropicPlan}` : 'not set' },
      { id: 'cursor', label: 'Cursor', description: config.cursorPlan ? `plan ${config.cursorPlan}` : 'not set' },
      { id: 'provider', label: 'Switch active provider…' },
      { id: 'done', label: 'Done' },
    ],
  });
  if (!choice || choice === 'done') return;
  if (choice === 'provider') {
    await switchProviderInteractive(bus, config);
    return;
  }
  await linkAccount(bus, config, choice);
}

/** First-run wizard — pick provider, optionally link cloud account. */
export async function runOnboarding(bus, config) {
  say(bus, 'Welcome to Emotion — quick setup (you can change this later with /account).\n');
  const provider = await requestSelect(bus, {
    title: 'Which provider do you want to use first?',
    items: [
      { id: 'ollama', label: 'Ollama (local)', description: 'free · uses models on this machine' },
      { id: 'claude-cli', label: 'Claude Code CLI', description: 'needs Claude Pro/Max or API' },
      { id: 'cursor', label: 'Cursor agent', description: 'needs Cursor subscription' },
      { id: 'openai', label: 'OpenAI API', description: 'needs API key' },
      { id: 'skip', label: 'Skip for now', description: 'auto-detect later' },
    ],
  });

  if (provider && provider !== 'skip') {
    config.provider = provider;
    config.providerChain = [provider];
    config.activeProvider = provider;
    await saveUserConfig(config, {
      provider,
      providerChain: [provider],
      onboardingComplete: true,
    });
    bus.emit(EVENTS.PROVIDER_SELECTED, { provider });
    bus.emit(EVENTS.PROVIDER_RESOLVED, { provider, model: null });

    if (provider === 'ollama') {
      const installed = await listOllamaModels(config.ollamaUrl);
      if (installed.length) {
        const pick = await requestSelect(bus, {
          title: 'Pick a local model',
          items: [
            ...installed.map((m) => ({ id: m.name, label: m.name, description: formatBytes(m.size) })),
            { id: 'later', label: 'Decide later' },
          ],
        });
        if (pick && pick !== 'later') await activateModel(bus, config, 'ollama', pick);
      } else {
        const pull = await requestSelect(bus, {
          title: 'No Ollama models installed',
          items: [
            { id: 'install', label: 'Install recommended…' },
            { id: 'later', label: 'Later' },
          ],
        });
        if (pull === 'install') await installFromCatalog(bus, config, { recommendedOnly: true });
      }
    } else {
      await linkAccount(bus, config, provider);
    }
  } else {
    await saveUserConfig(config, { onboardingComplete: true });
  }

  say(bus, '\nSetup saved. Type /models or /account anytime.');
  done(bus);
}

export async function discoverSkills(workspaceDir = process.cwd()) {
  const roots = [
    join(workspaceDir, '.cursor', 'skills'),
    join(workspaceDir, 'skills'),
    join(homedir(), '.cursor', 'skills'),
  ];
  const found = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const skillMd = join(root, ent.name, 'SKILL.md');
      if (!existsSync(skillMd)) continue;
      let description = '';
      try {
        const raw = await readFile(skillMd, 'utf8');
        const desc = raw.match(/^description:\s*(.+)$/m);
        const title = raw.match(/^#\s+(.+)$/m);
        description = (desc?.[1] || title?.[1] || '').trim().slice(0, 120);
      } catch {
        /* ignore */
      }
      found.push({ name: ent.name, path: skillMd, description });
    }
  }
  const byName = new Map();
  for (const s of found) {
    if (!byName.has(s.name)) byName.set(s.name, s);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function handleModelsCommand(text, { bus, config }) {
  const match = text.trim().match(/^\/models(?:\s+(.*))?$/i);
  if (!match) return false;
  try {
    const arg = (match[1] || '').trim();
    // Keep a few non-interactive shortcuts for scripts / power users.
    if (arg.startsWith('pull ') || arg.startsWith('install ')) {
      const name = arg.replace(/^(pull|install)\s+/i, '').trim();
      if (!name) {
        say(bus, 'Usage: /models pull <name>');
        done(bus);
        return true;
      }
      await doPull(bus, config, name);
      done(bus);
      return true;
    }
    if (arg.startsWith('use ') || arg.startsWith('set ')) {
      const name = arg.replace(/^(use|set)\s+/i, '').trim();
      const provider = config.activeProvider || config.provider || 'ollama';
      await activateModel(bus, config, provider, name);
      done(bus);
      return true;
    }
    await runModelsInteractive(bus, config);
    done(bus);
    return true;
  } catch (err) {
    bus.emit(EVENTS.AGENT_STATUS, { status: 'idle', message: '' });
    bus.emit(EVENTS.AGENT_ERROR, { message: err.message || String(err) });
    done(bus);
    return true;
  }
}

export async function handleProviderCommand(text, { bus, config }) {
  const match = text.trim().match(/^\/provider(?:\s+(\S+))?$/i);
  if (!match) return false;
  try {
    const name = match[1]?.toLowerCase();
    if (!name) {
      await switchProviderInteractive(bus, config);
      done(bus);
      return true;
    }
    const known = DEFAULT_PROVIDER_CHAIN;
    if (!known.includes(name)) {
      say(bus, `Unknown provider "${name}". Choose: ${known.join(', ')}`);
      done(bus);
      return true;
    }
    config.provider = name;
    config.providerChain = [name];
    config.activeProvider = name;
    bus.emit(EVENTS.PROVIDER_SELECTED, { provider: name });
    bus.emit(EVENTS.PROVIDER_RESOLVED, { provider: name, model: null });
    say(bus, `Provider → ${name}`);
    done(bus);
    return true;
  } catch (err) {
    bus.emit(EVENTS.AGENT_ERROR, { message: err.message || String(err) });
    done(bus);
    return true;
  }
}

export async function handleAccountCommand(text, { bus, config }) {
  const match = text.trim().match(/^\/account(?:\s+(.*))?$/i);
  if (!match) return false;
  try {
    await runAccountInteractive(bus, config);
    done(bus);
    return true;
  } catch (err) {
    bus.emit(EVENTS.AGENT_ERROR, { message: err.message || String(err) });
    done(bus);
    return true;
  }
}

export async function handleSkillsCommand(text, { bus, config }) {
  const match = text.trim().match(/^\/skills(?:\s+(.*))?$/i);
  if (!match) return false;
  try {
    const skills = await discoverSkills(config.workspaceDir || process.cwd());
    if (!skills.length) {
      say(bus, 'No skills found under .cursor/skills/, skills/, or ~/.cursor/skills/.');
      done(bus);
      return true;
    }
    const choice = await requestSelect(bus, {
      title: 'Skills',
      items: [
        ...skills.map((s) => ({
          id: s.name,
          label: s.name,
          description: s.description || s.path,
        })),
        { id: 'done', label: 'Done' },
      ],
    });
    if (choice && choice !== 'done') {
      const hit = skills.find((s) => s.name === choice);
      if (hit) say(bus, `${hit.name}\n${hit.description || ''}\n${hit.path}`);
    }
    done(bus);
    return true;
  } catch (err) {
    bus.emit(EVENTS.AGENT_ERROR, { message: err.message || String(err) });
    done(bus);
    return true;
  }
}

export async function handleStatusCommand(text, { bus, config }) {
  if (text.trim() !== '/status') return false;
  const provider = config.activeProvider || config.provider || '(unset)';
  const model =
    provider === 'ollama'
      ? config.ollamaModel
      : provider === 'openai'
        ? config.openaiModel
        : provider === 'claude-cli'
          ? config.claudeCliModel
          : provider === 'cursor'
            ? config.cursorModel
            : '';
  say(
    bus,
    [
      `cwd: ${config.workspaceDir || process.cwd()}`,
      `provider: ${provider}${model ? ` / ${model}` : ''}`,
      `openai plan: ${config.openaiPlan || '(not set)'}`,
      `anthropic plan: ${config.anthropicPlan || '(not set)'}`,
      `cursor plan: ${config.cursorPlan || '(not set)'}`,
      `ollama: ${config.ollamaUrl}`,
    ].join('\n')
  );
  done(bus);
  return true;
}
