import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';

export function StatusBar({ agentStatus, statusMessage, spinnerFrame }) {
  const isBusy = agentStatus !== 'idle';
  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    isBusy && React.createElement(Spinner, { frame: spinnerFrame }),
    React.createElement(Text, { dimColor: !statusMessage }, statusMessage || (isBusy ? '...' : ''))
  );
}
