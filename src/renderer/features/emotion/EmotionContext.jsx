/**
 * deepiri-emotion: React context for emotional AI agents and active profile.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  getStoredProfiles,
  saveProfiles,
  getActiveAgentId,
  setActiveAgentId as persistActiveAgent,
  getEmotionalState
} from './emotionService.js';

const EmotionContext = createContext(null);

export function EmotionProvider({ children }) {
  const [profiles, setProfiles] = useState(getStoredProfiles);
  const [activeAgentId, setActiveAgentIdState] = useState(getActiveAgentId);
  const [emotionalState, setEmotionalState] = useState(getEmotionalState);

  useEffect(() => {
    saveProfiles(profiles);
  }, [profiles]);

  const setActiveAgentId = useCallback((id) => {
    setActiveAgentIdState(id);
    persistActiveAgent(id);
  }, []);

  const updateProfile = useCallback((id, updates) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const addProfile = useCallback((profile) => {
    const newProfile = {
      ...profile,
      id: profile.id || `agent-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setProfiles((prev) => [...prev, newProfile]);
    return newProfile.id;
  }, []);

  const removeProfile = useCallback((id) => {
    if (id === 'default') return;
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (activeAgentId === id) setActiveAgentId('default');
  }, [activeAgentId, setActiveAgentId]);

  const refreshEmotionalState = useCallback(() => {
    setEmotionalState(getEmotionalState());
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeAgentId) || profiles[0];

  const value = {
    profiles,
    activeProfile,
    activeAgentId,
    setActiveAgentId,
    updateProfile,
    addProfile,
    removeProfile,
    emotionalState,
    refreshEmotionalState
  };

  return (
    <EmotionContext.Provider value={value}>
      {children}
    </EmotionContext.Provider>
  );
}

export function useEmotion() {
  const ctx = useContext(EmotionContext);
  if (!ctx) throw new Error('useEmotion must be used within EmotionProvider');
  return ctx;
}
