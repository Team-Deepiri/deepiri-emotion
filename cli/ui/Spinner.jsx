import React from 'react';
import { Text } from 'ink';
import { SPINNER_FRAMES } from '../core/stateStore.js';

export function Spinner({ frame }) {
  const idx = Math.abs(frame) % SPINNER_FRAMES.length;
  return <Text color="cyan">{SPINNER_FRAMES[idx]}</Text>;
}
