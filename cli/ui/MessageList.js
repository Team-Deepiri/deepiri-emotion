import React from 'react';
import { Box, Text } from 'ink';

export function MessageList({ messages, streamingMessage }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0, paddingY: 1 },
    messages.map((m, i) =>
      React.createElement(
        Box,
        { key: i, flexDirection: 'column' },
        React.createElement(Text, { bold: true, color: m.role === 'user' ? 'green' : 'blue' }, m.role === 'user' ? 'You' : 'Assistant' + ':'),
        React.createElement(Text, null, m.content)
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
      : null
  );
}
