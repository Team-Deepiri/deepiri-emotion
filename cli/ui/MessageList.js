import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownText } from './MarkdownText.js';

export function MessageList({ messages, streamingMessage }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0, paddingY: 1, flexShrink: 1 },
    messages.map((m, i) =>
      React.createElement(
        Box,
        { key: i, flexDirection: 'column', flexShrink: 1 },
        React.createElement(Text, { bold: true, color: m.role === 'user' ? 'green' : 'blue' }, m.role === 'user' ? 'You' : 'Assistant' + ':'),
        m.role === 'assistant'
          ? React.createElement(MarkdownText, { content: m.content })
          : React.createElement(Text, null, m.content)
      )
    ),
    streamingMessage
      ? React.createElement(
          Box,
          { flexDirection: 'column', flexShrink: 1 },
          React.createElement(Text, { bold: true, color: 'blue' }, 'Assistant:'),
          React.createElement(Text, { color: 'gray', wrap: 'wrap' }, streamingMessage),
          React.createElement(Text, { color: 'cyan' }, '▌')
        )
      : null
  );
}
