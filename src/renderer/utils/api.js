/**
 * API Utilities
 * Centralized API communication
 */
import { ENDPOINTS } from '../api/endpoints.js';

const _API_BASE = ENDPOINTS.DEFAULT_API_BASE;
const _AI_SERVICE_BASE = ENDPOINTS.DEFAULT_AI_SERVICE;

export const api = {
  async request(method, endpoint, data = null) {
    try {
      const result = await window.electronAPI.apiRequest({
        method,
        endpoint,
        data
      });
      return result;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  async classifyTask(task, description) {
    try {
      const result = await window.electronAPI.classifyTask(task, description);
      return result;
    } catch (error) {
      console.error('Task classification failed:', error);
      throw error;
    }
  },

  async generateChallenge(taskData) {
    try {
      const result = await window.electronAPI.generateChallenge(taskData);
      return result;
    } catch (error) {
      console.error('Challenge generation failed:', error);
      throw error;
    }
  },

  async getTasks() {
    return this.request('GET', '/tasks');
  },

  async createTask(task) {
    return this.request('POST', '/tasks', task);
  },

  async updateTask(id, updates) {
    return this.request('PATCH', `/tasks/${id}`, updates);
  },

  async deleteTask(id) {
    return this.request('DELETE', `/tasks/${id}`);
  },

  async getChallenges() {
    return this.request('GET', '/challenges');
  },

  async startChallenge(challengeId) {
    return this.request('POST', `/challenges/${challengeId}/start`);
  },

  async completeChallenge(challengeId, metrics) {
    return this.request('POST', `/challenges/${challengeId}/complete`, metrics);
  },

  async getGamificationStats() {
    return this.request('GET', '/gamification/stats');
  },

  async awardPoints(points) {
    return this.request('POST', '/gamification/award-points', { points });
  },

  async awardBadge(badge) {
    return this.request('POST', '/gamification/award-badge', { badge });
  }
};

