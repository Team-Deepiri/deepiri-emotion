/**
 * Bottom footer — cwd, modes, provider/model, context meter, agent status.
 */
import React from 'react';
import { Box, Text } from 'ink';
import { homedir } from 'os';
import { Spinner } from './Spinner.js';
import { MODE_BADGES } from '../core/modes.js';

const BAR_WIDTH = 10;

function formatK(n) {
  if (n == null || Number.isNaN(n)) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Shorten an absolute path for the footer (`~/…`, ellipsis middle if long). */
export function shortPath(absPath, maxLen = 36) {
  if (!absPath) return '.';
  let p = absPath;
  const home = homedir();
  if (p === home) p = '~';
  else if (home && p.startsWith(`${home}/`)) p = `~${p.slice(home.length)}`;

  if (p.length <= maxLen) return p;
  const parts = p.split('/').filter(Boolean);
  if (parts.length <= 2) return `…${p.slice(-(maxLen - 1))}`;
  const head = parts[0] === '~' ? '~' : parts[0];
  const tail = parts.slice(-2).join('/');
  const candidate = `${head}/…/${tail}`;
  if (candidate.length <= maxLen) return candidate;
  return `…/${parts[parts.length - 1]}`.slice(0, maxLen);
}

function contextBar(pct) {
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((pct / 100) * BAR_WIDTH)));
  return `${'█'.repeat(filled)}${'░'.repeat(BAR_WIDTH - filled)}`;
}

function modeBadges({ teachMode, supportMode, activeModes, autoMode, acceptEdits, allowedCount, guardMode }) {
  const modeSet = activeModes instanceof Set ? activeModes : new Set();
  const nodes = [];
  if (teachMode) nodes.push({ key: 'teach', color: 'yellow', text: 'TEACH' });
  if (supportMode) nodes.push({ key: 'support', color: 'yellow', text: 'SUPPORT' });
  if (autoMode) nodes.push({ key: 'auto', color: 'red', text: 'AUTO' });
  if (acceptEdits) nodes.push({ key: 'accept', color: 'green', text: 'ACCEPT-EDITS' });
  if (guardMode) nodes.push({ key: 'guard', color: 'cyan', text: 'GUARD' });
  if (allowedCount > 0) nodes.push({ key: 'allow', color: 'cyan', text: `${allowedCount} allowed` });
  for (const m of modeSet) {
    if (MODE_BADGES[m]) nodes.push({ key: m, color: MODE_BADGES[m].color, text: MODE_BADGES[m].label.replace(/^\[|\]$/g, '') });
  }
  if (nodes.length === 0) nodes.push({ key: 'normal', color: undefined, text: 'normal', dim: true });
  return nodes;
}

export function StatusBar({
  agentStatus,
  statusMessage,
  spinnerFrame,
  teachMode,
  supportMode,
  activeModes,
  autoMode,
  acceptEdits,
  allowedCount = 0,
  guardMode,
  activeProvider,
  activeModel,
  tokenUsage,
  workspaceDir,
  llmProgress = null,
  backgroundTasks = [],
}) {
  const isBusy = agentStatus !== 'idle';
  const cwd = shortPath(workspaceDir || process.cwd());
  const used = tokenUsage?.used ?? 0;
  const limit = tokenUsage?.limit ?? 0;
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const tokenColor = pct >= 95 ? 'red' : pct >= 80 ? 'yellow' : 'magenta';
  const providerLabel = activeProvider
    ? `${activeProvider}${activeModel ? `/${activeModel}` : ''}`
    : 'no provider';
  const runningTasks = backgroundTasks.filter((t) => t.status === 'running').length;
  const waitingTasks = backgroundTasks.filter((t) => t.status === 'awaiting_confirmation').length;
  const landedTasks = backgroundTasks.filter((t) => t.unseenCompletion).length;
  const badges = modeBadges({
    teachMode,
    supportMode,
    activeModes,
    autoMode,
    acceptEdits,
    allowedCount,
    guardMode,
  });

  return React.createElement(
    Box,
    { flexDirection: 'column', marginTop: 1 },
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(Text, { color: 'cyan', bold: true }, cwd),
      React.createElement(Text, { dimColor: true }, '│'),
      React.createElement(
        Text,
        { color: activeProvider ? 'magenta' : 'red', dimColor: !!activeProvider },
        providerLabel
      ),
      React.createElement(Text, { dimColor: true }, '│'),
      ...badges.flatMap((b, i) => [
        ...(i > 0 ? [React.createElement(Text, { key: `${b.key}-sep`, dimColor: true }, '·')] : []),
        React.createElement(
          Text,
          { key: b.key, color: b.color, bold: !b.dim, dimColor: !!b.dim },
          b.text
        ),
      ]),
      React.createElement(Text, { dimColor: true }, '│'),
      React.createElement(
        Text,
        { color: tokenColor, bold: pct >= 80 },
        `ctx ${contextBar(pct)} ${pct}%`
      ),
      React.createElement(
        Text,
        { dimColor: true },
        `${formatK(used)}/${formatK(limit)}`
      )
    ),
    (runningTasks > 0 || waitingTasks > 0 || landedTasks > 0)
      ? React.createElement(
          Box,
          { flexDirection: 'row', gap: 1 },
          runningTasks > 0 && React.createElement(
            Text,
            { key: 'bg-running', color: 'cyan' },
            `🧵 ${runningTasks} background task${runningTasks === 1 ? '' : 's'} running`
          ),
          waitingTasks > 0 && React.createElement(
            Text,
            { key: 'bg-waiting', color: 'yellow', bold: true },
            `⚠ ${waitingTasks} awaiting approval — /tasks`
          ),
          landedTasks > 0 && React.createElement(
            Text,
            { key: 'bg-landed', color: 'green' },
            `✓ ${landedTasks} finished — /tasks`
          )
        )
      : null,
    llmProgress?.message
      ? React.createElement(
          Box,
          { flexDirection: 'row', gap: 1 },
          React.createElement(Text, { color: 'cyan', dimColor: llmProgress.phase === 'done' }, 'llm'),
          React.createElement(Text, { dimColor: true }, llmProgress.message)
        )
      : null,
    (isBusy || statusMessage)
      ? React.createElement(
          Box,
          { flexDirection: 'row', gap: 1 },
          isBusy && React.createElement(Spinner, { frame: spinnerFrame }),
          React.createElement(
            Text,
            { dimColor: !statusMessage, color: isBusy ? 'yellow' : undefined },
            statusMessage || (isBusy ? 'working…' : '')
          )
        )
      : null
  );
}
