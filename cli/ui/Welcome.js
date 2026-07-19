import React from 'react';
import { Box, Text } from 'ink';

const EXAMPLE_PROMPTS = [
  'Summarize what this project does',
  'Find where user auth is handled',
  'Add a test for the parser edge case'
];

export function Welcome({ workspaceDir, activeProvider, activeModel }) {
  const connectionColor = activeProvider ? 'green' : 'red';
  const providerLabel = activeProvider
    ? `${activeProvider}${activeModel ? ` / ${activeModel}` : ''}`
    : 'no provider available';

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'round', borderColor: 'cyan', paddingX: 2, paddingY: 1, marginBottom: 1 },
    React.createElement(Text, { bold: true, color: 'cyan' }, 'Deepiri Emotion CLI'),
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(Text, { color: connectionColor }, '●'),
      React.createElement(Text, { dimColor: true }, providerLabel)
    ),
    React.createElement(Text, { dimColor: true }, `Workspace: ${workspaceDir || process.cwd()}`),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { dimColor: true },
        'Your agentic partner for working the codebase — plan, edit, and ship without leaving the terminal.'
      )
    ),
    React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { bold: true }, 'Try:'),
      ...EXAMPLE_PROMPTS.map((prompt, i) =>
        React.createElement(Text, { key: `example-${i}`, dimColor: true }, `  ${prompt}`)
      )
    ),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { dimColor: true }, 'Type /help for commands, @ to reference a file.')
    )
  );
}
