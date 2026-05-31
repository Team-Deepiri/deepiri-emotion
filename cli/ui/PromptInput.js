import React from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

export function PromptInput({ value, onChange, onSubmit, onClear, onPaste, placeholder, pendingConfirmation, onConfirm }) {
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
        onChange(value + '\n');
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
    if (key.ctrl && input === 'v') {
      if (typeof onPaste === 'function') onPaste();
      return;
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    if (input) {
      onChange(value + input);
    }
  });

  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    React.createElement(Text, { color: 'green' }, '>'),
    React.createElement(Text, { color: value ? 'white' : 'gray' }, value || placeholder),
    React.createElement(Text, { color: 'cyan' }, '▌')
  );
}
