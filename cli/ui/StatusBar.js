import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './Spinner.js';
import { MODE_BADGES } from '../core/modes.js';

function formatK(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function StatusBar({ agentStatus, statusMessage, spinnerFrame, teachMode, supportMode, activeModes, autoMode, acceptEdits, allowedCount = 0, guardMode, activeProvider, tokenUsage }) {
  const isBusy = agentStatus !== 'idle';
  const modeSet = activeModes instanceof Set ? activeModes : new Set();
  const pct = tokenUsage?.limit ? Math.round((tokenUsage.used / tokenUsage.limit) * 100) : 0;
  const tokenColor = pct >= 95 ? 'red' : pct >= 80 ? 'yellow' : undefined;
  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 1 },
    teachMode && React.createElement(Text, { color: 'yellow', bold: true }, '[TEACH]'),
    supportMode && React.createElement(Text, { color: 'yellow' }, '[SUPPORT]'),
    autoMode && React.createElement(Text, { color: 'red', bold: true }, '[AUTO]'),
    acceptEdits && React.createElement(Text, { color: 'green', bold: true }, '[ACCEPT-EDITS]'),
    allowedCount > 0 && React.createElement(Text, { color: 'cyan', bold: true }, `[${allowedCount} allowed]`),
    guardMode && React.createElement(Text, { color: 'cyan', bold: true }, '[GUARD]'),
    ...[...modeSet].map((m) => MODE_BADGES[m]
      ? React.createElement(Text, { key: m, color: MODE_BADGES[m].color, bold: true }, MODE_BADGES[m].label)
      : null
    ),
    activeProvider && React.createElement(Text, { color: 'magenta', dimColor: true }, `[${activeProvider}]`),
    tokenUsage && React.createElement(
      Text,
      { color: tokenColor, bold: !!tokenColor, dimColor: !tokenColor },
      `${formatK(tokenUsage.used)} / ${formatK(tokenUsage.limit)} tokens (${pct}%)`
    ),
    isBusy && React.createElement(Spinner, { frame: spinnerFrame }),
    React.createElement(Text, { dimColor: !statusMessage }, statusMessage || (isBusy ? '...' : ''))
  );
}
