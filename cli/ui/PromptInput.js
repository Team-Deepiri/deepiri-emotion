import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

/** Finds the start index of the word immediately before `pos` (for Ctrl+W). */
export function wordDeleteStart(str, pos) {
  let i = pos;
  while (i > 0 && /\s/.test(str[i - 1])) i--;
  while (i > 0 && !/\s/.test(str[i - 1])) i--;
  return i;
}

export function PromptInput({ value, onChange, onSubmit, onClear, placeholder, pendingConfirmation, onConfirm }) {
  const [cursor, setCursor] = useState(value.length);

  // value is controlled by the parent (submit/clear reset it externally) —
  // keep cursor in range whenever it changes out from under us.
  useEffect(() => {
    setCursor((c) => Math.min(c, value.length));
  }, [value]);

  useInput((input, key) => {
    if (pendingConfirmation) {
      if (key.ctrl && input === 'c') {
        process.exit(0);
      }
      if (input === 'y' || input === 'Y') {
        if (typeof onConfirm === 'function') onConfirm(true);
        return;
      }
      if (input === 'n' || input === 'N' || key.escape) {
        if (typeof onConfirm === 'function') onConfirm(false);
        return;
      }
      return;
    }
    if (key.return) {
      if (key.shift) {
        onChange(value.slice(0, cursor) + '\n' + value.slice(cursor));
        setCursor((c) => c + 1);
        return;
      }
      onSubmit(value);
      return;
    }
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }
    if (key.ctrl && input === 'l') {
      if (typeof onClear === 'function') onClear();
      return;
    }
    if (key.leftArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.rightArrow) {
      setCursor((c) => Math.min(value.length, c + 1));
      return;
    }
    if (key.ctrl && input === 'a') {
      setCursor(0);
      return;
    }
    if (key.ctrl && input === 'e') {
      setCursor(value.length);
      return;
    }
    if (key.ctrl && input === 'w') {
      const start = wordDeleteStart(value, cursor);
      onChange(value.slice(0, start) + value.slice(cursor));
      setCursor(start);
      return;
    }
    if (key.backspace || key.delete) {
      if (cursor === 0) return;
      onChange(value.slice(0, cursor - 1) + value.slice(cursor));
      setCursor((c) => c - 1);
      return;
    }
    if (input) {
      onChange(value.slice(0, cursor) + input + value.slice(cursor));
      setCursor((c) => c + input.length);
    }
  });

  if (!value) {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(Text, { color: 'green' }, '>'),
      React.createElement(Text, { inverse: true }, ' '),
      React.createElement(Text, { color: 'gray' }, placeholder)
    );
  }

  const before = value.slice(0, cursor);
  const atCursor = value.slice(cursor, cursor + 1) || ' ';
  const after = value.slice(cursor + 1);

  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    React.createElement(Text, { color: 'green' }, '>'),
    React.createElement(
      Text,
      { color: 'white' },
      before,
      React.createElement(Text, { inverse: true }, atCursor),
      after
    )
  );
}
