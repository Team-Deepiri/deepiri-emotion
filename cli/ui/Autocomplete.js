import React from 'react';
import { Box, Text } from 'ink';

const MAX_VISIBLE = 8;

/**
 * Bordered menu rendered below the prompt for / and @ triggers.
 * `items` is an array of { label, description? }. `activeIndex` highlights a row.
 */
export function Autocomplete({ items, activeIndex }) {
  if (!items || items.length === 0) return null;

  // Keep the active row in view without growing the box past MAX_VISIBLE rows.
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
    { flexDirection: 'column', borderStyle: 'round', borderColor: 'gray', paddingX: 1 },
    ...visible.map((item, i) => {
      const realIndex = start + i;
      const isActive = realIndex === activeIndex;
      return React.createElement(
        Box,
        { key: item.label, flexDirection: 'row', gap: 1 },
        React.createElement(
          Text,
          { color: isActive ? 'cyan' : undefined, bold: isActive, inverse: isActive },
          item.label
        ),
        item.description
          ? React.createElement(Text, { dimColor: true }, item.description)
          : null
      );
    }),
    items.length > MAX_VISIBLE
      ? React.createElement(Text, { dimColor: true }, `  ${activeIndex + 1}/${items.length}`)
      : null
  );
}
