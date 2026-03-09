import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import VoiceInput from '../multimodal/VoiceInput';
import { setEmotionalStateFromChat } from '../emotion/emotionService';

/**
 * Cursor-style context-aware AI chat: knows current file and selection.
 * Optional agentProfile (deepiri-emotion) for personality-aware replies.
 */
function modelLabel(aiSettings) {
  if (!aiSettings) return null;
  const p = aiSettings.provider || 'cyrex';
  if (p === 'openai') return aiSettings.openaiModel || 'gpt-4o-mini';
  if (p === 'anthropic') return aiSettings.anthropicModel || 'claude-3-5-sonnet';
  if (p === 'google') return aiSettings.googleModel || 'gemini-1.5-flash';
  if (p === 'local') return aiSettings.localOllamaModel || aiSettings.localCyrexUrl || 'Local';
  return p;
}

export default function AIChatPanel({
  currentFile = null,
  currentContent = '',
  selection = null,
  initialPrompt = null,
  agentProfile = null,
  onApplyEdit,
  onInsertAtCursor,
  onShowDiff
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiSettings, setAiSettings] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const { success, error } = useNotifications();

  useEffect(() => {
    if (window.electronAPI?.getAiSettings) {
      window.electronAPI.getAiSettings().then((s) => s && setAiSettings(s));
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      inputRef.current?.focus();
    }
  }, [initialPrompt]);

  const contextSummary = currentFile
    ? selection
      ? `File: ${currentFile.name}, selected text (${selection.length} chars)`
      : `File: ${currentFile.name}, full content (${(currentContent || '').length} chars)`
    : 'No file open';

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    try {
      const api = window.electronAPI;
      const useUnified = api?.chatCompletion;

      if (useUnified) {
        const messagesForApi = [...messages, { role: 'user', content: text }];
        const res = await api.chatCompletion({
          messages: messagesForApi,
          context: contextSummary,
          fileContent: (currentContent || '').slice(0, 12000),
          agentProfile: agentProfile ? {
            id: agentProfile.id,
            name: agentProfile.name,
            tone: agentProfile.tone,
            personality: agentProfile.personality,
            systemPrompt: agentProfile.systemPrompt
          } : null
        });

        if (!res.success) {
          setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${res.error || 'Request failed'}` }]);
          error(res.error || 'Request failed');
          return;
        }

        const reply = res?.data?.reply ?? res?.data?.content ?? '';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply, raw: res?.data }]);
        const sentiment = typeof reply === 'string' && (reply.length > 100 || /\b(great|thanks|helpful|perfect)\b/i.test(reply)) ? 0.3 : 0;
        setEmotionalStateFromChat({ sentiment, messageLength: reply?.length || 0 });
        return;
      }

      if (!api?.aiRequest) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'AI not configured. Open API & Model (activity bar) or Settings → AI Provider and set an API key or local URL (e.g. Cyrex/Ollama).' }]);
        return;
      }

      const payload = {
        prompt: text,
        context: contextSummary,
        file_content: (currentContent || '').slice(0, 8000),
        selection: selection || null
      };
      if (agentProfile) {
        payload.agent_id = agentProfile.id;
        payload.agent_name = agentProfile.name;
        payload.agent_tone = agentProfile.tone;
        payload.agent_personality = agentProfile.personality;
        if (agentProfile.systemPrompt) payload.agent_system_prompt = agentProfile.systemPrompt;
      }

      const res = await api.aiRequest({
        endpoint: '/agent/chat',
        data: payload
      });

      const reply = res?.data?.reply ?? res?.data?.content ?? res?.data?.message ?? (typeof res?.data === 'string' ? res.data : 'No response.');
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, raw: res?.data }]);
      const sentiment = typeof reply === 'string' && (reply.length > 100 || /\b(great|thanks|helpful|perfect)\b/i.test(reply)) ? 0.3 : 0;
      setEmotionalStateFromChat({ sentiment, messageLength: reply?.length || 0 });
    } catch (err) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Request failed.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }]);
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (content) => {
    if (onApplyEdit && content) {
      onApplyEdit(content);
      success('Applied to editor');
    }
  };

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <span>{agentProfile ? `Chat with ${agentProfile.name}` : 'AI Chat'}</span>
        <span className="ai-chat-context" title={contextSummary}>{contextSummary}</span>
        {aiSettings && (
          <span className="ai-chat-model" title="Current model (change in Settings → AI Provider)">
            Model: {modelLabel(aiSettings)}
          </span>
        )}
      </div>
      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-placeholder">
            Ask about the current file or request edits. Include &quot;apply&quot; or use the Apply button to insert the reply.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-chat-message ${m.role}`}>
            <div className="ai-chat-message-content">{m.content}</div>
            {m.role === 'assistant' && m.content && (
              <div className="ai-chat-message-actions">
                <button type="button" className="ai-chat-copy" onClick={() => { navigator.clipboard?.writeText(m.content); success('Copied to clipboard'); }} title="Copy reply">
                  Copy
                </button>
                {currentFile && onApplyEdit && (
                  <button type="button" className="ai-chat-apply" onClick={() => handleApply(m.content)}>
                    Apply to file
                  </button>
                )}
                {currentFile && onShowDiff && currentContent !== undefined && (
                  <button type="button" className="ai-chat-diff" onClick={() => onShowDiff(currentContent, m.content)}>
                    Show diff
                  </button>
                )}
                {onInsertAtCursor && (
                  <button type="button" className="ai-chat-insert" onClick={() => onInsertAtCursor(m.content)}>
                    Insert at cursor
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="ai-chat-message assistant">Thinking…</div>}
        <div ref={endRef} />
      </div>
      <form className="ai-chat-input-row" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
        <VoiceInput
          onTranscript={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
          disabled={loading}
        />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask or request an edit..."
          disabled={loading}
          className="ai-chat-input"
        />
        <button type="submit" disabled={loading} className="ai-chat-send">Send</button>
      </form>
    </div>
  );
}
