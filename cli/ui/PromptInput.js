import React from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

export function PromptInput({ value, onChange, onSubmit, onClear, placeholder }) {
  useInput((input, key) => {
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
