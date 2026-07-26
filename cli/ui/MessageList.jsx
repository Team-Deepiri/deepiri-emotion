import React, { memo } from 'react';
import { Box, Text, Static } from 'ink';

function UserTurn({ content }) {
  return (
    <Box flexDirection="row" flexShrink={1}>
      <Text backgroundColor="#3f3f46">
        <Text color="green" bold>{'> '}</Text>
        <Text wrap="wrap">{content}</Text>
      </Text>
    </Box>
  );
}

function EmotionTurn({ children }) {
  const body = React.Children.toArray(children).filter(Boolean);
  return (
    <Box flexDirection="column" flexShrink={1} paddingX={1}>
      {body}
    </Box>
  );
}

function CompletedMessage({ message: m }) {
  if (m.role === 'system') {
    return (
      <Box marginLeft={2} marginBottom={1} flexShrink={1}>
        <Text dimColor>{m.content}</Text>
      </Box>
    );
  }
  if (m.role === 'user') {
    return (
      <Box marginBottom={1} flexShrink={1}>
        <UserTurn content={m.content} />
      </Box>
    );
  }
  return (
    <Box marginBottom={1} flexShrink={1}>
      <EmotionTurn>
        <Text wrap="wrap">{m.content}</Text>
      </EmotionTurn>
    </Box>
  );
}

function MessageListImpl({ messages, streamingMessage, staticEpoch = 0 }) {
  return (
    <Box flexDirection="column" flexShrink={1} paddingY={1}>
      <Static key={`static-${staticEpoch}`} items={messages}>
        {(m, i) => <CompletedMessage key={`${m.role}-${i}`} message={m} />}
      </Static>
      {streamingMessage ? (
        <EmotionTurn>
          <Text wrap="wrap">
            {streamingMessage}
            <Text color="magenta" dimColor>▌</Text>
          </Text>
        </EmotionTurn>
      ) : null}
    </Box>
  );
}

export const MessageList = memo(MessageListImpl);
