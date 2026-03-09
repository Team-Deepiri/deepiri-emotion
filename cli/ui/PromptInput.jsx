import React from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

export function PromptInput({ value, onChange, onSubmit, placeholder }) {
  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      return;
    }
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    if (input) {
      onChange(value + input);
    }
  });

  return (
    <Box flexDirection="row" gap={1}>
      <Text color="green">&gt;</Text>
      <Text color={value ? 'white' : 'gray'}>
        {value || placeholder}
      </Text>
      <Text color="cyan">▌</Text>
    </Box>
  );
}
