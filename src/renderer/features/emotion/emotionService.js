/**
 * deepiri-emotion: Emotional AI agent and profile service.
 * Manages agent profiles, emotional state, and personality-driven behavior.
 */

const STORAGE_KEY_PROFILES = 'deepiri_emotion_profiles';
const STORAGE_KEY_ACTIVE_AGENT = 'deepiri_emotion_active_agent';
const STORAGE_KEY_EMOTIONAL_STATE = 'deepiri_emotion_state';

const DEFAULT_PROFILES = [
  {
    id: 'default',
    name: 'Deepiri Emotion',
    role: 'Creative partner',
    personality: ['supportive', 'curious', 'clear'],
    tone: 'warm',
    skills: ['code', 'writing', 'design'],
    avatar: null,
    createdAt: new Date().toISOString()
  }
];

export function getStoredProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROFILES;
    }
  } catch (_) {}
  return DEFAULT_PROFILES;
}

export function saveProfiles(profiles) {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
  } catch (e) {
    console.warn('emotionService: failed to save profiles', e);
  }
}

export function getActiveAgentId() {
  return localStorage.getItem(STORAGE_KEY_ACTIVE_AGENT) || 'default';
}

export function setActiveAgentId(id) {
  localStorage.setItem(STORAGE_KEY_ACTIVE_AGENT, id);
}

export function getEmotionalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMOTIONAL_STATE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.valence === 'number') return parsed;
    }
  } catch (_) {}
  return {
    valence: 0,
    energy: 0.5,
    focus: 0.5,
    updatedAt: new Date().toISOString()
  };
}

export function setEmotionalStateFromChat({ sentiment = 0, messageLength = 0 }) {
  const prev = getEmotionalState();
  const valence = typeof sentiment === 'number' ? Math.max(-1, Math.min(1, sentiment)) : prev.valence;
  const energy = messageLength > 200 ? Math.min(1, prev.energy + 0.1) : prev.energy;
  const next = {
    valence,
    energy: Math.max(0.1, Math.min(1, energy)),
    focus: prev.focus,
    updatedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(STORAGE_KEY_EMOTIONAL_STATE, JSON.stringify(next));
  } catch (_) {}
  return next;
}

export function getAgentResponseHints(profile, emotionalState) {
  // Hints for the AI backend to tailor tone and proactivity.
  if (!profile) return {};
  return {
    personality: profile.personality || [],
    tone: profile.tone || 'neutral',
    emotionalContext: emotionalState
  };
}
