import React, { useState, useRef, useEffect } from 'react';

const AIAssistant = ({ onHint: _onHint, onCodeComplete: _onCodeComplete }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages([{
      id: 1,
      type: 'assistant',
      content: "I'm your AI assistant. I can help with hints, code completion, and task suggestions!"
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let response;
      
      const aiService = window.aiService;
      if (aiService && input.toLowerCase().includes('hint')) {
        const task = input.replace(/hint|give me a hint/gi, '').trim();
        response = await aiService.getLLMHint(task);
      } else if (aiService && input.toLowerCase().includes('complete')) {
        const code = input.replace(/complete|finish/gi, '').trim();
        response = await aiService.completeCode(code, 'javascript');
      } else if (aiService) {
        response = await aiService.getLLMHint(input);
      } else {
        response = 'AI service not available. Start the Cyrex backend or check settings.';
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'assistant',
        content: response
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-assistant">
      <div className="assistant-header">
        <h3>AI Assistant</h3>
        <button onClick={() => setMessages([])}>Clear</button>
      </div>
      <div className="assistant-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`assistant-message ${msg.type}`}>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="assistant-message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="assistant-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for a hint, code completion, or help..."
          className="assistant-input"
        />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
};

export default AIAssistant;

