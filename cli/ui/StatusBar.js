import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';
import { MODE_BADGES } from '../core/modes.js';

export function StatusBar({ agentStatus, statusMessage, spinnerFrame, teachMode, supportMode, activeMode }) {
  const isBusy = agentStatus !== 'idle';
  const modeBadge = activeMode ? MODE_BADGES[activeMode] : null;
  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    teachMode && React.createElement(Text, { color: 'yellow', bold: true }, '[TEACH]'),
    supportMode && React.createElement(Text, { color: 'yellow' }, '[SUPPORT]'),
    modeBadge && React.createElement(Text, { color: modeBadge.color, bold: true }, modeBadge.label),
    isBusy && React.createElement(Spinner, { frame: spinnerFrame }),
    React.createElement(Text, { dimColor: !statusMessage }, statusMessage || (isBusy ? '...' : ''))
  );
}
