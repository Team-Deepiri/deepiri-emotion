/**
 * Platform service: api-request, ai-request, tasks, session, gamification, integrations, get-llm-hint, complete-code.
 */
import axios from 'axios';
import { API_BASE_URL, AI_SERVICE_URL, desktopHeaders } from '../bootstrap-env.js';
import { IPC } from '../../shared/ipcChannels.js';

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ agentRuntime: { emit: (a: string, b: object) => void } }} deps
 */
export function registerPlatformService(ipcMain, deps) {
  const { agentRuntime } = deps;

  ipcMain.handle(IPC.API_REQUEST, async (_event, { method, endpoint, data, headers = {} }) => {
    try {
      const response = await axios({
        method,
        url: `${API_BASE_URL}${endpoint}`,
        data,
        headers: { ...desktopHeaders, ...headers }
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  });

  ipcMain.handle(IPC.AI_REQUEST, async (_event, { endpoint, data, headers = {} }) => {
    agentRuntime.emit('ai/request', { endpoint, data });
    try {
      const response = await axios({
        method: 'POST',
        url: `${AI_SERVICE_URL}${endpoint}`,
        data,
        headers: { ...desktopHeaders, ...headers }
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

  ipcMain.handle(IPC.GET_TASKS, async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/tasks`, { headers: desktopHeaders });
      return { success: true, data: response.data || [] };
    } catch {
      return { success: true, data: [] };
    }
  });

  ipcMain.handle(IPC.CREATE_TASK, async (_event, { title, description = '', type = 'manual' }) => {
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

  ipcMain.handle(IPC.START_SESSION, async (_event, userId) => {
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

  ipcMain.handle(IPC.END_SESSION, async () => {
    try {
      await axios.post(`${API_BASE_URL}/sessions/end`, {}, { headers: desktopHeaders });
      return { success: true };
    } catch {
      return { success: true };
    }
  });

  ipcMain.handle(IPC.RECORD_KEYSTROKE, async (_event, { key, file, line, column }) => {
    try {
      await axios.post(
        `${API_BASE_URL}/session/record-keystroke`,
        { key, file, line, column },
        { headers: desktopHeaders }
      );
    } catch { /* no-op */ }
  });

  ipcMain.handle(IPC.RECORD_FILE_CHANGE, async (_event, { file, changeType, details }) => {
    try {
      await axios.post(
        `${API_BASE_URL}/session/record-file-change`,
        { file, change_type: changeType, details },
        { headers: desktopHeaders }
      );
    } catch { /* no-op */ }
  });

  ipcMain.handle(IPC.AWARD_POINTS, async (_event, points) => {
    try {
      await axios.post(`${API_BASE_URL}/gamification/award`, { points }, { headers: desktopHeaders });
      return { success: true };
    } catch {
      return { success: true };
    }
  });

  ipcMain.handle(IPC.GET_GAMIFICATION_STATE, async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/gamification/state`, { headers: desktopHeaders });
      return response.data || {};
    } catch {
      return { points: 0, level: 1, streak: 0, badges: [] };
    }
  });

  ipcMain.handle(IPC.GENERATE_CHALLENGE_LOCAL, async (_event, taskId) => {
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

  ipcMain.handle(IPC.SYNC_GITHUB_ISSUES, async (_event, { repo = '', token = null }) => {
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

  ipcMain.handle(IPC.GET_LLM_HINT, async (_event, { task }) => {
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

  ipcMain.handle(IPC.COMPLETE_CODE, async (_event, { code, language }) => {
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
}
