import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { EVENTS } from '../core/eventBus.js';
import { INITIAL_STATE, NUM_SPINNER_FRAMES } from '../core/stateStore.js';
import { MessageList } from './MessageList.jsx';
import { StatusBar } from './StatusBar.jsx';
import { StepTimeline } from './StepTimeline.jsx';
import { PromptInput } from './PromptInput.jsx';

const SPINNER_INTERVAL_MS = 80;

export default function App({ eventBus }) {
  const [state, setState] = useState({ ...INITIAL_STATE });
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const onUserMessage = ({ text }) => {
      setState((s) => ({
        ...s,
        messages: [...s.messages, { role: 'user', content: text }],
        streamingMessage: '',
        error: null
      }));
    };

    const onLlmToken = ({ token }) => {
      setState((s) => ({
        ...s,
        streamingMessage: s.streamingMessage + token
      }));
    };

    const onLlmDone = () => {
      setState((s) => {
        const full = s.streamingMessage;
        return {
          ...s,
          messages: full
            ? [...s.messages, { role: 'assistant', content: full }]
            : s.messages,
          streamingMessage: '',
          agentStatus: 'idle',
          statusMessage: ''
        };
      });
    };

    const onAgentStatus = ({ status, message }) => {
      setState((s) => ({ ...s, agentStatus: status, statusMessage: message || '' }));
    };

    const onAgentStep = (step) => {
      setState((s) => ({
        ...s,
        steps: [...s.steps, { ...step, id: step.id || `step-${Date.now()}-${s.steps.length}` }]
      }));
    };

    const onSpinnerTick = () => {
      setState((s) => ({
        ...s,
        spinnerFrame: (s.spinnerFrame + 1) % NUM_SPINNER_FRAMES
      }));
    };

    eventBus.on(EVENTS.USER_MESSAGE, onUserMessage);
    eventBus.on(EVENTS.LLM_TOKEN, onLlmToken);
    eventBus.on(EVENTS.LLM_DONE, onLlmDone);
    eventBus.on(EVENTS.AGENT_STATUS, onAgentStatus);
    eventBus.on(EVENTS.AGENT_STEP, onAgentStep);
    eventBus.on(EVENTS.SPINNER_TICK, onSpinnerTick);

    const spinnerTimer = setInterval(() => {
      eventBus.emit(EVENTS.SPINNER_TICK);
    }, SPINNER_INTERVAL_MS);

    return () => {
      eventBus.off(EVENTS.USER_MESSAGE, onUserMessage);
      eventBus.off(EVENTS.LLM_TOKEN, onLlmToken);
      eventBus.off(EVENTS.LLM_DONE, onLlmDone);
      eventBus.off(EVENTS.AGENT_STATUS, onAgentStatus);
      eventBus.off(EVENTS.AGENT_STEP, onAgentStep);
      eventBus.off(EVENTS.SPINNER_TICK, onSpinnerTick);
      clearInterval(spinnerTimer);
    };
  }, [eventBus]);

  const handleSubmit = useCallback(
    (text) => {
      const t = (text || inputValue || '').trim();
      if (!t) return;
      setInputValue('');
      eventBus.emit(EVENTS.USER_MESSAGE, { text: t });
    },
    [inputValue, eventBus]
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Deepiri Emotion CLI
      </Text>
      <Text dimColor>Type a message and press Enter. Ctrl+C to exit.</Text>

      <MessageList messages={state.messages} streamingMessage={state.streamingMessage} />
      <StepTimeline steps={state.steps} />
      <StatusBar
        agentStatus={state.agentStatus}
        statusMessage={state.statusMessage}
        spinnerFrame={state.spinnerFrame}
      />
      <Box marginTop={1}>
        <PromptInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder="Type a message..."
        />
      </Box>
    </Box>
  );
}
