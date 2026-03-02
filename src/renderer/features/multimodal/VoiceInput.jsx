/**
 * Voice input — mic button to dictate into a callback (e.g. AI chat or editor).
 */

import React, { useState, useCallback } from 'react';
import { isVoiceSupported, startVoiceInput, stopVoiceInput } from './multimodalService.js';
import './multimodal.css';

export default function VoiceInput({ onTranscript, placeholder = 'Say something...', disabled }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const stopRef = React.useRef(null);

  const start = useCallback(() => {
    if (!isVoiceSupported()) {
      window.toast?.('Voice input not supported. Use Chrome or Edge.');
      return;
    }
    setInterim('');
    stopRef.current = startVoiceInput({
      onResult: (text, isFinal) => {
        if (isFinal) {
          onTranscript?.(text);
          setInterim('');
          if (window.electronAPI?.fabricSend) {
            window.electronAPI.fabricSend('voice/transcript', { text, timestamp: Date.now() });
          }
        } else {
          setInterim(text);
        }
      },
      onError: (msg) => {
        setListening(false);
        window.toast?.(msg || 'Voice error');
      },
      onEnd: () => setListening(false)
    });
    setListening(true);
  }, [onTranscript]);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopVoiceInput();
    setListening(false);
    setInterim('');
  }, []);

  if (!isVoiceSupported()) return null;

  return (
    <div className="voice-input-wrap">
      <button
        type="button"
        className={`voice-mic-btn ${listening ? 'listening' : ''}`}
        onClick={listening ? stop : start}
        disabled={disabled}
        title={listening ? 'Stop listening' : 'Dictate (voice input)'}
        aria-label={listening ? 'Stop' : 'Start voice input'}
      >
        {listening ? (
          <span className="voice-mic-icon pulse">🎤</span>
        ) : (
          <span className="voice-mic-icon">🎤</span>
        )}
      </button>
      {interim && <span className="voice-interim">{interim}</span>}
    </div>
  );
}
