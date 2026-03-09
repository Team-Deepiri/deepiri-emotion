import React from 'react';
import { Box, Text } from 'ink';

export function MessageList({ messages, streamingMessage }) {
  return (
    <Box flexDirection="column" gap={0} paddingY={1}>
      {messages.map((m, i) => (
        <Box key={i} flexDirection="column">
          <Text bold color={m.role === 'user' ? 'green' : 'blue'}>
            {m.role === 'user' ? 'You' : 'Assistant'}:
          </Text>
          <Text>{m.content}</Text>
        </Box>
      ))}
      {streamingMessage ? (
        <Box flexDirection="column">
          <Text bold color="blue">Assistant:</Text>
          <Text color="gray">{streamingMessage}</Text>
          <Text color="cyan">▌</Text>
        </Box>
      ) : null}
    </Box>
  );
}
