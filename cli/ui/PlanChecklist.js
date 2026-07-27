import React from 'react';
import { Box, Text } from 'ink';

const STATUS_ICONS = { done: '✓', in_progress: '◐', pending: '▢' };
const STATUS_COLORS = { done: 'green', in_progress: 'yellow' };

export function PlanChecklist({ items }) {
  if (!items || items.length < 2) return null;

  return React.createElement(
    Box,
    { flexDirection: 'column', marginBottom: 1 },
    React.createElement(Text, { dimColor: true }, 'Plan:'),
    ...items.map((item, i) =>
      React.createElement(
        Text,
        {
          key: `plan-${i}`,
          color: STATUS_COLORS[item.status],
          dimColor: item.status === 'pending'
        },
        ' ',
        STATUS_ICONS[item.status] || '▢',
        ' ',
        item.text
      )
    )
  );
}
