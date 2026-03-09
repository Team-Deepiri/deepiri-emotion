import React from 'react';
import { Box, Text } from 'ink';

const STEP_ICONS = {
  thinking: '🧠',
  tool_call: '🔍',
  tool_result: '✓',
  response: '✍'
};

export function StepTimeline({ steps }) {
  if (!steps.length) return null;
  return (
    <Box flexDirection="column" gap={0} marginBottom={1}>
      <Text dimColor>Steps:</Text>
      {steps.slice(-5).map((s, i) => (
        <Text key={s.id || i} dimColor={s.status === 'running'}>
          {' '}
          {STEP_ICONS[s.type] || '•'} {s.message}
          {s.status === 'running' ? '...' : ''}
        </Text>
      ))}
    </Box>
  );
}
