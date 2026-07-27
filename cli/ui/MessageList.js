import React, { memo } from 'react';
import { Box, Text, Static } from 'ink';
import { MarkdownText } from './MarkdownText.js';
import { StepTimeline } from './StepTimeline.js';
import { PlanChecklist } from './PlanChecklist.js';

/**
 * Speaker identity without labels:
 * - You: soft gray fill + green `>`
 * - Emotion: plain text
 *
 * Completed turns render via Ink <Static> so spinner / status ticks do NOT
 * erase+repaint the whole transcript (the usual Ink flicker on WSL).
 * See: https://github.com/vadimdemedes/ink#staticitems
 * and Kilo Code's "CLI Fix Ink Flickering" approach.
 */
function UserTurn({ content }) {
  return React.createElement(
    Box,
    { flexDirection: 'row', flexShrink: 1 },
    React.createElement(
      Text,
      { backgroundColor: '#3f3f46' },
      React.createElement(Text, { color: 'green', bold: true }, '> '),
      React.createElement(Text, { color: 'white', wrap: 'wrap' }, content)
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

function CompletedMessage({ message: m, activeModes }) {
  if (m.role === 'system') {
    return React.createElement(
      Box,
      { flexDirection: 'column', flexShrink: 1, marginLeft: 2, marginBottom: 1 },
      React.createElement(Text, { dimColor: true }, m.content)
    );
  }
  if (m.role === 'user') {
    return React.createElement(
      Box,
      { marginBottom: 1, flexShrink: 1 },
      React.createElement(UserTurn, { content: m.content })
    );
  }
  return React.createElement(
    Box,
    { marginBottom: 1, flexDirection: 'column', flexShrink: 1 },
    React.createElement(
      EmotionTurn,
      null,
      m.plan?.length ? React.createElement(PlanChecklist, { items: m.plan }) : null,
      React.createElement(MarkdownText, { content: m.content }),
      m.steps?.length
        ? React.createElement(StepTimeline, { steps: m.steps, activeModes })
        : null
    )
  );
}

function MessageListImpl({
  messages,
  streamingMessage,
  liveSteps,
  livePlan,
  activeModes,
  staticEpoch = 0,
}) {
  return React.createElement(
    Box,
    { flexDirection: 'column', flexShrink: 1, paddingY: 1 },
    // Permanently paint finished turns above the dynamic region.
    React.createElement(
      Static,
      { key: `static-${staticEpoch}`, items: messages },
      (m, i) =>
        React.createElement(CompletedMessage, {
          key: messageKey(m, i),
          message: m,
          activeModes,
        })
    ),
    // Everything below re-renders freely (streaming, spinner-adjacent status).
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
          )
        )
      : null,
    liveSteps?.length
      ? React.createElement(
          Box,
          { marginLeft: 1, flexDirection: 'column', flexShrink: 1, marginTop: streamingMessage ? 0 : 0 },
          React.createElement(StepTimeline, { steps: liveSteps, activeModes })
        )
      : null
  );
}

export const MessageList = memo(MessageListImpl);
