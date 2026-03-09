/**
 * Agent service: list/register/unregister agents, Fabric bus, neural memory.
 */
import { IPC } from '../../shared/ipcChannels.js';

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ agentRuntime: object, neuralMemory: object, ideAgentId: number, getMainWindow: () => import('electron').BrowserWindow | null }} deps
 */
export function registerAgentService(ipcMain, deps) {
  const { agentRuntime, neuralMemory, ideAgentId } = deps;
  const rendererSubscriptions = new Map();

  const cleanupRenderer = (wcId) => {
    const subs = rendererSubscriptions.get(wcId);
    if (subs) {
      subs.forEach((s) => s.unsub());
      rendererSubscriptions.delete(wcId);
    }
  };

  ipcMain.handle(IPC.LIST_AGENTS, async () => {
    const list = agentRuntime.listAgents();
    return list.map((a) => ({ id: a.id, name: a.name, version: a.version, capabilities: a.capabilities }));
  });

  ipcMain.handle(IPC.REGISTER_AGENT, async (_event, { name, version = '1.0.0', capabilities = 0 }) => {
    const { resolveCapabilities } = await import('../../capabilities.js');
    const capMask = typeof capabilities === 'number' ? capabilities : resolveCapabilities(capabilities);
    const id = agentRuntime.registerAgent({ name: (name || 'subagent').slice(0, 63), version: (version || '1.0.0').slice(0, 15) }, capMask);
    return { id, name: (name || 'subagent').slice(0, 63), version: (version || '1.0.0').slice(0, 15) };
  });

  ipcMain.handle(IPC.UNREGISTER_AGENT, async (_event, agentId) => {
    if (Number(agentId) === ideAgentId) return { success: false, error: 'Cannot unregister IDE agent' };
    agentRuntime.unregisterAgent(Number(agentId));
    return { success: true };
  });

  ipcMain.handle(IPC.FABRIC_SEND, async (event, { subject, data }) => {
    try {
      const result = agentRuntime.send(ideAgentId, subject || 'event', data);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  let nextSubscriptionId = 0;
  ipcMain.handle(IPC.FABRIC_SUBSCRIBE, (event, { subjectPattern }) => {
    const senderId = event.sender.id;
    if (!rendererSubscriptions.has(senderId)) rendererSubscriptions.set(senderId, []);
    const id = ++nextSubscriptionId;
    const unsub = agentRuntime.on(subjectPattern || '*', (payload) => {
      if (event.sender.isDestroyed()) return;
      event.sender.send('fabric-message', { subject: subjectPattern, payload });
    });
    rendererSubscriptions.get(senderId).push({ id, unsub });
    return { subscribed: true, subscriptionId: id, subjectPattern: subjectPattern || '*' };
  });

  ipcMain.handle(IPC.FABRIC_UNSUBSCRIBE, (event, { subscriptionId } = {}) => {
    const senderId = event.sender.id;
    const subs = rendererSubscriptions.get(senderId);
    if (subscriptionId != null && subs) {
      const entry = subs.find((s) => s.id === subscriptionId);
      if (entry) {
        entry.unsub();
        subs.splice(subs.indexOf(entry), 1);
      }
    } else if (subs) {
      subs.forEach((s) => s.unsub());
      rendererSubscriptions.delete(senderId);
    }
    return { unsubscribed: true };
  });

  ipcMain.handle(IPC.NEURAL_MEMORY_STORE, async (_event, { agentId, embedding, metadata, ttlSec }) => {
    try {
      const id = neuralMemory.store(agentId ?? 0, embedding, metadata, ttlSec ?? 3600);
      return { success: true, memoryId: id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.NEURAL_MEMORY_QUERY, async (_event, { agentId, queryVector, topK, threshold }) => {
    try {
      const results = neuralMemory.query(agentId ?? 0, queryVector, topK ?? 5, threshold ?? 0);
      return { success: true, results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.NEURAL_MEMORY_CLEAR, async (_event, { agentId }) => {
    try {
      neuralMemory.clear(agentId ?? null);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  return { cleanupRenderer };
}
