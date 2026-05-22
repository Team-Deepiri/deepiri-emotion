import React from 'react';
import { Box, Text } from 'ink';

export function parseInline(text) {
  const segments = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', content: text.slice(last, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('**')) {
      segments.push({ type: 'bold', content: raw.slice(2, -2) });
    } else {
      segments.push({ type: 'code', content: raw.slice(1, -1) });
    }
    last = match.index + raw.length;
  }
  if (last < text.length) {
    segments.push({ type: 'text', content: text.slice(last) });
  }
  return segments;
}

function renderInlineChildren(text) {
  return parseInline(text).map((seg, i) => {
    if (seg.type === 'bold') return React.createElement(Text, { key: i, bold: true }, seg.content);
    if (seg.type === 'code') return React.createElement(Text, { key: i, color: 'cyan' }, seg.content);
    return seg.content;
  });
}

export function MarkdownText({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        React.createElement(
          Box,
          { key: k++, borderStyle: 'single', borderColor: 'gray', paddingX: 1 },
          ...codeLines.map((cl, ci) =>
            React.createElement(Text, { key: ci, color: 'green' }, cl)
          )
        )
      );
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        React.createElement(Text, { key: k++, bold: true, color: 'cyan', underline: true }, line.slice(2))
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        React.createElement(Text, { key: k++, bold: true, color: 'cyan' }, line.slice(3))
      );
      i++;
      continue;
    }

    if (/^[*-] /.test(line)) {
      elements.push(
        React.createElement(Text, { key: k++ }, '• ', ...renderInlineChildren(line.slice(2)))
      );
      i++;
      continue;
    }

    if (!line.trim()) {
      elements.push(React.createElement(Text, { key: k++ }, ''));
      i++;
      continue;
    }

    elements.push(React.createElement(Text, { key: k++ }, ...renderInlineChildren(line)));
    i++;
  }

  return React.createElement(Box, { flexDirection: 'column' }, ...elements);
}
