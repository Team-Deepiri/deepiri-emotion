import React from 'react';
import { Box, Text } from 'ink';
import { MODES } from '../core/modes.js';

const STEP_ICONS = {
  thinking: '🧠',
  tool_call: '🔍',
  tool_result: '✓',
  response: '✍',
  teach: '📖',
  supervisor: '🛑',
};

const CATEGORY_LABELS = {
  agent_reasoning: 'Reasoning',
  code_concept: 'Concept',
  best_practice: 'Best Practice'
};

export function StepTimeline({ steps, activeModes }) {
  if (!steps.length) return null;

  const modeSet = activeModes instanceof Set ? activeModes : new Set();
  // Non-debug: only show meaningful tool use (tool_call/tool_result), teach, supervisor.
  // Hide thinking (internal reasoning), response (done/status noise), provider steps.
  // Debug: show everything including reasoning steps and provider selection.
  const visibleSteps = modeSet.has(MODES.DEBUG)
    ? steps
    : steps.filter((s) => s.type === 'tool_call' || s.type === 'tool_result' || s.type === 'teach' || s.type === 'supervisor');

  if (!visibleSteps.length) return null;

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 0, marginBottom: 1 },
    React.createElement(Text, { dimColor: true }, 'Steps:'),
    ...visibleSteps.slice(-8).map((s, i) => {
      if (s.type === 'supervisor') {
        return React.createElement(
          Box,
          { key: `${s.id || 'step'}-${i}`, flexDirection: 'column', marginLeft: 1 },
          React.createElement(
            Text,
            { color: 'red', bold: true },
            '  🛑 Supervisor halted — ',
            s.reason || s.message || 'action flagged for review'
          ),
          s.suggestion && React.createElement(
            Text,
            { color: 'yellow', dimColor: true },
            '     → ',
            String(s.suggestion).slice(0, 140)
          )
        );
      }

      if (s.type === 'teach') {
        const label = CATEGORY_LABELS[s.category] || s.category || '';
        const explanation = s.explanation || '';
        return React.createElement(
          Box,
          { key: `${s.id || 'step'}-${i}`, flexDirection: 'column', marginLeft: 1 },
          React.createElement(
            Text,
            { color: 'yellow' },
            '  📖 ',
            React.createElement(Text, { color: 'yellow', bold: true }, s.concept || s.message),
            label ? ` [${label}]` : ''
          ),
          explanation && React.createElement(
            Text,
            { color: 'yellow', dimColor: true },
            '     ',
            explanation.slice(0, 140),
            explanation.length > 140 ? '…' : ''
          ),
          s.example && React.createElement(
            Text,
            { color: 'yellow', dimColor: true },
            '     eg: ',
            String(s.example).slice(0, 80)
          )
        );
      }

      return React.createElement(
        Text,
        { key: `${s.id || 'step'}-${i}`, dimColor: s.status === 'running' },
        ' ',
        STEP_ICONS[s.type] || '•',
        ' ',
        s.message,
        s.status === 'running' ? '...' : ''
      );
    })
  );
}
