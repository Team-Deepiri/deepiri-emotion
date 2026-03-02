/**
 * In-process agent runtime + Fabric-style message bus (NeuralGPTOS-inspired).
 * Subject-based and optional semantic routing; no kernel, all in main process.
 */

import { hasCapability, CAP } from './capabilities.js';
import { createRateLimiter } from './rateLimiter.js';

const MAX_AGENTS = 1024;
const MAX_MSG_SIZE = 65536;
const MAX_SUBJECT_LEN = 256;

function matchSubject(pattern, subject) {
  if (!pattern || pattern === '*') return true;
  const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return re.test(subject);
}

export function createAgentRuntime(opts = {}) {
  const rateLimiter = createRateLimiter(opts.rateLimit);
  const agents = new Map();
  const subscriptions = [];
  const pendingBySubject = new Map();
  let nextAgentId = 1;

  function registerAgent(manifest, capabilities = 0) {
    if (agents.size >= MAX_AGENTS) throw new Error('Max agents reached');
    const id = nextAgentId++;
    const agent = {
      id,
      name: (manifest?.name || 'anonymous').slice(0, 63),
      version: (manifest?.version || '1.0.0').slice(0, 15),
      capabilities: capabilities || 0,
      createdAt: Date.now()
    };
    agents.set(id, agent);
    return id;
  }

  function unregisterAgent(agentId) {
    agents.delete(agentId);
    for (const sub of subscriptions) {
      if (sub.agentId === agentId) sub.active = false;
    }
  }

  function subscribe(agentId, subjectPattern, handler) {
    if (!hasCapability(agents.get(agentId)?.capabilities ?? 0, CAP.FABRIC_RECV)) {
      throw new Error('Agent lacks FABRIC_RECV capability');
    }
    const sub = { agentId, subjectPattern: subjectPattern || '*', handler, active: true };
    subscriptions.push(sub);
    return () => { sub.active = false; };
  }

  function send(agentId, subject, data) {
    const agent = agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    if (!hasCapability(agent.capabilities, CAP.FABRIC_SEND)) {
      throw new Error('Agent lacks FABRIC_SEND capability');
    }
    if (!rateLimiter.tryConsumeMessage()) {
      throw new Error('Rate limit exceeded');
    }
    const raw = typeof data === 'string' ? Buffer.from(data, 'utf8') : (Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data)));
    if (raw.length > MAX_MSG_SIZE) throw new Error('Message too large');
    const subjectStr = (subject || '').slice(0, MAX_SUBJECT_LEN - 1);
    const msg = { agentId, subject: subjectStr, data: raw, dataLength: raw.length };

    const payload = raw.length > 0 ? (raw[0] === 0x7b ? JSON.parse(raw.toString('utf8')) : raw.toString('utf8')) : null;
    const delivered = [];
    for (const sub of subscriptions) {
      if (!sub.active || sub.agentId === agentId) continue;
      if (!matchSubject(sub.subjectPattern, subjectStr)) continue;
      try {
        sub.handler({ ...msg, payload }, () => {});
        delivered.push(sub.agentId);
      } catch (e) {
        console.error('[agentRuntime] subscriber error:', e);
      }
    }
    emit(subjectStr, payload);
    return { sent: true, deliveredTo: delivered };
  }

  const listeners = [];
  function on(subjectOrPattern, handler) {
    const pattern = subjectOrPattern || '*';
    listeners.push({ pattern, handler });
    return () => off(pattern, handler);
  }
  function off(pattern, handler) {
    const i = listeners.findIndex((e) => e.pattern === pattern && e.handler === handler);
    if (i !== -1) listeners.splice(i, 1);
  }
  function emit(subject, payload) {
    for (const { pattern, handler } of [...listeners]) {
      if (!matchSubject(pattern, subject)) continue;
      try {
        handler(payload);
      } catch (e) {
        console.error('[agentRuntime] emit handler error:', e);
      }
    }
  }

  function request(agentId, subject, data, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const replySubject = `reply/${subject}/${Date.now()}`;
      const timer = setTimeout(() => {
        off(replySubject, onReply);
        reject(new Error('Request timeout'));
      }, timeoutMs);
      const onReply = (payload) => {
        clearTimeout(timer);
        off(replySubject, onReply);
        resolve(payload);
      };
      on(replySubject, onReply);
      send(agentId, subject, { ...(typeof data === 'object' ? data : { body: data }), _replyTo: replySubject });
    });
  }

  const runtime = {
    registerAgent,
    unregisterAgent,
    subscribe,
    send,
    request,
    getAgent(id) { return agents.get(id) || null; },
    listAgents() { return Array.from(agents.values()); },
    on,
    off,
    emit
  };

  return runtime;
}
