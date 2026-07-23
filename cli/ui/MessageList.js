import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownText } from './MarkdownText.js';
import { StepTimeline } from './StepTimeline.js';
import { PlanChecklist } from './PlanChecklist.js';

export function MessageList({ messages, streamingMessage, liveSteps, livePlan, activeModes }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0, paddingY: 1, flexShrink: 1 },
    messages.map((m, i) =>
      m.role === 'system'
        ? React.createElement(
            Box,
            { key: i, flexDirection: 'column', flexShrink: 1 },
            React.createElement(Text, { dimColor: true }, m.content)
          )
        : React.createElement(
            Box,
            { key: i, flexDirection: 'column', flexShrink: 1 },
            React.createElement(Text, { bold: true, color: m.role === 'user' ? 'green' : 'blue' }, m.role === 'user' ? 'You' : 'Assistant' + ':'),
            m.role === 'assistant' && m.plan?.length
              ? React.createElement(PlanChecklist, { items: m.plan })
              : null,
            m.role === 'assistant'
              ? React.createElement(MarkdownText, { content: m.content })
              : React.createElement(Text, null, m.content),
            m.role === 'assistant' && m.steps?.length
              ? React.createElement(StepTimeline, { steps: m.steps, activeModes })
              : null
          )
    ),
    livePlan?.length
      ? React.createElement(PlanChecklist, { items: livePlan })
      : null,
    streamingMessage
      ? React.createElement(
          Box,
          { flexDirection: 'column', flexShrink: 1 },
          React.createElement(Text, { bold: true, color: 'blue' }, 'Assistant:'),
          React.createElement(Text, { color: 'gray', wrap: 'wrap' }, streamingMessage),
          React.createElement(Text, { color: 'cyan' }, '▌')
        )
      : null,
    liveSteps?.length
      ? React.createElement(StepTimeline, { steps: liveSteps, activeModes })
      : null
  );
}
