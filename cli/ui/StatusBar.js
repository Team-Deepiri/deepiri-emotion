import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';

export function StatusBar({ agentStatus, statusMessage, spinnerFrame, teachMode, supportMode }) {
  const isBusy = agentStatus !== 'idle';
  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    teachMode && React.createElement(Text, { color: 'yellow', bold: true }, '[TEACH]'),
    supportMode && React.createElement(Text, { color: 'yellow' }, '[SUPPORT]'),
    isBusy && React.createElement(Spinner, { frame: spinnerFrame }),
    React.createElement(Text, { dimColor: !statusMessage }, statusMessage || (isBusy ? '...' : ''))
  );
}
