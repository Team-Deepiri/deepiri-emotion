import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { EVENTS } from '../core/eventBus.js';
import { INITIAL_STATE, NUM_SPINNER_FRAMES } from '../core/stateStore.js';
import { MessageList } from './MessageList.js';
import { StatusBar } from './StatusBar.js';
import { StepTimeline } from './StepTimeline.js';
import { PromptInput } from './PromptInput.js';

const SPINNER_INTERVAL_MS = 80;

export default function App({ eventBus, workspaceDir = null }) {
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

    const onAgentError = ({ message }) => {
      setState((s) => ({ ...s, error: message || 'Something went wrong' }));
    };

    eventBus.on(EVENTS.USER_MESSAGE, onUserMessage);
    eventBus.on(EVENTS.LLM_TOKEN, onLlmToken);
    eventBus.on(EVENTS.LLM_DONE, onLlmDone);
    eventBus.on(EVENTS.AGENT_STATUS, onAgentStatus);
    eventBus.on(EVENTS.AGENT_STEP, onAgentStep);
    eventBus.on(EVENTS.AGENT_ERROR, onAgentError);
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
      eventBus.off(EVENTS.AGENT_ERROR, onAgentError);
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

  const handleClear = useCallback(() => {
    setState({ ...INITIAL_STATE });
    setInputValue('');
  }, []);

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true, color: 'cyan' }, 'Deepiri Emotion CLI'),
    React.createElement(Text, { dimColor: true },
      workspaceDir ? `Workspace: ${workspaceDir}` : 'Shift+Enter newline, Enter send. Ctrl+C exit, Ctrl+L clear.'
    ),
    ...(state.error ? [React.createElement(Text, { key: 'err', color: 'red' }, 'Error: ', state.error)] : []),
    React.createElement(MessageList, {
      messages: state.messages,
      streamingMessage: state.streamingMessage
    }),
    React.createElement(StepTimeline, { steps: state.steps }),
    React.createElement(StatusBar, {
      agentStatus: state.agentStatus,
      statusMessage: state.statusMessage,
      spinnerFrame: state.spinnerFrame
    }),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(PromptInput, {
        value: inputValue,
        onChange: setInputValue,
        onSubmit: handleSubmit,
        onClear: handleClear,
        placeholder: 'Type a message...'
      })
    )
  );
}
