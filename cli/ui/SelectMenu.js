import React from 'react';
import { Box, Text } from 'ink';

const MAX_VISIBLE = 12;

/**
 * Interactive arrow-key menu shown above the prompt.
 * items: [{ id, label, description?, disabled? }]
 */
export function SelectMenu({ title, subtitle, items = [], activeIndex = 0, cancelHint }) {
  if (!items.length) return null;

  let start = 0;
  if (items.length > MAX_VISIBLE) {
    start = Math.min(
      Math.max(0, activeIndex - Math.floor(MAX_VISIBLE / 2)),
      items.length - MAX_VISIBLE
    );
  }
  const visible = items.slice(start, start + MAX_VISIBLE);

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      marginTop: 1,
      paddingX: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    },
    React.createElement(Text, { color: 'cyan', bold: true }, title || 'Select'),
    subtitle
      ? React.createElement(Text, { dimColor: true }, subtitle)
      : null,
    ...visible.map((item, i) => {
      const realIndex = start + i;
      const isActive = realIndex === activeIndex;
      const disabled = !!item.disabled;
      return React.createElement(
        Box,
        { key: `${item.id}-${realIndex}`, flexDirection: 'row', gap: 1 },
        React.createElement(
          Text,
          {
            color: disabled ? 'gray' : isActive ? 'cyan' : undefined,
            bold: isActive && !disabled,
            inverse: isActive && !disabled,
            dimColor: disabled,
          },
          disabled ? `  ${item.label}` : isActive ? `❯ ${item.label}` : `  ${item.label}`
        ),
        item.description
          ? React.createElement(Text, { dimColor: true }, item.description)
          : null
      );
    }),
    items.length > MAX_VISIBLE
      ? React.createElement(Text, { dimColor: true }, `  ${activeIndex + 1}/${items.length}`)
      : null,
    React.createElement(Text, { dimColor: true }, cancelHint || 'Esc cancel · ↑↓ move · Enter select')
  );
}
