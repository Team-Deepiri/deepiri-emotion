import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text } from 'ink';
import { EVENTS } from '../core/eventBus.js';
import { INITIAL_STATE, NUM_SPINNER_FRAMES } from '../core/stateStore.js';
import { MessageList } from './MessageList.js';
import { StatusBar } from './StatusBar.js';
import { PromptInput } from './PromptInput.js';
import { SelectMenu } from './SelectMenu.js';
import { grabClipboardImage, resolveImagePath } from '../agent/attachments.js';
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
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const turnIdRef = useRef(null);

  const handleClear = useCallback(() => {
    setState({ ...INITIAL_STATE });
    setInputValue('');
  }, []);

  useEffect(() => {
    const onUserMessage = ({ text }) => {
      // /clear resets via the CLEAR event (see onClear below) — it shouldn't
      // also show up as a chat turn in the transcript it's about to wipe.
      if (text?.trim() === '/clear') return;
      setState((s) => ({
        ...s,
        messages: [...s.messages, { role: 'user', content: text, turnId: turnIdRef.current }],
        streamingMessage: '',
        steps: [],
        plan: [],
        error: null,
        errorHint: null,
        activeTool: null,
        queuedMessage: null
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
            ? [...s.messages, { role: 'assistant', content: full, steps: s.steps, plan: s.plan, turnId: turnIdRef.current }]
            : s.messages,
          streamingMessage: '',
          steps: [],
          plan: [],
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

    const onPlanUpdate = ({ items }) => {
      setState((s) => ({ ...s, plan: items || [] }));
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

    const onModeChanged = ({ activeModes }) => {
      setState((s) => ({ ...s, activeModes }));
    };

    const onAutoModeChanged = ({ autoMode }) => {
      setState((s) => ({ ...s, autoMode }));
    };

    const onAcceptEditsChanged = ({ acceptEdits }) => {
      setState((s) => ({ ...s, acceptEdits }));
    };

    const onGuardModeChanged = ({ guardMode }) => {
      setState((s) => ({ ...s, guardMode }));
    };

    const onProviderSelected = ({ provider }) => {
      setState((s) => ({ ...s, activeProvider: provider }));
    };

    const onConfirmationRequest = (payload) => {
      setState((s) => ({ ...s, pendingConfirmation: payload }));
    };

    const onConfirmationResponse = () => {
      setState((s) => ({ ...s, pendingConfirmation: null }));
    };

    const onSelectRequest = (payload) => {
      const items = payload?.items || [];
      let index = 0;
      while (items[index]?.disabled && index < items.length - 1) index += 1;
      setState((s) => ({
        ...s,
        pendingSelect: { ...payload, items, index },
        pendingTextInput: null,
      }));
    };

    const onSelectResponse = () => {
      setState((s) => ({ ...s, pendingSelect: null }));
    };

    const onTextInputRequest = (payload) => {
      setState((s) => ({
        ...s,
        pendingTextInput: payload || {},
        pendingSelect: null,
      }));
    };

    const onTextInputResponse = () => {
      setState((s) => ({ ...s, pendingTextInput: null }));
    };

    const onAllowedToolsChanged = ({ count }) => {
      setState((s) => ({ ...s, allowedCount: count ?? 0 }));
    };

    const onClear = () => {
      handleClear();
    };

    const onTokenUsage = ({ used, limit }) => {
      setState((s) => ({ ...s, tokenUsage: { used: used ?? 0, limit: limit ?? s.tokenUsage.limit } }));
    };

    const onTurnStarted = ({ turnId }) => {
      turnIdRef.current = turnId;
    };

    const onRewind = ({ turnId }) => {
      setState((s) => ({
        ...s,
        messages: s.messages.filter((m) => m.turnId == null || m.turnId < turnId),
        streamingMessage: '',
        steps: [],
        plan: []
      }));
    };

    eventBus.on(EVENTS.USER_MESSAGE, onUserMessage);
    eventBus.on(EVENTS.LLM_TOKEN, onLlmToken);
    eventBus.on(EVENTS.LLM_DONE, onLlmDone);
    eventBus.on(EVENTS.AGENT_STATUS, onAgentStatus);
    eventBus.on(EVENTS.AGENT_STEP, onAgentStep);
    eventBus.on(EVENTS.AGENT_ERROR, onAgentError);
    eventBus.on(EVENTS.PROVIDER_RESOLVED, onProviderResolved);
    eventBus.on(EVENTS.PLAN_UPDATE, onPlanUpdate);
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
    eventBus.on(EVENTS.SELECT_REQUEST, onSelectRequest);
    eventBus.on(EVENTS.SELECT_RESPONSE, onSelectResponse);
    eventBus.on(EVENTS.TEXT_INPUT_REQUEST, onTextInputRequest);
    eventBus.on(EVENTS.TEXT_INPUT_RESPONSE, onTextInputResponse);
    eventBus.on(EVENTS.ALLOWED_TOOLS_CHANGED, onAllowedToolsChanged);
    eventBus.on(EVENTS.CLEAR, onClear);
    eventBus.on(EVENTS.GUARD_MODE_CHANGED, onGuardModeChanged);
    eventBus.on(EVENTS.PROVIDER_SELECTED, onProviderSelected);
    eventBus.on(EVENTS.TOKEN_USAGE_CHANGED, onTokenUsage);
    eventBus.on(EVENTS.TURN_STARTED, onTurnStarted);
    eventBus.on(EVENTS.REWIND, onRewind);

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
      eventBus.off(EVENTS.PLAN_UPDATE, onPlanUpdate);
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
      eventBus.off(EVENTS.SELECT_REQUEST, onSelectRequest);
      eventBus.off(EVENTS.SELECT_RESPONSE, onSelectResponse);
      eventBus.off(EVENTS.TEXT_INPUT_REQUEST, onTextInputRequest);
      eventBus.off(EVENTS.TEXT_INPUT_RESPONSE, onTextInputResponse);
      eventBus.off(EVENTS.ALLOWED_TOOLS_CHANGED, onAllowedToolsChanged);
      eventBus.off(EVENTS.CLEAR, onClear);
      eventBus.off(EVENTS.GUARD_MODE_CHANGED, onGuardModeChanged);
      eventBus.off(EVENTS.PROVIDER_SELECTED, onProviderSelected);
      eventBus.off(EVENTS.TOKEN_USAGE_CHANGED, onTokenUsage);
      eventBus.off(EVENTS.TURN_STARTED, onTurnStarted);
      eventBus.off(EVENTS.REWIND, onRewind);
      clearInterval(spinnerTimer);
    };
  }, [eventBus, handleClear]);

  const handlePaste = useCallback(() => {
    grabClipboardImage()
      .then((attachment) => {
        if (attachment) {
          setPendingAttachments((prev) => [...prev, attachment]);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(
    (text) => {
      const t = (text || inputValue || '').trim();
      if (!t) return;
      setInputValue('');

      // Merge clipboard attachments with any image path detected in the text.
      const allAttachments = [...pendingAttachments];
      let finalText = t;
      const pathResult = resolveImagePath(t);
      if (pathResult) {
        allAttachments.push(pathResult.attachment);
        finalText = pathResult.text || t;
      }
      setPendingAttachments([]);

      if (state.agentStatus !== 'idle') {
        // Agent is mid-turn — queue instead of firing a second concurrent
        // AgentWorker. Single-slot: a later submit overwrites an earlier one.
        setState((s) => ({ ...s, queuedMessage: finalText }));
        eventBus.emit(EVENTS.MESSAGE_QUEUED, { text: finalText });
        return;
      }
      eventBus.emit(EVENTS.USER_MESSAGE, { text: finalText, attachments: allAttachments });
    },
    [inputValue, pendingAttachments, eventBus, state.agentStatus]
  );

  const handleConfirm = useCallback(
    (choice) => {
      eventBus.emit(EVENTS.CONFIRMATION_RESPONSE, { choice });
    },
    [eventBus]
  );

  const handleSelectAction = useCallback(
    (action, payload) => {
      if (action === 'move') {
        setState((s) =>
          s.pendingSelect ? { ...s, pendingSelect: { ...s.pendingSelect, index: payload } } : s
        );
        return;
      }
      if (action === 'confirm') {
        eventBus.emit(EVENTS.SELECT_RESPONSE, { id: payload });
        return;
      }
      if (action === 'cancel') {
        eventBus.emit(EVENTS.SELECT_RESPONSE, { id: null });
      }
    },
    [eventBus]
  );

  const handleTextInputAction = useCallback(
    (action, value) => {
      if (action === 'submit') {
        eventBus.emit(EVENTS.TEXT_INPUT_RESPONSE, { value: value ?? '' });
        return;
      }
      if (action === 'cancel') {
        eventBus.emit(EVENTS.TEXT_INPUT_RESPONSE, { value: null });
      }
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
            { bold: true, color: 'magenta' },
            'EMOTION',
            state.activeProvider ? `  |  ${state.activeProvider}${state.activeModel ? ` / ${state.activeModel}` : ''}` : ''
          ),
          React.createElement(Text, { dimColor: true },
            'Shift+Enter newline · Enter send · Ctrl+V image · Ctrl+L clear · Esc cancel'
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
      livePlan: state.plan,
      activeModes: state.activeModes
    }),
    ...(state.activeTool
      ? [React.createElement(Text, { key: 'activeTool', dimColor: true }, state.activeTool.label)]
      : []),
    ...(pendingAttachments.length > 0 ? [
      React.createElement(Box, { key: 'attachments', marginTop: 0 },
        React.createElement(Text, { color: 'magenta' },
          `📎 ${pendingAttachments.length} image${pendingAttachments.length > 1 ? 's' : ''} attached — will send with next message`
        )
      )
    ] : []),
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
          state.pendingConfirmation.tool === 'run_command'
            ? 'Run this command?'
            : `Apply ${state.pendingConfirmation.action} to ${state.pendingConfirmation.path}?`
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
        React.createElement(Text, { color: 'cyan' }, '(y) approve once    (a) always allow    (n) deny')
      )
    ] : []),
    ...(state.pendingSelect
      ? [
          React.createElement(SelectMenu, {
            key: 'select',
            title: state.pendingSelect.title,
            subtitle: state.pendingSelect.subtitle,
            items: state.pendingSelect.items,
            activeIndex: state.pendingSelect.index ?? 0,
            cancelHint: state.pendingSelect.cancelHint,
          }),
        ]
      : []),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(PromptInput, {
        value: inputValue,
        onChange: setInputValue,
        onSubmit: handleSubmit,
        onClear: handleClear,
        onPaste: handlePaste,
        placeholder: state.pendingConfirmation
          ? 'Awaiting confirmation — press y, a, or n'
          : state.pendingSelect
            ? '↑↓ move · Enter select · Esc cancel'
            : state.pendingTextInput
              ? 'Type value · Enter confirm · Esc cancel'
              : 'Type a message...',
        pendingConfirmation: state.pendingConfirmation,
        onConfirm: handleConfirm,
        pendingSelect: state.pendingSelect,
        onSelectAction: handleSelectAction,
        pendingTextInput: state.pendingTextInput,
        onTextInputAction: handleTextInputAction,
        agentStatus: state.agentStatus,
        onCancel: handleCancel,
        workspaceDir
      })
    ),
    ...(state.queuedMessage ? [
      React.createElement(Box, { key: 'queued' },
        React.createElement(Text, { color: 'yellow', bold: true }, `⏳ queued: ${state.queuedMessage}`)
      )
    ] : []),
    React.createElement(StatusBar, {
      key: 'footer',
      agentStatus: state.agentStatus,
      statusMessage: state.statusMessage,
      spinnerFrame: state.spinnerFrame,
      teachMode: state.teachMode,
      supportMode: state.supportMode,
      activeModes: state.activeModes,
      autoMode: state.autoMode,
      acceptEdits: state.acceptEdits,
      allowedCount: state.allowedCount,
      guardMode: state.guardMode,
      activeProvider: state.activeProvider,
      activeModel: state.activeModel,
      tokenUsage: state.tokenUsage,
      workspaceDir: workspaceDir || process.cwd()
    })
  );
}
