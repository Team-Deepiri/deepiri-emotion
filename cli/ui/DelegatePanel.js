import React from 'react';
import { Box, Text } from 'ink';

/**
 * Live view of a delegation fan-out: one row per sub-agent, updated as each
 * finishes. Without this the TUI shows nothing at all while several agents
 * work — DELEGATE_STEP was emitted but had no subscriber, so a multi-agent
 * turn was a silent pause of up to the 45s delegate timeout.
 */
const STATUS_ICONS = { queued: '▢', running: '◐', done: '✓', error: '✗' };
const STATUS_COLORS = { running: 'yellow', done: 'green', error: 'red' };

/**
 * Fold one DELEGATE_STEP into the current rows.
 *
 * Sub-agents report by index: one 'running' event each when the fan-out
 * starts, then a 'done' or 'error' for the same index as each finishes. Rows
 * are therefore merged in place rather than appended, or a fan-out of three
 * would render six rows. Merging also preserves the role/provider from the
 * opening event if a later one omits them.
 *
 * @param {Array<object>} delegates — current rows
 * @param {object} payload — the DELEGATE_STEP payload
 * @returns {Array<object>} new rows (the input array is never mutated)
 */
export function mergeDelegateStep(delegates = [], payload = {}) {
  const { index } = payload;
  if (!Number.isInteger(index) || index < 0) return delegates;
  const next = [...delegates];
  next[index] = { ...next[index], ...payload };
  return next;
}

/** "implementer (anthropic:claude-sonnet-5)" — model omitted when not pinned. */
export function agentLabel({ role, provider, model }) {
  const target = [provider, model].filter(Boolean).join(':');
  const name = role || 'agent';
  return target ? `${name} (${target})` : name;
}

export function DelegatePanel({ agents }) {
  if (!agents || agents.length === 0) return null;

  // Counts settled agents only — a queued agent has not finished, and treating
  // "not running" as finished would show 2/2 before any work had started.
  const doneCount = agents.filter((a) => a.status === 'done' || a.status === 'error').length;

  return React.createElement(
    Box,
    { flexDirection: 'column', marginBottom: 1 },
    React.createElement(
      Text,
      { dimColor: true },
      `Agents (${doneCount}/${agents.length}):`,
    ),
    ...agents.map((agent, i) =>
      React.createElement(
        Text,
        {
          key: `delegate-${i}`,
          color: STATUS_COLORS[agent.status],
          dimColor: agent.status === 'running' || agent.status === 'queued',
        },
        ' ',
        STATUS_ICONS[agent.status] || '▢',
        ' ',
        agentLabel(agent),
        // The error is the only thing that explains a row that stopped early,
        // so it is worth the width rather than leaving a bare ✗.
        agent.error ? ` — ${agent.error}` : '',
      ),
    ),
  );
}
