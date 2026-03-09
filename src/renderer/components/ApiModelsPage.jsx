import React, { useState, useEffect, useCallback } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { DEFAULT_AI_SETTINGS, DEFAULT_USAGE_LIMITS } from '../config';
import { usageClient } from '../services/usageClient';

const PROVIDERS = [
  { value: 'cyrex', label: 'Cyrex / Runtime (diri-cyrex)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'local', label: 'Local (Ollama or Cyrex runtime)' }
];

const ApiModelsPage = () => {
  const { success } = useNotifications();
  const [aiSettings, setAiSettings] = useState(DEFAULT_AI_SETTINGS);
  const [usage, setUsage] = useState({ today: { requests: 0, inputTokens: 0, outputTokens: 0 }, daily: {} });
  const [limits, setLimits] = useState(DEFAULT_USAGE_LIMITS);

  const loadUsage = useCallback(async () => {
    const u = await usageClient.getUsage();
    if (u) setUsage(u);
  }, []);
  const loadLimits = useCallback(async () => {
    const l = await usageClient.getLimits();
    if (l) setLimits((prev) => ({ ...prev, ...l }));
  }, []);

  useEffect(() => {
    if (window.electronAPI?.getAiSettings) {
      window.electronAPI.getAiSettings().then((s) => {
        if (s) setAiSettings((prev) => ({ ...prev, ...s }));
      });
    }
  }, []);
  useEffect(() => {
    loadUsage();
    loadLimits();
  }, [loadUsage, loadLimits]);

  const save = async () => {
    if (window.electronAPI?.setAiSettings) {
      await window.electronAPI.setAiSettings(aiSettings);
    }
    success('API & model saved.');
  };

  const saveLimits = async () => {
    await usageClient.setLimits(limits);
    success('Limits saved.');
  };

  const resetUsage = async () => {
    if (!window.confirm('Reset all usage data? This cannot be undone.')) return;
    if (window.electronAPI?.resetUsage) {
      await window.electronAPI.resetUsage();
    }
    loadUsage();
    success('Usage reset.');
  };

  const handleChange = (key, value) => {
    setAiSettings((prev) => ({ ...prev, [key]: value }));
  };
  const handleLimitChange = (key, value) => {
    const n = value === '' ? 0 : parseInt(value, 10);
    setLimits((prev) => ({ ...prev, [key]: isNaN(n) ? 0 : n }));
  };

  const today = usage.today || {};
  const totalTokens = (today.inputTokens || 0) + (today.outputTokens || 0);
  const dailyEntries = usage.daily && typeof usage.daily === 'object'
    ? Object.entries(usage.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7)
    : [];

  return (
    <div className="api-models-page settings-panel">
      <div className="settings-header">
        <h2>API & Model</h2>
        <button type="button" onClick={save} className="btn-primary">Save</button>
      </div>
      <p className="settings-hint" style={{ marginBottom: '1rem' }}>
        Choose the AI provider and model for chat and completions. Use your own API keys or a local runtime (diri-cyrex / Ollama).
      </p>
      <div className="settings-content">
        <div className="settings-section">
          <h3>API usage</h3>
          <p className="settings-hint">Requests and token usage for the current app session. Reset to clear history.</p>
          <div className="usage-cards">
            <div className="usage-card">
              <span className="usage-label">Today — Requests</span>
              <span className="usage-value">{today.requests ?? 0}</span>
            </div>
            <div className="usage-card">
              <span className="usage-label">Today — Input tokens</span>
              <span className="usage-value">{today.inputTokens ?? 0}</span>
            </div>
            <div className="usage-card">
              <span className="usage-label">Today — Output tokens</span>
              <span className="usage-value">{today.outputTokens ?? 0}</span>
            </div>
            <div className="usage-card">
              <span className="usage-label">Today — Total tokens</span>
              <span className="usage-value">{totalTokens}</span>
            </div>
          </div>
          {dailyEntries.length > 0 && (
            <div className="usage-history">
              <span className="usage-label">Recent days</span>
              <ul className="usage-days">
                {dailyEntries.map(([day, d]) => (
                  <li key={day}>
                    <strong>{day}</strong>: {d.requests ?? 0} requests, {(d.inputTokens ?? 0) + (d.outputTokens ?? 0)} tokens
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="setting-item" style={{ marginTop: '0.5rem' }}>
            <button type="button" onClick={loadUsage} className="btn-secondary">Refresh usage</button>
            <button type="button" onClick={resetUsage} className="btn-secondary" style={{ marginLeft: '0.5rem' }}>Reset usage</button>
          </div>
        </div>

        <div className="settings-section">
          <h3>Rate limiting &amp; limits</h3>
          <p className="settings-hint">Set 0 to disable. Limits apply before each AI request.</p>
          <div className="setting-item">
            <label>Max requests per minute (rate limit)</label>
            <input
              type="number"
              min="0"
              value={limits.rateLimitRequestsPerMinute ?? ''}
              onChange={(e) => handleLimitChange('rateLimitRequestsPerMinute', e.target.value)}
              placeholder="0 = off"
            />
          </div>
          <div className="setting-item">
            <label>Daily request limit</label>
            <input
              type="number"
              min="0"
              value={limits.dailyLimitRequests ?? ''}
              onChange={(e) => handleLimitChange('dailyLimitRequests', e.target.value)}
              placeholder="0 = off"
            />
          </div>
          <div className="setting-item">
            <label>Daily token limit</label>
            <input
              type="number"
              min="0"
              value={limits.dailyLimitTokens ?? ''}
              onChange={(e) => handleLimitChange('dailyLimitTokens', e.target.value)}
              placeholder="0 = off"
            />
          </div>
          <button type="button" onClick={saveLimits} className="btn-primary">Save limits</button>
        </div>

        <div className="settings-section">
          <h3>Provider</h3>
          <div className="setting-item">
            <label>API / Provider</label>
            <select
              value={aiSettings.provider}
              onChange={(e) => handleChange('provider', e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {(aiSettings.provider === 'openai' || aiSettings.provider === 'anthropic' || aiSettings.provider === 'google') && (
            <>
              {aiSettings.provider === 'openai' && (
                <>
                  <div className="setting-item">
                    <label>OpenAI API Key</label>
                    <input
                      type="password"
                      value={aiSettings.openaiApiKey}
                      onChange={(e) => handleChange('openaiApiKey', e.target.value)}
                      placeholder="sk-..."
                      autoComplete="off"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Model</label>
                    <input
                      type="text"
                      value={aiSettings.openaiModel}
                      onChange={(e) => handleChange('openaiModel', e.target.value)}
                      placeholder="gpt-4o-mini"
                    />
                  </div>
                </>
              )}
              {aiSettings.provider === 'anthropic' && (
                <>
                  <div className="setting-item">
                    <label>Anthropic API Key (Claude)</label>
                    <input
                      type="password"
                      value={aiSettings.anthropicApiKey}
                      onChange={(e) => handleChange('anthropicApiKey', e.target.value)}
                      placeholder="sk-ant-..."
                      autoComplete="off"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Model</label>
                    <input
                      type="text"
                      value={aiSettings.anthropicModel}
                      onChange={(e) => handleChange('anthropicModel', e.target.value)}
                      placeholder="claude-3-5-sonnet-20241022"
                    />
                  </div>
                </>
              )}
              {aiSettings.provider === 'google' && (
                <>
                  <div className="setting-item">
                    <label>Google API Key (Gemini)</label>
                    <input
                      type="password"
                      value={aiSettings.googleApiKey}
                      onChange={(e) => handleChange('googleApiKey', e.target.value)}
                      placeholder="AIza..."
                      autoComplete="off"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Model</label>
                    <input
                      type="text"
                      value={aiSettings.googleModel}
                      onChange={(e) => handleChange('googleModel', e.target.value)}
                      placeholder="gemini-1.5-flash"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {aiSettings.provider === 'local' && (
            <>
              <div className="setting-item">
                <label>Local runtime</label>
                <select
                  value={aiSettings.localType}
                  onChange={(e) => handleChange('localType', e.target.value)}
                >
                  <option value="cyrex">Cyrex / Runtime Services (diri-cyrex)</option>
                  <option value="ollama">Ollama (deepiri-ollama or Ollama)</option>
                </select>
              </div>
              {aiSettings.localType === 'cyrex' && (
                <div className="setting-item">
                  <label>Cyrex / Runtime URL</label>
                  <input
                    type="text"
                    value={aiSettings.localCyrexUrl}
                    onChange={(e) => handleChange('localCyrexUrl', e.target.value)}
                    placeholder="http://localhost:8000"
                  />
                </div>
              )}
              {aiSettings.localType === 'ollama' && (
                <>
                  <div className="setting-item">
                    <label>Ollama URL</label>
                    <input
                      type="text"
                      value={aiSettings.localOllamaUrl}
                      onChange={(e) => handleChange('localOllamaUrl', e.target.value)}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Model</label>
                    <input
                      type="text"
                      value={aiSettings.localOllamaModel}
                      onChange={(e) => handleChange('localOllamaModel', e.target.value)}
                      placeholder="llama3.2"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {aiSettings.provider === 'cyrex' && (
            <div className="setting-item">
              <label>Cyrex / Runtime URL (fallback)</label>
              <input
                type="text"
                value={aiSettings.localCyrexUrl}
                onChange={(e) => handleChange('localCyrexUrl', e.target.value)}
                placeholder="http://localhost:8000"
              />
              <span className="settings-hint-inline">Uses env AI_SERVICE_URL if not set. For your own API keys, pick OpenAI / Anthropic / Google above.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiModelsPage;
