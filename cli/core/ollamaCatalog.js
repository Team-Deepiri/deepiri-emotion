/**
 * Ollama model catalog + hardware fit rules.
 *
 * Copied from diri-cyrex/scripts/llm/check-ollama-models.sh (MODEL_LIST +
 * categorize_model). Do NOT import or exec that script — keep this in sync
 * when the cyrex catalog changes.
 */
import { execFileSync } from 'child_process';
import { platform } from 'os';
import { readFileSync, existsSync } from 'fs';


export const OLLAMA_CATALOG = [
  { name: 'mistral:7b', size: '4.1GB', description: 'DEFAULT - Used by this project' },
  { name: 'llama3:8b', size: '4.7GB', description: 'Alternative model' },
  { name: 'qwen3:0.6b', size: '523MB', description: 'Latest Qwen 3 tiny reasoning model' },
  { name: 'qwen3:1.7b', size: '1.4GB', description: 'Latest Qwen 3 small reasoning model' },
  { name: 'qwen3:4b', size: '2.5GB', description: 'Latest Qwen 3 efficient reasoning model' },
  { name: 'qwen3:8b', size: '5.2GB', description: 'Latest Qwen 3 balanced reasoning model' },
  { name: 'qwen3:14b', size: '9.3GB', description: 'Latest Qwen 3 stronger reasoning model' },
  { name: 'qwen3:30b', size: '19GB', description: 'Latest Qwen 3 MoE workstation model' },
  { name: 'qwen3:32b', size: '20GB', description: 'Latest Qwen 3 large dense model' },
  { name: 'qwen3:235b', size: '142GB', description: 'Latest Qwen 3 flagship MoE model' },
  { name: 'qwen3.5:0.8b', size: '1.0GB', description: 'Qwen 3.5 tiny multimodal model' },
  { name: 'qwen3.5:2b', size: '2.7GB', description: 'Qwen 3.5 small multimodal model' },
  { name: 'qwen3.5:4b', size: '3.4GB', description: 'Qwen 3.5 efficient multimodal model' },
  { name: 'qwen3.5:9b', size: '6.6GB', description: 'Qwen 3.5 balanced multimodal model' },
  { name: 'qwen3.5:27b', size: '17GB', description: 'Qwen 3.5 workstation multimodal model' },
  { name: 'qwen3.5:35b', size: '24GB', description: 'Qwen 3.5 large multimodal model' },
  { name: 'qwen3.5:122b', size: '81GB', description: 'Qwen 3.5 flagship local model' },
  { name: 'qwen3.6:27b', size: '17GB', description: 'Qwen 3.6 coding/general model' },
  { name: 'qwen3.6:35b', size: '24GB', description: 'Qwen 3.6 latest coding/general model' },
  { name: 'qwen3-next:80b', size: '50GB', description: 'Qwen3-Next efficient MoE model' },
  { name: 'deepseek-r1:1.5b', size: '1.1GB', description: 'Small open reasoning model' },
  { name: 'deepseek-r1:7b', size: '4.7GB', description: 'Open reasoning model' },
  { name: 'deepseek-r1:8b', size: '5.2GB', description: 'Updated open reasoning model' },
  { name: 'deepseek-r1:14b', size: '9.0GB', description: 'Stronger open reasoning model' },
  { name: 'deepseek-r1:32b', size: '20GB', description: 'Large open reasoning model' },
  { name: 'deepseek-r1:70b', size: '43GB', description: 'Very large open reasoning model' },
  { name: 'gemma3:270m', size: '292MB', description: 'Tiny Gemma 3 text model' },
  { name: 'gemma3:1b', size: '815MB', description: 'Small Gemma 3 text model' },
  { name: 'gemma3:4b', size: '3.3GB', description: 'Gemma 3 multimodal model' },
  { name: 'gemma3:12b', size: '8.1GB', description: 'Gemma 3 larger multimodal model' },
  { name: 'gemma3:27b', size: '17GB', description: 'Gemma 3 large multimodal model' },
  { name: 'gemma4:e2b', size: '7.2GB', description: 'Latest Gemma 4 edge multimodal model' },
  { name: 'gemma4:e4b', size: '9.6GB', description: 'Latest Gemma 4 edge multimodal model' },
  { name: 'gemma4:26b', size: '18GB', description: 'Latest Gemma 4 MoE workstation model' },
  { name: 'gemma4:31b', size: '20GB', description: 'Latest Gemma 4 dense workstation model' },
  { name: 'gpt-oss:20b', size: '14GB', description: 'OpenAI open-weight reasoning model' },
  { name: 'gpt-oss:120b', size: '65GB', description: 'OpenAI large open-weight reasoning model' },
  { name: 'phi4:14b', size: '9.1GB', description: 'Microsoft Phi-4 reasoning model' },
  { name: 'phi4-mini:3.8b', size: '2.5GB', description: 'Microsoft Phi-4 mini tools model' },
  { name: 'granite3.3:2b', size: '1.5GB', description: 'IBM Granite long-context small model' },
  { name: 'granite3.3:8b', size: '4.9GB', description: 'IBM Granite long-context model' },
  { name: 'granite4:350m', size: '708MB', description: 'IBM Granite 4 tiny tools model' },
  { name: 'granite4:1b', size: '3.3GB', description: 'IBM Granite 4 small tools model' },
  { name: 'granite4:3b', size: '2.1GB', description: 'IBM Granite 4 micro tools model' },
  { name: 'granite4.1:3b', size: '2.1GB', description: 'IBM Granite 4.1 small tools model' },
  { name: 'granite4.1:8b', size: '5.3GB', description: 'IBM Granite 4.1 tools model' },
  { name: 'granite4.1:30b', size: '17GB', description: 'IBM Granite 4.1 large tools model' },
  { name: 'olmo-3:7b', size: '4.5GB', description: 'Fully open OLMo 3 model' },
  { name: 'olmo-3:32b', size: '19GB', description: 'Fully open OLMo 3 large model' },
  { name: 'ministral-3:3b', size: '3.0GB', description: 'Mistral edge multimodal model' },
  { name: 'ministral-3:8b', size: '6.0GB', description: 'Mistral edge multimodal model' },
  { name: 'ministral-3:14b', size: '9.1GB', description: 'Mistral edge multimodal model' },
  { name: 'lfm2:24b', size: '14GB', description: 'Liquid AI efficient local MoE model' },
  { name: 'laguna-xs.2:latest', size: '23GB', description: 'Poolside local-ready coding MoE model' },
  { name: 'laguna-xs.2:nvfp4', size: '22GB', description: 'Poolside coding MoE NVFP4 model' },
  { name: 'laguna-xs.2:q4_K_M', size: '23GB', description: 'Poolside coding MoE Q4 model' },
  { name: 'nemotron-cascade-2:30b', size: '24GB', description: 'NVIDIA open reasoning MoE model' },
  { name: 'nemotron-3-nano:4b', size: '2.8GB', description: 'NVIDIA efficient open reasoning model' },
  { name: 'nemotron-3-nano:30b', size: '24GB', description: 'NVIDIA open reasoning MoE model' },
  { name: 'nemotron3:33b', size: '28GB', description: 'NVIDIA multimodal open model' },
  { name: 'medgemma1.5:4b', size: '3.3GB', description: 'Medical Gemma 1.5 multimodal model' },
  { name: 'medgemma:4b', size: '3.3GB', description: 'Medical Gemma multimodal model' },
  { name: 'medgemma:27b', size: '17GB', description: 'Medical Gemma large multimodal model' },
  { name: 'devstral:24b', size: '14GB', description: 'Open coding-agent model' },
  { name: 'devstral-small-2:24b', size: '14GB', description: 'Updated open coding-agent model' },
  { name: 'devstral-2:123b', size: '75GB', description: 'Large open coding-agent model' },
  { name: 'qwen3-coder:30b', size: '19GB', description: 'Latest Qwen agentic coding model' },
  { name: 'qwen3-coder:480b', size: '290GB', description: 'Flagship Qwen agentic coding model' },
  { name: 'qwen3-coder-next:latest', size: '52GB', description: 'Qwen3-Coder-Next agentic coding model' },
  { name: 'mistral-medium-3.5:128b', size: '80GB', description: 'Mistral flagship open-weight model' },
  { name: 'deepcoder:1.5b', size: '1.1GB', description: 'Small open code reasoning model' },
  { name: 'deepcoder:14b', size: '9.0GB', description: 'Open code reasoning model' },
  { name: 'yi-coder:9b', size: '5.4GB', description: 'Efficient open coding model' },
  { name: 'llama4:scout', size: '67GB', description: 'Llama 4 multimodal MoE model' },
  { name: 'llama4:maverick', size: '245GB', description: 'Llama 4 flagship multimodal MoE model' },
  { name: 'llama3.2:1b', size: '1.3GB', description: 'Small, fast' },
  { name: 'llama3.2:3b', size: '2.0GB', description: 'Balanced' },
  { name: 'llama3.1:8b', size: '4.7GB', description: 'Latest Llama 3.1' },
  { name: 'llama3.1:70b', size: '40GB', description: 'Large, powerful (requires 48GB+ VRAM)' },
  { name: 'mistral-nemo:12b', size: '7.0GB', description: 'Enhanced Mistral' },
  { name: 'mixtral:8x7b', size: '26GB', description: 'Mixture of experts' },
  { name: 'gemma2:2b', size: '1.4GB', description: 'Small, efficient' },
  { name: 'gemma2:9b', size: '5.4GB', description: 'Balanced' },
  { name: 'gemma2:27b', size: '16GB', description: 'Large, powerful' },
  { name: 'gemma:7b', size: '4.6GB', description: "Google's Gemma" },
  { name: 'phi3:mini', size: '2.3GB', description: 'Small, fast' },
  { name: 'phi3:medium', size: '7.0GB', description: 'Balanced' },
  { name: 'codellama:7b', size: '3.8GB', description: 'Code generation' },
  { name: 'codellama:13b', size: '7.3GB', description: 'Larger code model' },
  { name: 'deepseek-coder:6.7b', size: '4.1GB', description: 'Advanced coding' },
  { name: 'qwen2.5:7b', size: '4.4GB', description: "Alibaba's model" },
  { name: 'qwen2.5-coder:7b', size: '4.4GB', description: "Alibaba's coding model" },
  { name: 'neural-chat:7b', size: '4.1GB', description: 'Conversational AI' },
  { name: 'yi:6b', size: '3.8GB', description: 'Yi model 6B' },
  { name: 'yi:9b', size: '5.4GB', description: 'Yi model 9B' },
  { name: 'openchat:7b', size: '4.1GB', description: 'OpenChat model' },
  { name: 'zephyr:7b', size: '4.1GB', description: 'Zephyr model' },
  { name: 'nous-hermes:7b', size: '4.1GB', description: 'Nous Hermes' },
  { name: 'mythomax:7b', size: '4.1GB', description: 'MythoMax' },
  { name: 'dolphin-mistral:7b', size: '4.1GB', description: 'Dolphin Mistral' },
  { name: 'orca-mini:7b', size: '4.1GB', description: 'Orca Mini' },
  { name: 'vicuna:13b', size: '7.3GB', description: 'Vicuna 13B' },
  { name: 'falcon:11b', size: '6.0GB', description: 'Falcon 11B' },
  { name: 'openhermes:13b', size: '7.3GB', description: 'OpenHermes' },
  { name: 'starcoder2:7b', size: '4.1GB', description: 'StarCoder2' },
  { name: 'wizardcoder:7b', size: '4.1GB', description: 'WizardCoder 7B' },
  { name: 'wizardcoder:13b', size: '7.3GB', description: 'WizardCoder 13B' },
];


/** @typedef {'recommended'|'usable'|'marginal'|'no'} ModelFit */

export function setupTier(ramGb, vramGb) {
  const ram = Number(ramGb) || 0;
  const vram = Number(vramGb) || 0;
  if ((ram >= 32 || ram >= 30) && (vram >= 16 || vram >= 15)) return 'setup5';
  if (ram >= 32 && vram >= 10) return 'setup4';
  if (ram >= 32 && vram >= 8) return 'setup3';
  if (vram >= 15) return 'setup5';
  if (ram >= 16 && vram >= 10) return 'setup2';
  if (ram >= 16 && vram >= 8) return 'setup1';
  if (ram >= 16 || vram >= 8) return 'basic';
  return 'minimal';
}

const SMALL = new Set([
  'llama3.2:1b', 'llama3.2:3b', 'gemma2:2b', 'phi3:mini', 'phi4-mini:3.8b',
  'qwen3:0.6b', 'qwen3:1.7b', 'gemma3:270m', 'gemma3:1b', 'deepseek-r1:1.5b',
  'deepcoder:1.5b', 'granite3.3:2b', 'qwen3.5:0.8b', 'qwen3.5:2b',
  'granite4:350m', 'granite4:1b', 'granite4:3b', 'granite4.1:3b',
  'ministral-3:3b', 'nemotron-3-nano:4b', 'medgemma1.5:4b', 'medgemma:4b',
]);

const SEVEN_B = new Set([
  'mistral:7b', 'neural-chat:7b', 'qwen2.5:7b', 'gemma:7b', 'yi:6b',
  'openchat:7b', 'zephyr:7b', 'nous-hermes:7b', 'mythomax:7b',
  'dolphin-mistral:7b', 'orca-mini:7b', 'qwen3:4b', 'gemma3:4b', 'qwen3.5:4b',
]);

const EIGHT_B = new Set([
  'llama3:8b', 'llama3.1:8b', 'qwen3:8b', 'deepseek-r1:7b', 'deepseek-r1:8b',
  'granite3.3:8b', 'olmo-3:7b', 'qwen3.5:9b', 'ministral-3:8b', 'granite4.1:8b',
]);

const NINE_B = new Set(['gemma2:9b', 'yi:9b']);

const ELEVEN_TWELVE = new Set([
  'mistral-nemo:12b', 'falcon:11b', 'gemma3:12b', 'qwen3:14b', 'deepseek-r1:14b',
  'deepcoder:14b', 'phi4:14b', 'gemma4:e2b', 'gemma4:e4b', 'ministral-3:14b',
  'gpt-oss:20b',
]);

const THIRTEEN = new Set(['vicuna:13b', 'openhermes:13b']);

const TWENTY_SEVEN = new Set([
  'gemma2:27b', 'gemma3:27b', 'gemma4:26b', 'gemma4:31b', 'qwen3:30b', 'qwen3:32b',
  'deepseek-r1:32b', 'olmo-3:32b', 'qwen3.5:27b', 'qwen3.5:35b', 'qwen3.6:27b',
  'qwen3.6:35b', 'granite4.1:30b', 'nemotron-cascade-2:30b', 'nemotron-3-nano:30b',
  'nemotron3:33b', 'laguna-xs.2:nvfp4', 'laguna-xs.2:q4_K_M', 'medgemma:27b',
]);

const MOE = new Set([
  'mixtral:8x7b', 'devstral:24b', 'devstral-small-2:24b', 'qwen3-coder:30b',
  'lfm2:24b', 'laguna-xs.2:latest',
]);

const SEVENTY = new Set([
  'llama3.1:70b', 'deepseek-r1:70b', 'llama4:scout', 'llama4:maverick',
  'qwen3:235b', 'qwen3-coder:480b', 'qwen3.5:122b', 'gpt-oss:120b',
  'qwen3-next:80b', 'qwen3-coder-next:latest', 'devstral-2:123b',
  'mistral-medium-3.5:128b',
]);

const CODE7 = new Set([
  'codellama:7b', 'deepseek-coder:6.7b', 'qwen2.5-coder:7b', 'starcoder2:7b',
  'wizardcoder:7b', 'yi-coder:9b',
]);

const CODE13 = new Set(['codellama:13b', 'wizardcoder:13b']);

/**
 * @param {string} modelName
 * @param {number} ramGb
 * @param {number} vramGb
 * @returns {ModelFit}
 */
export function categorizeModel(modelName, ramGb, vramGb) {
  const ram = Number(ramGb) || 0;
  const vram = Number(vramGb) || 0;
  const setup = setupTier(ram, vram);
  const hi = setup === 'setup5' || setup === 'setup4' || setup === 'setup3' || setup === 'setup2';

  if (SMALL.has(modelName)) return ram >= 8 ? 'recommended' : 'usable';

  if (SEVEN_B.has(modelName)) {
    if (hi) return 'recommended';
    if (vram >= 8 && ram >= 16) return 'recommended';
    if (vram >= 8 || ram >= 16) return 'usable';
    if (ram >= 8) return 'marginal';
    return 'no';
  }

  if (EIGHT_B.has(modelName)) {
    if (hi) return 'recommended';
    if (setup === 'setup1') return 'usable';
    if (ram >= 16) return 'marginal';
    return 'no';
  }

  if (NINE_B.has(modelName)) {
    if (hi) return 'recommended';
    if (setup === 'setup1') return 'usable';
    if (ram >= 32) return 'marginal';
    return 'no';
  }

  if (ELEVEN_TWELVE.has(modelName)) {
    if (hi) return 'recommended';
    if (ram >= 32 && vram >= 8) return 'usable';
    return 'marginal';
  }

  if (THIRTEEN.has(modelName)) {
    if (setup === 'setup5' || setup === 'setup4' || setup === 'setup3') return 'recommended';
    if (ram >= 32) return 'usable';
    return 'marginal';
  }

  if (TWENTY_SEVEN.has(modelName)) {
    if (setup === 'setup5') return 'recommended';
    if (ram >= 32 && vram >= 10) return 'marginal';
    return 'no';
  }

  if (MOE.has(modelName)) {
    return setup === 'setup5' || setup === 'setup4' ? 'marginal' : 'no';
  }

  if (SEVENTY.has(modelName)) return vram >= 48 ? 'marginal' : 'no';

  if (CODE7.has(modelName)) {
    if (hi) return 'recommended';
    if (vram >= 8 && ram >= 16) return 'recommended';
    if (vram >= 8 || ram >= 16) return 'usable';
    return 'marginal';
  }

  if (CODE13.has(modelName)) {
    if (hi) return 'recommended';
    if (ram >= 32) return 'usable';
    return 'marginal';
  }

  if (modelName === 'phi3:medium') {
    if (hi || setup === 'setup1') return 'usable';
    if (ram >= 32) return 'marginal';
    return 'no';
  }

  if (setup === 'setup5') return 'recommended';
  if (setup === 'setup4' || setup === 'setup3') return 'usable';
  if (vram >= 8 && ram >= 16) return 'usable';
  return 'marginal';
}

export function detectSystemRamGb() {
  try {
    if (platform() === 'darwin') {
      const out = execFileSync('sysctl', ['-n', 'hw.memsize'], { encoding: 'utf8' }).trim();
      return Math.floor(Number(out) / 1024 / 1024 / 1024) || 0;
    }
    if (existsSync('/proc/meminfo')) {
      const raw = readFileSync('/proc/meminfo', 'utf8');
      const m = raw.match(/MemTotal:\s+(\d+)/);
      if (m) return Math.floor(Number(m[1]) / 1024 / 1024) || 0;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export function detectGpuVramGb() {
  try {
    const out = execFileSync(
      'nvidia-smi',
      ['--query-gpu=memory.total', '--format=csv,noheader,nounits'],
      { encoding: 'utf8', timeout: 3000 }
    ).trim();
    const first = out.split('\n')[0]?.trim();
    const mb = Number(first);
    if (Number.isFinite(mb) && mb > 0) return Math.floor(mb / 1024);
  } catch {
    /* no nvidia */
  }
  if (platform() === 'darwin') {
    // Unified memory estimate
    return detectSystemRamGb();
  }
  return 0;
}

/**
 * Rank catalog entries for local hardware. Marks installed models.
 * @param {string[]} installedNames
 * @param {{ ramGb?: number, vramGb?: number }} [hw]
 */
export function rankOllamaCatalog(installedNames = [], hw = {}) {
  const ramGb = hw.ramGb ?? detectSystemRamGb();
  const vramGb = hw.vramGb ?? detectGpuVramGb();
  const installed = new Set(installedNames);
  const installedLoose = new Set(
    installedNames.flatMap((n) => {
      const base = n.split(':')[0];
      return [n, base];
    })
  );
  const groups = { recommended: [], usable: [], marginal: [], no: [] };
  for (const entry of OLLAMA_CATALOG) {
    const fit = categorizeModel(entry.name, ramGb, vramGb);
    const isInstalled =
      installed.has(entry.name) ||
      installedLoose.has(entry.name) ||
      [...installed].some((n) => n === entry.name || n.startsWith(`${entry.name.split(':')[0]}:`));
    groups[fit].push({ ...entry, fit, installed: isInstalled });
  }
  return {
    ramGb,
    vramGb,
    setup: setupTier(ramGb, vramGb),
    groups,
  };
}

