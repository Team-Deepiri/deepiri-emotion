/**
 * Simple hash to small vector (for local neural memory when no embedder).
 * Deterministic so same text => same vector for cache lookup.
 */
function textToVector(text, dim = 32) {
  let h = 0;
  const s = String(text);
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const out = new Array(dim);
  for (let i = 0; i < dim; i++) {
    h = (h * 1103515245 + 12345) | 0;
    out[i] = (h % 1000) / 1000 - 0.5;
  }
  return out;
}

/**
 * AI Service Integration
 * Connect desktop IDE to microservices AI backend.
 * Uses in-process Fabric bus and neural memory (NeuralGPTOS-inspired) when available.
 */
class AIService {
  constructor() {
    this.apiBase = process.env.API_URL || 'http://localhost:5000/api';
    this.aiServiceBase = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.useLocalModel = false;
  }

  _hasNeuralMemory() {
    return typeof window.electronAPI?.neuralMemoryStore === 'function';
  }

  _hasFabric() {
    return typeof window.electronAPI?.fabricSend === 'function';
  }

  async classifyTask(task, description = null) {
    try {
      const result = await window.electronAPI.classifyTask(task, description);
      if (result.success) {
        return result.data.classification;
      }
      throw new Error(result.error || 'Classification failed');
    } catch (error) {
      console.error('Task classification error:', error);
      throw error;
    }
  }

  async generateChallenge(taskData) {
    try {
      if (this.useLocalModel) {
        const result = await window.electronAPI.generateChallengeLocal(taskData.id || '');
        return result;
      } else {
        const result = await window.electronAPI.generateChallenge(taskData);
        if (result.success) {
          return result.data.data;
        }
        throw new Error(result.error || 'Challenge generation failed');
      }
    } catch (error) {
      console.error('Challenge generation error:', error);
      throw error;
    }
  }

  async personalizeChallenge(task, userHistory, context) {
    try {
      const result = await window.electronAPI.apiRequest({
        method: 'POST',
        endpoint: '/personalize/challenge',
        data: {
          user_id: this.getUserId(),
          task,
          user_history: userHistory,
          context
        }
      });
      return result.data;
    } catch (error) {
      console.error('Personalization error:', error);
      throw error;
    }
  }

  async adaptToContext(task, userData) {
    try {
      const result = await window.electronAPI.apiRequest({
        method: 'POST',
        endpoint: '/adapt/context',
        data: {
          user_id: this.getUserId(),
          task,
          user_data: userData
        }
      });
      return result.data;
    } catch (error) {
      console.error('Context adaptation error:', error);
      throw error;
    }
  }

  async selectChallengeWithBandit(context) {
    try {
      const result = await window.electronAPI.apiRequest({
        method: 'POST',
        endpoint: '/bandit/select',
        data: {
          user_id: this.getUserId(),
          context
        }
      });
      return result.data.challenge_type;
    } catch (error) {
      console.error('Bandit selection error:', error);
      return 'timed_completion';
    }
  }

  async updateBandit(challengeType, reward, context) {
    try {
      await window.electronAPI.apiRequest({
        method: 'POST',
        endpoint: '/bandit/update',
        data: {
          user_id: this.getUserId(),
          challenge_type: challengeType,
          reward,
          context
        }
      });
    } catch (error) {
      console.error('Bandit update error:', error);
    }
  }

  async generateWithRAG(task, query) {
    try {
      if (this._hasNeuralMemory()) {
        const key = `rag:${task}:${query}`;
        const vec = textToVector(key);
        const cached = await window.electronAPI.neuralMemoryQuery({
          agentId: 0,
          queryVector: vec,
          topK: 1,
          threshold: 0.99
        });
        if (cached?.success && cached.results?.length > 0) {
          try {
            const meta = JSON.parse(cached.results[0].metadata || '{}');
            if (meta.task === task && meta.query === query) return meta.response;
          } catch { /* ignore */ }
        }
      }
      const result = await window.electronAPI.apiRequest({
        method: 'POST',
        endpoint: '/rag/generate',
        data: { task, query }
      });
      const data = result.data;
      if (this._hasNeuralMemory() && data) {
        const key = `rag:${task}:${query}`;
        await window.electronAPI.neuralMemoryStore({
          agentId: 0,
          embedding: textToVector(key),
          metadata: JSON.stringify({ task, query, response: data }),
          ttlSec: 3600
        });
      }
      return data;
    } catch (error) {
      console.error('RAG generation error:', error);
      throw error;
    }
  }

  async getLLMHint(task) {
    try {
      const result = await window.electronAPI.getLLMHint(task);
      return result;
    } catch (error) {
      console.error('LLM hint error:', error);
      return 'Hint generation unavailable';
    }
  }

  async completeCode(code, language) {
    try {
      const result = await window.electronAPI.completeCode(code, language);
      return result;
    } catch (error) {
      console.error('Code completion error:', error);
      return code;
    }
  }

  setLocalModel(enabled) {
    this.useLocalModel = enabled;
  }

  getUserId() {
    return localStorage.getItem('user_id') || 'default_user';
  }
}

window.aiService = new AIService();

