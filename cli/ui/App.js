import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { EVENTS } from '../core/eventBus.js';
import { INITIAL_STATE, NUM_SPINNER_FRAMES } from '../core/stateStore.js';
import { MessageList } from './MessageList.js';
import { StatusBar } from './StatusBar.js';
import { StepTimeline } from './StepTimeline.js';
import { PromptInput } from './PromptInput.js';

const SPINNER_INTERVAL_MS = 80;

export default function App({ eventBus, workspaceDir = null, teachMode: initialTeachMode = false }) {
  const [state, setState] = useState({ ...INITIAL_STATE, teachMode: initialTeachMode });
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const onUserMessage = ({ text }) => {
      setState((s) => ({
        ...s,
        messages: [...s.messages, { role: 'user', content: text }],
        streamingMessage: '',
        steps: [],
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

    const onTeachModeChanged = ({ teachMode }) => {
      setState((s) => ({ ...s, teachMode }));
    };

    const onSupportModeChanged = ({ active }) => {
      setState((s) => ({ ...s, supportMode: active }));
    };

    const onModeChanged = ({ activeMode }) => {
      setState((s) => ({ ...s, activeMode }));
    };

    const onAutoModeChanged = ({ autoMode }) => {
      setState((s) => ({ ...s, autoMode }));
    };

    const onAcceptEditsChanged = ({ acceptEdits }) => {
      setState((s) => ({ ...s, acceptEdits }));
    };

    const onConfirmationRequest = (payload) => {
      setState((s) => ({ ...s, pendingConfirmation: payload }));
    };

    const onConfirmationResponse = () => {
      setState((s) => ({ ...s, pendingConfirmation: null }));
    };

    eventBus.on(EVENTS.USER_MESSAGE, onUserMessage);
    eventBus.on(EVENTS.LLM_TOKEN, onLlmToken);
    eventBus.on(EVENTS.LLM_DONE, onLlmDone);
    eventBus.on(EVENTS.AGENT_STATUS, onAgentStatus);
    eventBus.on(EVENTS.AGENT_STEP, onAgentStep);
    eventBus.on(EVENTS.AGENT_ERROR, onAgentError);
    eventBus.on(EVENTS.SPINNER_TICK, onSpinnerTick);
    eventBus.on(EVENTS.TEACH_MODE_CHANGED, onTeachModeChanged);
    eventBus.on(EVENTS.SUPPORT_MODE_CHANGED, onSupportModeChanged);
    eventBus.on(EVENTS.MODE_CHANGED, onModeChanged);
    eventBus.on(EVENTS.AUTO_MODE_CHANGED, onAutoModeChanged);
    eventBus.on(EVENTS.ACCEPT_EDITS_CHANGED, onAcceptEditsChanged);
    eventBus.on(EVENTS.CONFIRMATION_REQUEST, onConfirmationRequest);
    eventBus.on(EVENTS.CONFIRMATION_RESPONSE, onConfirmationResponse);

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
      eventBus.off(EVENTS.TEACH_MODE_CHANGED, onTeachModeChanged);
      eventBus.off(EVENTS.SUPPORT_MODE_CHANGED, onSupportModeChanged);
      eventBus.off(EVENTS.MODE_CHANGED, onModeChanged);
      eventBus.off(EVENTS.AUTO_MODE_CHANGED, onAutoModeChanged);
      eventBus.off(EVENTS.ACCEPT_EDITS_CHANGED, onAcceptEditsChanged);
      eventBus.off(EVENTS.CONFIRMATION_REQUEST, onConfirmationRequest);
      eventBus.off(EVENTS.CONFIRMATION_RESPONSE, onConfirmationResponse);
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

  const handleConfirm = useCallback(
    (approved) => {
      eventBus.emit(EVENTS.CONFIRMATION_RESPONSE, { approved });
    },
    [eventBus]
  );

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
    React.createElement(StepTimeline, { steps: state.steps, activeMode: state.activeMode }),
    React.createElement(StatusBar, {
      agentStatus: state.agentStatus,
      statusMessage: state.statusMessage,
      spinnerFrame: state.spinnerFrame,
      teachMode: state.teachMode,
      supportMode: state.supportMode,
      activeMode: state.activeMode,
      autoMode: state.autoMode,
      acceptEdits: state.acceptEdits
    }),
    ...(state.pendingConfirmation ? [
      React.createElement(Box, {
        key: 'confirm',
        flexDirection: 'column',
        marginTop: 1,
        paddingX: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      },
        React.createElement(Text, { color: 'yellow', bold: true },
          `Apply ${state.pendingConfirmation.action} to ${state.pendingConfirmation.path}?`
        ),
        ...(state.pendingConfirmation.preview
          ? [React.createElement(Text, { key: 'preview', dimColor: true }, state.pendingConfirmation.preview)]
          : []),
        React.createElement(Text, { color: 'cyan' }, '(y) approve    (n) deny')
      )
    ] : []),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(PromptInput, {
        value: inputValue,
        onChange: setInputValue,
        onSubmit: handleSubmit,
        onClear: handleClear,
        placeholder: state.pendingConfirmation ? 'Awaiting confirmation — press y or n' : 'Type a message...',
        pendingConfirmation: state.pendingConfirmation,
        onConfirm: handleConfirm
      })
    )
  );
}
