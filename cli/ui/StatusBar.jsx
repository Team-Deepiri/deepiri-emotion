import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.jsx';

export function StatusBar({ agentStatus, statusMessage, spinnerFrame }) {
  const isBusy = agentStatus !== 'idle';
  return (
    <Box flexDirection="row" gap={1}>
      {isBusy && <Spinner frame={spinnerFrame} />}
      <Text dimColor={!statusMessage}>
        {statusMessage || (isBusy ? '...' : '')}
      </Text>
    </Box>
  );
}
