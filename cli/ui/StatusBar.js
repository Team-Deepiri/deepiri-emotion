import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';
import { MODE_BADGES } from '../core/modes.js';

export function StatusBar({ agentStatus, statusMessage, spinnerFrame, teachMode, supportMode, activeMode, autoMode, acceptEdits, allowedCount = 0 }) {
  const isBusy = agentStatus !== 'idle';
  const modeBadge = activeMode ? MODE_BADGES[activeMode] : null;
  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    teachMode && React.createElement(Text, { color: 'yellow', bold: true }, '[TEACH]'),
    supportMode && React.createElement(Text, { color: 'yellow' }, '[SUPPORT]'),
    autoMode && React.createElement(Text, { color: 'red', bold: true }, '[AUTO]'),
    acceptEdits && React.createElement(Text, { color: 'green', bold: true }, '[ACCEPT-EDITS]'),
    allowedCount > 0 && React.createElement(Text, { color: 'cyan', bold: true }, `[${allowedCount} allowed]`),
    modeBadge && React.createElement(Text, { color: modeBadge.color, bold: true }, modeBadge.label),
    isBusy && React.createElement(Spinner, { frame: spinnerFrame }),
    React.createElement(Text, { dimColor: !statusMessage }, statusMessage || (isBusy ? '...' : ''))
  );
}
