import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';
import { MODE_BADGES } from '../core/modes.js';

export function StatusBar({ agentStatus, statusMessage, spinnerFrame, teachMode, supportMode, activeModes, autoMode, acceptEdits, guardMode, activeProvider }) {
  const isBusy = agentStatus !== 'idle';
  const modeSet = activeModes instanceof Set ? activeModes : new Set();
  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    teachMode && React.createElement(Text, { color: 'yellow', bold: true }, '[TEACH]'),
    supportMode && React.createElement(Text, { color: 'yellow' }, '[SUPPORT]'),
    autoMode && React.createElement(Text, { color: 'red', bold: true }, '[AUTO]'),
    acceptEdits && React.createElement(Text, { color: 'green', bold: true }, '[ACCEPT-EDITS]'),
    guardMode && React.createElement(Text, { color: 'cyan', bold: true }, '[GUARD]'),
    ...[...modeSet].map((m) => MODE_BADGES[m]
      ? React.createElement(Text, { key: m, color: MODE_BADGES[m].color, bold: true }, MODE_BADGES[m].label)
      : null
    ),
    activeProvider && React.createElement(Text, { color: 'magenta', dimColor: true }, `[${activeProvider}]`),
    isBusy && React.createElement(Spinner, { frame: spinnerFrame }),
    React.createElement(Text, { dimColor: !statusMessage }, statusMessage || (isBusy ? '...' : ''))
  );
}
