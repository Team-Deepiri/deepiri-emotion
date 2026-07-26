import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { MarkdownText } from './MarkdownText.js';
import { StepTimeline } from './StepTimeline.js';
import { PlanChecklist } from './PlanChecklist.js';

/**
 * Speaker identity without labels:
 * - You: soft gray line fill via Text background (not Box bg — Box fills
 *   thrash Ink's redraw on WSL).
 * - Emotion: plain text — no chrome.
 */
function UserTurn({ content }) {
  return React.createElement(
    Box,
    { flexDirection: 'row', flexShrink: 1 },
    React.createElement(
      Text,
      { backgroundColor: '#3f3f46' },
      React.createElement(Text, { color: 'green', bold: true }, '> '),
      React.createElement(Text, { wrap: 'wrap' }, content)
    )
  );
}

function EmotionTurn({ children }) {
  const body = React.Children.toArray(children).filter(Boolean);
  return React.createElement(
    Box,
    { flexDirection: 'column', flexShrink: 1, paddingX: 1 },
    ...body
  );
}

function messageKey(m, i) {
  if (m.turnId != null) return `${m.role}-${m.turnId}-${i}`;
  return `${m.role}-${i}-${(m.content || '').slice(0, 24)}`;
}

function MessageListImpl({ messages, streamingMessage, liveSteps, livePlan, activeModes }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1, paddingY: 1, flexShrink: 1 },
    messages.map((m, i) => {
      if (m.role === 'system') {
        return React.createElement(
          Box,
          { key: messageKey(m, i), flexDirection: 'column', flexShrink: 1, marginLeft: 2 },
          React.createElement(Text, { dimColor: true }, m.content)
        );
      }

      if (m.role === 'user') {
        return React.createElement(UserTurn, { key: messageKey(m, i), content: m.content });
      }

      return React.createElement(
        EmotionTurn,
        { key: messageKey(m, i) },
        m.plan?.length ? React.createElement(PlanChecklist, { items: m.plan }) : null,
        React.createElement(MarkdownText, { content: m.content }),
        m.steps?.length
          ? React.createElement(StepTimeline, { steps: m.steps, activeModes })
          : null
      );
    }),
    livePlan?.length && !streamingMessage
      ? React.createElement(
          Box,
          { marginLeft: 1, flexDirection: 'column', flexShrink: 1 },
          React.createElement(PlanChecklist, { items: livePlan })
        )
      : null,
    streamingMessage
      ? React.createElement(
          EmotionTurn,
          null,
          livePlan?.length ? React.createElement(PlanChecklist, { items: livePlan }) : null,
          React.createElement(
            Text,
            { wrap: 'wrap' },
            streamingMessage,
            React.createElement(Text, { color: 'magenta', dimColor: true }, '▌')
          ),
          liveSteps?.length
            ? React.createElement(StepTimeline, { steps: liveSteps, activeModes })
            : null
        )
      : liveSteps?.length
        ? React.createElement(
            Box,
            { marginLeft: 1, flexDirection: 'column', flexShrink: 1 },
            React.createElement(StepTimeline, { steps: liveSteps, activeModes })
          )
        : null
  );
}

export const MessageList = memo(MessageListImpl);
