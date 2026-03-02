/**
 * deepiri-emotion: Panel for emotional AI agents — select profile, see state, customize.
 */

import React, { useState } from 'react';
import { useEmotion } from './EmotionContext.jsx';
import './emotion.css';

export default function EmotionPanel({ onOpenAIChat }) {
  const {
    profiles,
    activeAgentId,
    setActiveAgentId,
    addProfile,
    removeProfile,
    updateProfile,
    emotionalState,
    refreshEmotionalState,
    activeProfile
  } = useEmotion();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTrait, setNewTrait] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    const id = addProfile({ name: newName.trim(), role: 'Partner', personality: ['supportive'], tone: 'warm', skills: [] });
    setActiveAgentId(id);
    setNewName('');
    setShowAdd(false);
  };

  return (
    <div className="emotion-panel">
      <div className="emotion-panel-header">
        <h2>Emotion — deepiri-emotion</h2>
        <p className="emotion-subtitle">Your AI creative partner with personality</p>
      </div>

      <section className="emotion-section">
        <h3>Active agent</h3>
        <div className="emotion-agent-cards">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`emotion-agent-card ${activeAgentId === p.id ? 'active' : ''}`}
              onClick={() => setActiveAgentId(p.id)}
            >
              <span className="emotion-agent-name">{p.name}</span>
              <span className="emotion-agent-role">{p.role || 'Partner'}</span>
              {p.id !== 'default' && (
                <button
                  type="button"
                  className="emotion-agent-remove"
                  onClick={(e) => { e.stopPropagation(); removeProfile(p.id); }}
                  aria-label="Remove agent"
                >
                  ×
                </button>
              )}
            </button>
          ))}
        </div>
        {showAdd ? (
          <div className="emotion-add-form">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Agent name"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <button type="button" onClick={handleAdd}>Add</button>
            <button type="button" onClick={() => { setShowAdd(false); setNewName(''); }}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="emotion-btn-secondary" onClick={() => setShowAdd(true)}>
            + New agent
          </button>
        )}
      </section>

      {activeProfile && (
        <section className="emotion-section">
          <h3>Edit personality</h3>
          <div className="emotion-prop-row">
            <label>Tone</label>
            <select
              value={activeProfile.tone || 'neutral'}
              onChange={(e) => updateProfile(activeProfile.id, { tone: e.target.value })}
            >
              <option value="neutral">neutral</option>
              <option value="warm">warm</option>
              <option value="playful">playful</option>
              <option value="professional">professional</option>
              <option value="encouraging">encouraging</option>
            </select>
          </div>
          <div className="emotion-prop-row">
            <label>Traits</label>
            <div className="emotion-traits">
              {(activeProfile.personality || []).map((t) => (
                <span key={t} className="emotion-tag">
                  {t}
                  <button type="button" className="emotion-tag-remove" onClick={() => updateProfile(activeProfile.id, { personality: (activeProfile.personality || []).filter((x) => x !== t) })}>×</button>
                </span>
              ))}
              <div className="emotion-trait-add">
                <input type="text" value={newTrait} onChange={(e) => setNewTrait(e.target.value)} placeholder="Add trait" onKeyDown={(e) => e.key === 'Enter' && (updateProfile(activeProfile.id, { personality: [...(activeProfile.personality || []), newTrait.trim()].filter(Boolean) }), setNewTrait(''))} />
                <button type="button" onClick={() => { updateProfile(activeProfile.id, { personality: [...(activeProfile.personality || []), newTrait.trim()].filter(Boolean) }); setNewTrait(''); }}>Add</button>
              </div>
            </div>
          </div>
          <div className="emotion-prop-row">
            <label>System prompt (optional)</label>
            <textarea
              value={activeProfile.systemPrompt || ''}
              onChange={(e) => updateProfile(activeProfile.id, { systemPrompt: e.target.value })}
              placeholder="Custom instructions for this agent..."
              rows={3}
              className="emotion-system-prompt"
            />
          </div>
        </section>
      )}

      <section className="emotion-section">
        <h3>Emotional context</h3>
        <div className="emotion-state">
          <span>Valence: {emotionalState.valence}</span>
          <span>Energy: {emotionalState.energy}</span>
          <span>Focus: {emotionalState.focus}</span>
        </div>
        <button type="button" className="emotion-btn-secondary" onClick={refreshEmotionalState}>Refresh</button>
        <p className="emotion-hint">Updated from chat. AI uses this to adapt tone.</p>
      </section>

      {onOpenAIChat && (
        <div className="emotion-actions">
          <button type="button" className="emotion-btn-primary" onClick={onOpenAIChat}>
            Open AI Chat with {activeProfile?.name || 'agent'}
          </button>
        </div>
      )}
    </div>
  );
}
