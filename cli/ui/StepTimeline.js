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
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0, marginBottom: 1 },
    React.createElement(Text, { dimColor: true }, 'Steps:'),
    ...steps.slice(-5).map((s, i) =>
      React.createElement(
        Text,
        { key: `${s.id || 'step'}-${i}`, dimColor: s.status === 'running' },
        ' ',
        STEP_ICONS[s.type] || '•',
        ' ',
        s.message,
        s.status === 'running' ? '...' : ''
      )
    )
  );
}
