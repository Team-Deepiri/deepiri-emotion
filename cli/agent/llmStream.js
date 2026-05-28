/**
 * LLM streaming: emits LLM_TOKEN and LLM_DONE.
 * Supports OpenAI (streaming), Ollama (streaming), Cyrex (non-streaming → simulated tokens).
 */
import { EVENTS } from '../core/eventBus.js';

const SIMULATED_TOKEN_DELAY_MS = 20;

/**
 * Emit a full string as tokens (char-by-char) for TUI effect.
 */

function emitReplyAsTokens(bus, text, onToken = null) {
  for (const char of (text || '')) {
    bus.emit(EVENTS.LLM_TOKEN, { token: char });
    if (typeof onToken === 'function') onToken(char);
  }
}

/**
 * Stream OpenAI chat completions (SSE).
 */
async function streamOpenAI(bus, messages, config, opts = {}) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: JSON.stringify({
      model: config.openaiModel || 'gpt-4o-mini',
      messages,
      stream: true
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Invalid OpenAI API key' : err || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const content = json?.choices?.[0]?.delta?.content;

          if (content) {
            if (!opts.silent) {
              bus.emit(EVENTS.LLM_TOKEN, { token: content });
            }

            if (typeof opts.onToken === 'function') {
              opts.onToken(content);
            }
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  }
}

/**
 * Stream Ollama /api/chat (NDJSON).
 */
async function streamOllama(bus, messages, config) {
  const base = (config.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel || 'llama3.2',
      messages,
      stream: true
    })
  });
  if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const content = json?.message?.content;
        if (content) bus.emit(EVENTS.LLM_TOKEN, { token: content });
      } catch {
        // skip
      }
    }
  }
}

/**
 * Cyrex: single POST, then emit reply as tokens for TUI effect.
 */
async function streamCyrex(bus, prompt, config) {
  const base = (config.aiServiceUrl || 'http://localhost:8000').replace(/\/$/, '');
  const res = await fetch(`${base}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, context: '', file_content: '', selection: null })
  });
  if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
  const data = await res.json();
  const reply = data?.reply ?? data?.content ?? data?.message ?? (typeof data === 'string' ? data : '');
  for (const char of String(reply)) {
    bus.emit(EVENTS.LLM_TOKEN, { token: char });
    await new Promise((r) => setTimeout(r, SIMULATED_TOKEN_DELAY_MS));
  }
}

/**
 * @param {import('events').EventEmitter} bus
 * @param {string} prompt
 * @param {{ config?: import('../core/config.js').DEFAULT_CONFIG & Record<string,unknown> }} [opts]
 */
export async function streamLLM(bus, prompt, opts = {}) {
  const config = opts.config || {};
  const messages = [{ role: 'user', content: prompt }];

  if (config.provider === 'openai' && config.openaiApiKey) {
    await streamOpenAI(bus, messages, config, opts);
    bus.emit(EVENTS.LLM_DONE, {});
    return;
  }

  if (config.provider === 'ollama') {
    await streamOllama(bus, messages, config, opts);
    bus.emit(EVENTS.LLM_DONE, {});
    return;
  }

  if (config.provider === 'cyrex' || !config.provider) {
    try {
      await streamCyrex(bus, prompt, config);
    } catch (err) {
      // Fallback stub if Cyrex unreachable
      const msg = `(Cyrex unreachable: ${err.message}. Using stub.)\n\nHello from the CLI. Set OPENAI_API_KEY or run Cyrex locally.`;
      emitReplyAsTokens(bus, msg);
      await new Promise((r) => setTimeout(r, SIMULATED_TOKEN_DELAY_MS * 2));
    }
    bus.emit(EVENTS.LLM_DONE, {});
    return;
  }

  // No provider configured
  const stub = 'No AI provider configured. Set OPENAI_API_KEY, or AI_SERVICE_URL for Cyrex, or use provider: "ollama".';
  emitReplyAsTokens(bus, stub);
  bus.emit(EVENTS.LLM_DONE, {});
}
