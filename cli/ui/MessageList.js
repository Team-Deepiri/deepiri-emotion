import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownText } from './MarkdownText.js';
import { StepTimeline } from './StepTimeline.js';

export function MessageList({ messages, streamingMessage, liveSteps, activeMode }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0, paddingY: 1 },
    messages.map((m, i) =>
      m.role === 'system'
        ? React.createElement(
            Box,
            { key: i, flexDirection: 'column' },
            React.createElement(Text, { dimColor: true }, m.content)
          )
        : React.createElement(
            Box,
            { key: i, flexDirection: 'column' },
            React.createElement(Text, { bold: true, color: m.role === 'user' ? 'green' : 'blue' }, m.role === 'user' ? 'You' : 'Assistant' + ':'),
            m.role === 'assistant'
              ? React.createElement(MarkdownText, { content: m.content })
              : React.createElement(Text, null, m.content),
            m.role === 'assistant' && m.steps?.length
              ? React.createElement(StepTimeline, { steps: m.steps, activeMode })
              : null
          )
    ),
    streamingMessage
      ? React.createElement(
          Box,
          { flexDirection: 'column' },
          React.createElement(Text, { bold: true, color: 'blue' }, 'Assistant:'),
          React.createElement(Text, { color: 'gray' }, streamingMessage),
          React.createElement(Text, { color: 'cyan' }, '▌')
        )
      : null,
    liveSteps?.length
      ? React.createElement(StepTimeline, { steps: liveSteps, activeMode })
      : null
  );
}
