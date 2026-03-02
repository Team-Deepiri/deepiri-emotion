import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';

/**
 * Cursor-style context-aware AI chat: knows current file and selection.
 * Apply button replaces selection (or whole file) with AI suggestion.
 */
export default function AIChatPanel({
  currentFile = null,
  currentContent = '',
  selection = null,
  initialPrompt = null,
  onApplyEdit,
  onInsertAtCursor,
  onShowDiff
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const { success, error } = useNotifications();

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
      if (!api?.aiRequest) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'AI backend not configured. Set Cyrex URL in settings.' }]);
        return;
      }

      const payload = {
        prompt: text,
        context: contextSummary,
        file_content: (currentContent || '').slice(0, 8000),
        selection: selection || null
      };

      const res = await api.aiRequest({
        endpoint: '/agent/chat',
        data: payload
      });

      const reply = res?.data?.reply ?? res?.data?.content ?? res?.data?.message ?? (typeof res?.data === 'string' ? res.data : 'No response.');
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, raw: res?.data }]);
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
        <span>AI Chat</span>
        <span className="ai-chat-context" title={contextSummary}>{contextSummary}</span>
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
            {m.role === 'assistant' && m.content && currentFile && (
              <div className="ai-chat-message-actions">
                {onApplyEdit && (
                  <button type="button" className="ai-chat-apply" onClick={() => handleApply(m.content)}>
                    Apply to file
                  </button>
                )}
                {onShowDiff && currentContent !== undefined && (
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
