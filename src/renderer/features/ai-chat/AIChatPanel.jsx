import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import VoiceInput from '../multimodal/VoiceInput';
import { setEmotionalStateFromChat } from '../emotion/emotionService';
import { api } from '../../api';

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

const DEFAULT_SESSION = 'default';

export default function AIChatPanel({
  projectRoot = null,
  currentFile = null,
  currentContent = '',
  selection = null,
  initialPrompt = null,
  agentProfile = null,
  onApplyEdit,
  onInsertAtCursor,
  onShowDiff
}) {
  const sessionId = projectRoot || DEFAULT_SESSION;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiSettings, setAiSettings] = useState(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const { success, error } = useNotifications();

  useEffect(() => {
    api.getAiSettings().then((s) => s && setAiSettings(s)).catch(() => {});
  }, []);

  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (sessionIdRef.current !== sessionId) {
      sessionIdRef.current = sessionId;
      setHistoryLoaded(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (historyLoaded) return;
    setHistoryLoaded(true);
    api.getChatHistory(sessionId, 50).then((res) => {
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setMessages(res.data.map((row) => ({ role: row.role, content: row.content })));
      }
    }).catch(() => {});
  }, [sessionId, historyLoaded]);

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
    api.appendChatMessage({ role: 'user', content: text, sessionId }).catch(() => {});

    try {
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

      if (!res?.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${res?.error || 'Request failed'}` }]);
        error(res?.error || 'Request failed');
        return;
      }

      const reply = res?.data?.reply ?? res?.data?.content ?? '';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, raw: res?.data }]);
      api.appendChatMessage({ role: 'assistant', content: reply, sessionId }).catch(() => {});
      const sentiment = typeof reply === 'string' && (reply.length > 100 || /\b(great|thanks|helpful|perfect)\b/i.test(reply)) ? 0.3 : 0;
      setEmotionalStateFromChat({ sentiment, messageLength: reply?.length || 0 });
    } catch (err) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Request failed.';
      const display = msg.includes('not available') ? 'AI not configured. Open Settings → AI Provider and set an API key or local URL (e.g. Cyrex/Ollama).' : msg;
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${display}` }]);
      error(display);
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

  const handleClearHistory = () => {
    api.clearChatHistory(sessionId).catch(() => {});
    setMessages([]);
    success('Chat history cleared');
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
        <button type="button" className="ai-chat-clear-history" onClick={handleClearHistory} title="Clear saved chat history for this session">
          Clear history
        </button>
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
