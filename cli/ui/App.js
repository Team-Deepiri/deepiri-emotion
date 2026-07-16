import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { EVENTS } from '../core/eventBus.js';
import { INITIAL_STATE, NUM_SPINNER_FRAMES } from '../core/stateStore.js';
import { MessageList } from './MessageList.js';
import { StatusBar } from './StatusBar.js';
import { PromptInput } from './PromptInput.js';
import { Welcome } from './Welcome.js';

const SPINNER_INTERVAL_MS = 80;

export default function App({
  eventBus,
  workspaceDir = null,
  teachMode: initialTeachMode = false,
  initialProvider = null,
  initialModel = null
}) {
  const [state, setState] = useState({
    ...INITIAL_STATE,
    teachMode: initialTeachMode,
    activeProvider: initialProvider,
    activeModel: initialModel
  });
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const onUserMessage = ({ text }) => {
      setState((s) => ({
        ...s,
        messages: [...s.messages, { role: 'user', content: text }],
        streamingMessage: '',
        steps: [],
        error: null,
        errorHint: null,
        activeTool: null
      }));
    };

    const onLlmToken = ({ token }) => {
      setState((s) => ({
        ...s,
        streamingMessage: s.streamingMessage + token
      }));
    };

    const onLlmDone = ({ silent } = {}) => {
      // AgentWorker's internal reasoning loop makes silent, intermediate
      // streamLLM calls that also emit LLM_DONE — those aren't the real end
      // of the turn, so skip finalizing the message/step trace for them.
      if (silent) return;
      setState((s) => {
        const full = s.streamingMessage;
        return {
          ...s,
          messages: full
            ? [...s.messages, { role: 'assistant', content: full, steps: s.steps }]
            : s.messages,
          streamingMessage: '',
          steps: [],
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

    const onAgentError = ({ message, hint }) => {
      setState((s) => ({ ...s, error: message || 'Something went wrong', errorHint: hint || null }));
    };

    const onProviderResolved = ({ provider, model }) => {
      setState((s) => ({ ...s, activeProvider: provider, activeModel: model }));
    };

    const onAgentCancelled = () => {
      setState((s) => ({
        ...s,
        messages: [...s.messages, { role: 'system', content: 'Cancelled.' }],
        streamingMessage: '',
        agentStatus: 'idle',
        statusMessage: '',
        activeTool: null,
        steps: s.steps.map((step) =>
          step.status === 'running' ? { ...step, status: 'cancelled' } : step
        ),
      }));
    };

    const onToolStart = ({ tool, args, label }) => {
      setState((s) => ({ ...s, activeTool: { tool, args, label: label || `${tool}...` } }));
    };

    const onToolEnd = () => {
      setState((s) => ({ ...s, activeTool: null }));
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
    eventBus.on(EVENTS.PROVIDER_RESOLVED, onProviderResolved);
    eventBus.on(EVENTS.AGENT_CANCELLED, onAgentCancelled);
    eventBus.on(EVENTS.TOOL_START, onToolStart);
    eventBus.on(EVENTS.TOOL_END, onToolEnd);
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
      eventBus.off(EVENTS.PROVIDER_RESOLVED, onProviderResolved);
      eventBus.off(EVENTS.AGENT_CANCELLED, onAgentCancelled);
      eventBus.off(EVENTS.TOOL_START, onToolStart);
      eventBus.off(EVENTS.TOOL_END, onToolEnd);
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

  const handleCancel = useCallback(() => {
    eventBus.emit(EVENTS.CANCEL_REQUESTED);
  }, [eventBus]);

  const isEmptyConversation = state.messages.length === 0 && !state.streamingMessage;

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    isEmptyConversation
      ? React.createElement(Welcome, {
          workspaceDir,
          activeProvider: state.activeProvider,
          activeModel: state.activeModel
        })
      : React.createElement(
          Box,
          { flexDirection: 'column' },
          React.createElement(
            Text,
            { bold: true, color: 'cyan' },
            'Deepiri Emotion CLI',
            state.activeProvider ? `  |  ${state.activeProvider}${state.activeModel ? ` / ${state.activeModel}` : ''}` : ''
          ),
          React.createElement(Text, { dimColor: true },
            workspaceDir ? `Workspace: ${workspaceDir}` : 'Shift+Enter newline, Enter send. Ctrl+C exit, Ctrl+L clear, Esc cancel.'
          )
        ),
    ...(state.error ? [
      React.createElement(Box, {
        key: 'err',
        flexDirection: 'column',
        marginY: 1,
        paddingX: 1,
        borderStyle: 'round',
        borderColor: 'red'
      },
        React.createElement(Text, { color: 'red', bold: true }, 'Error: ', state.error),
        ...(state.errorHint
          ? [React.createElement(Text, { key: 'hint', color: 'yellow' }, '→ ', state.errorHint)]
          : [])
      )
    ] : []),
    React.createElement(MessageList, {
      messages: state.messages,
      streamingMessage: state.streamingMessage,
      liveSteps: state.steps,
      activeMode: state.activeMode
    }),
    ...(state.activeTool
      ? [React.createElement(Text, { key: 'activeTool', dimColor: true }, state.activeTool.label)]
      : []),
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
        ...(state.pendingConfirmation.diffLines?.length
          ? state.pendingConfirmation.diffLines.map((line, i) =>
              React.createElement(
                Text,
                {
                  key: `diff-${i}`,
                  color: line.type === 'remove' ? 'red' : line.type === 'add' ? 'green' : undefined,
                  dimColor: line.type === 'meta',
                },
                line.type === 'remove' ? `-${line.text}` : line.type === 'add' ? `+${line.text}` : line.text
              )
            )
          : state.pendingConfirmation.preview
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
        onConfirm: handleConfirm,
        agentStatus: state.agentStatus,
        onCancel: handleCancel
      })
    )
  );
}
