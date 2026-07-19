import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import { COMMANDS } from '../core/commands.js';
import { fuzzyFind } from '../agent/fileIndex.js';
import { Autocomplete } from './Autocomplete.js';

/** Finds the start index of the word immediately before `pos` (for Ctrl+W). */
export function wordDeleteStart(str, pos) {
  let i = pos;
  while (i > 0 && /\s/.test(str[i - 1])) i--;
  while (i > 0 && !/\s/.test(str[i - 1])) i--;
  return i;
}

/**
 * Determines the active autocomplete trigger from the current value/cursor:
 * - 'slash' when the whole input is still a bare "/command" being typed (no space yet).
 * - 'at' when the token under the cursor starts with '@'.
 * - null otherwise.
 */
export function detectTrigger(value, cursor) {
  if (value.startsWith('/') && !value.includes(' ')) {
    return { type: 'slash', query: value, tokenStart: 0, tokenEnd: value.length };
  }

  let start = cursor;
  while (start > 0 && !/\s/.test(value[start - 1])) start--;
  let end = cursor;
  while (end < value.length && !/\s/.test(value[end])) end++;
  const token = value.slice(start, end);

  if (token.startsWith('@')) {
    return { type: 'at', query: token.slice(1), tokenStart: start, tokenEnd: end };
  }

  return { type: null, query: '', tokenStart: cursor, tokenEnd: cursor };
}

export function PromptInput({ value, onChange, onSubmit, onClear, placeholder, pendingConfirmation, onConfirm, agentStatus, onCancel, workspaceDir }) {
  const [cursor, setCursor] = useState(value.length);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [fileMatches, setFileMatches] = useState([]);

  // value is controlled by the parent (submit/clear reset it externally) —
  // keep cursor in range whenever it changes out from under us.
  useEffect(() => {
    setCursor((c) => Math.min(c, value.length));
  }, [value]);

  const trigger = detectTrigger(value, cursor);

  // Reset selection/dismissal whenever the trigger context itself changes
  // (new type, or the query text changed) so Escape only hides the menu for
  // the query it was dismissed on — typing more re-opens it.
  useEffect(() => {
    setMenuIndex(0);
    setMenuDismissed(false);
  }, [trigger.type, trigger.query]);

  useEffect(() => {
    if (trigger.type !== 'at') {
      setFileMatches([]);
      return;
    }
    let cancelled = false;
    fuzzyFind(trigger.query, workspaceDir || process.cwd()).then((matches) => {
      if (!cancelled) setFileMatches(matches);
    });
    return () => {
      cancelled = true;
    };
  }, [trigger.type, trigger.query, workspaceDir]);

  const menuItems = trigger.type === 'slash'
    ? COMMANDS.filter((c) => c.name.startsWith(trigger.query)).map((c) => ({ label: c.name, description: c.description }))
    : trigger.type === 'at'
      ? fileMatches.map((f) => ({ label: f }))
      : [];

  const menuOpen = !menuDismissed && menuItems.length > 0;
  const clampedMenuIndex = Math.min(menuIndex, menuItems.length - 1);

  const completeWithItem = (item) => {
    if (trigger.type === 'slash') {
      const completed = `${item.label} `;
      onChange(completed);
      setCursor(completed.length);
    } else if (trigger.type === 'at') {
      const completed = `${value.slice(0, trigger.tokenStart)}@${item.label} ${value.slice(trigger.tokenEnd)}`;
      onChange(completed);
      setCursor(trigger.tokenStart + item.label.length + 2);
    }
    setMenuDismissed(true);
  };

  useInput((input, key) => {
    if (pendingConfirmation) {
      if (key.ctrl && input === 'c') {
        process.exit(0);
      }
      if (input === 'y' || input === 'Y') {
        if (typeof onConfirm === 'function') onConfirm(true);
        return;
      }
      if (input === 'n' || input === 'N' || key.escape) {
        if (typeof onConfirm === 'function') onConfirm(false);
        return;
      }
      return;
    }

    if (menuOpen) {
      if (key.upArrow) {
        setMenuIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setMenuIndex((i) => Math.min(menuItems.length - 1, i + 1));
        return;
      }
      if (key.tab || key.return) {
        completeWithItem(menuItems[clampedMenuIndex]);
        return;
      }
      if (key.escape) {
        setMenuDismissed(true);
        return;
      }
    }

    if (key.escape) {
      if (agentStatus && agentStatus !== 'idle' && typeof onCancel === 'function') {
        onCancel();
      } else if (value) {
        onChange('');
        setCursor(0);
      }
      return;
    }
    if (key.return) {
      if (key.shift) {
        onChange(value.slice(0, cursor) + '\n' + value.slice(cursor));
        setCursor((c) => c + 1);
        return;
      }
      onSubmit(value);
      return;
    }
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }
    if (key.ctrl && input === 'l') {
      if (typeof onClear === 'function') onClear();
      return;
    }
    if (key.leftArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.rightArrow) {
      setCursor((c) => Math.min(value.length, c + 1));
      return;
    }
    if (key.ctrl && input === 'a') {
      setCursor(0);
      return;
    }
    if (key.ctrl && input === 'e') {
      setCursor(value.length);
      return;
    }
    if (key.ctrl && input === 'w') {
      const start = wordDeleteStart(value, cursor);
      onChange(value.slice(0, start) + value.slice(cursor));
      setCursor(start);
      return;
    }
    if (key.backspace || key.delete) {
      if (cursor === 0) return;
      onChange(value.slice(0, cursor - 1) + value.slice(cursor));
      setCursor((c) => c - 1);
      return;
    }
    if (input) {
      onChange(value.slice(0, cursor) + input + value.slice(cursor));
      setCursor((c) => c + input.length);
    }
  });

  const menuElement = menuOpen
    ? React.createElement(Autocomplete, { items: menuItems, activeIndex: clampedMenuIndex })
    : null;

  if (!value) {
    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(
        Box,
        { flexDirection: 'row', gap: 1 },
        React.createElement(Text, { color: 'green' }, '>'),
        React.createElement(Text, { inverse: true }, ' '),
        React.createElement(Text, { color: 'gray' }, placeholder)
      ),
      menuElement
    );
  }

  const before = value.slice(0, cursor);
  const atCursor = value.slice(cursor, cursor + 1) || ' ';
  const after = value.slice(cursor + 1);

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      React.createElement(Text, { color: 'green' }, '>'),
      React.createElement(
        Text,
        { color: 'white' },
        before,
        React.createElement(Text, { inverse: true }, atCursor),
        after
      )
    ),
    menuElement
  );
}
