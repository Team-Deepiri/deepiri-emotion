import React, { memo } from 'react';
import { Box, Text } from 'ink';

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

function MessageListImpl({ messages, streamingMessage }) {
  return (
    <Box flexDirection="column" gap={1} paddingY={1} flexShrink={1}>
      {messages.map((m, i) => {
        if (m.role === 'system') {
          return (
            <Box key={i} marginLeft={2} flexShrink={1}>
              <Text dimColor>{m.content}</Text>
            </Box>
          );
        }
        if (m.role === 'user') {
          return <UserTurn key={i} content={m.content} />;
        }
        return (
          <EmotionTurn key={i}>
            <Text wrap="wrap">{m.content}</Text>
          </EmotionTurn>
        );
      })}
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
