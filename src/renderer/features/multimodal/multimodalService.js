/**
 * Multi-modal input: voice, future gestures.
 * Uses Web Speech API when available (Chrome, Edge, Electron).
 */

let recognition = null;

export function isVoiceSupported() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return !!SpeechRecognition;
}

export function startVoiceInput({ onResult, onError, onEnd }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.('Speech recognition not supported in this browser.');
    return () => {};
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (e) => {
    const last = e.results.length - 1;
    const transcript = e.results[last][0].transcript;
    const isFinal = e.results[last].isFinal;
    if (transcript) onResult?.(transcript, isFinal);
  };

  recognition.onerror = (e) => {
    if (e.error !== 'aborted') onError?.(e.error);
  };

  recognition.onend = () => onEnd?.();

  try {
    recognition.start();
  } catch (err) {
    onError?.(err.message);
  }

  return () => {
    try {
      recognition?.abort();
    } catch (_) {}
    recognition = null;
  };
}

export function stopVoiceInput() {
  try {
    recognition?.stop();
  } catch (_) {}
  recognition = null;
}
