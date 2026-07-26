/**
 * Curated cloud-provider model catalogs by subscription plan.
 *
 * These are Emotion's best-known offerings for common plans — not live
 * billing APIs. Override plan via config/env:
 *   openaiPlan / OPENAI_PLAN
 *   anthropicPlan / ANTHROPIC_PLAN (also used for claude-cli)
 *   cursorPlan / CURSOR_PLAN
 *
 * Plans are intentionally coarse so /models stays useful without account scraping.
 */

/** @typedef {{ id: string, label: string, note?: string }} CloudModel */
/** @typedef {{ plan: string, models: CloudModel[], note?: string }} PlanCatalog */

const OPENAI_BY_PLAN = {
  free: {
    plan: 'free',
    note: 'Free / trial-style access is limited; prefer paid tiers for GPT-4-class models.',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', note: 'default Emotion openai model' },
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
  },
  tier1: {
    plan: 'tier1',
    note: 'Typical paid OpenAI API after first spend (usage-based).',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'o4-mini', label: 'o4-mini', note: 'reasoning' },
      { id: 'o3-mini', label: 'o3-mini', note: 'reasoning' },
    ],
  },
  tier2: {
    plan: 'tier2',
    note: 'Higher usage limits; same flagship chat/reasoning models as tier1 in practice.',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'o4-mini', label: 'o4-mini' },
      { id: 'o3', label: 'o3', note: 'reasoning' },
      { id: 'o3-mini', label: 'o3-mini' },
    ],
  },
  tier3: {
    plan: 'tier3',
    note: 'High-limit / enterprise-adjacent API access.',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'o4-mini', label: 'o4-mini' },
      { id: 'o3', label: 'o3' },
      { id: 'o3-mini', label: 'o3-mini' },
      { id: 'o1', label: 'o1', note: 'legacy reasoning' },
    ],
  },
  enterprise: {
    plan: 'enterprise',
    note: 'Enterprise contract — model allow-list may differ; these are common IDs.',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'o3', label: 'o3' },
      { id: 'o4-mini', label: 'o4-mini' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    ],
  },
};

const ANTHROPIC_BY_PLAN = {
  free: {
    plan: 'free',
    note: 'Claude.ai free / limited Claude Code access.',
    models: [
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'fast / cheap' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', note: 'may be rate-limited' },
    ],
  },
  pro: {
    plan: 'pro',
    note: 'Claude Pro / standard Claude Code subscriber.',
    models: [
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', note: 'higher usage cost' },
    ],
  },
  max: {
    plan: 'max',
    note: 'Claude Max / higher Claude Code limits.',
    models: [
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', note: 'when enabled for your org' },
    ],
  },
  api: {
    plan: 'api',
    note: 'Anthropic API key (usage-billed) — not Claude.ai chat subscription.',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 API' },
      { id: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5 API' },
      { id: 'claude-opus-4-5-20251101', label: 'Opus 4.5 API' },
    ],
  },
};

const CURSOR_BY_PLAN = {
  hobby: {
    plan: 'hobby',
    note: 'Cursor Hobby — limited premium model requests.',
    models: [
      { id: 'auto', label: 'Auto', note: 'Cursor picks' },
      { id: 'composer-2', label: 'Composer 2' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    ],
  },
  pro: {
    plan: 'pro',
    note: 'Cursor Pro.',
    models: [
      { id: 'auto', label: 'Auto' },
      { id: 'composer-2', label: 'Composer 2' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { id: 'gpt-5.4', label: 'GPT-5.4', note: 'when offered in Cursor' },
      { id: 'gemini-3-flash', label: 'Gemini 3 Flash' },
    ],
  },
  pro_plus: {
    plan: 'pro_plus',
    note: 'Cursor Pro+ / higher agent usage.',
    models: [
      { id: 'auto', label: 'Auto' },
      { id: 'composer-2', label: 'Composer 2' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { id: 'gpt-5.4', label: 'GPT-5.4' },
      { id: 'gemini-3-pro', label: 'Gemini 3 Pro' },
    ],
  },
  ultra: {
    plan: 'ultra',
    note: 'Cursor Ultra — widest premium pool.',
    models: [
      { id: 'auto', label: 'Auto' },
      { id: 'composer-2', label: 'Composer 2' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'gpt-5.4', label: 'GPT-5.4' },
      { id: 'gemini-3-pro', label: 'Gemini 3 Pro' },
    ],
  },
};

const CYREX_DEFAULT = {
  plan: 'default',
  note: 'Cyrex / AI service — models depend on your Deepiri deployment.',
  models: [
    { id: 'default', label: 'Service default' },
    { id: 'mistral:7b', label: 'mistral:7b (typical Cyrex Ollama default)' },
  ],
};

function normalizePlan(raw, aliases = {}) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!key) return null;
  if (aliases[key]) return aliases[key];
  return key;
}

/**
 * @param {string} provider
 * @param {Record<string, unknown>} config
 * @returns {PlanCatalog}
 */
export function getCloudCatalog(provider, config = {}) {
  switch (provider) {
    case 'openai': {
      const plan =
        normalizePlan(config.openaiPlan || process.env.OPENAI_PLAN, {
          paid: 'tier1',
          basic: 'tier1',
          standard: 'tier1',
          plus: 'tier2',
        }) || 'tier1';
      return OPENAI_BY_PLAN[plan] || OPENAI_BY_PLAN.tier1;
    }
    case 'claude-cli': {
      const plan =
        normalizePlan(
          config.anthropicPlan || config.claudePlan || process.env.ANTHROPIC_PLAN || process.env.CLAUDE_PLAN,
          { plus: 'pro', team: 'pro', premium: 'max' }
        ) || 'pro';
      return ANTHROPIC_BY_PLAN[plan] || ANTHROPIC_BY_PLAN.pro;
    }
    case 'cursor': {
      const plan =
        normalizePlan(config.cursorPlan || process.env.CURSOR_PLAN, {
          free: 'hobby',
          proplus: 'pro_plus',
          'pro+': 'pro_plus',
        }) || 'pro';
      return CURSOR_BY_PLAN[plan] || CURSOR_BY_PLAN.pro;
    }
    case 'cyrex':
      return CYREX_DEFAULT;
    default:
      return { plan: 'unknown', models: [], note: `No curated catalog for provider "${provider}".` };
  }
}

export function listCloudPlanNames(provider) {
  switch (provider) {
    case 'openai':
      return Object.keys(OPENAI_BY_PLAN);
    case 'claude-cli':
      return Object.keys(ANTHROPIC_BY_PLAN);
    case 'cursor':
      return Object.keys(CURSOR_BY_PLAN);
    case 'cyrex':
      return ['default'];
    default:
      return [];
  }
}
