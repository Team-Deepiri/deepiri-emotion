import React, { useState, useEffect, useRef } from 'react';

const COMMANDS = [
  { id: 'create-anything', label: 'Create anything (launcher)', shortcut: 'Ctrl+Shift+N' },
  { id: 'open-folder', label: 'Open Folder', shortcut: 'Ctrl+K Ctrl+O' },
  { id: 'quick-open', label: 'Go to File…', shortcut: 'Ctrl+P' },
  { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N' },
  { id: 'save', label: 'Save', shortcut: 'Ctrl+S' },
  { id: 'toggle-terminal', label: 'Toggle Terminal' },
  { id: 'toggle-output', label: 'Toggle Output' },
  { id: 'toggle-problems', label: 'Toggle Problems' },
  { id: 'toggle-ai', label: 'Toggle AI Chat (Ask AI)', shortcut: 'Click AI in status bar' },
  { id: 'ask-ai-explain', label: 'Ask AI: Explain selection or file' },
  { id: 'ask-ai-refactor', label: 'Ask AI: Refactor selection or file' },
  { id: 'ask-ai-add-tests', label: 'Ask AI: Add tests for selection or file' },
  { id: 'classify-selection', label: 'Classify selection (intent/domain)' },
  { id: 'classify-and-ask-ai', label: 'Classify and ask AI' },
  { id: 'command-palette', label: 'Command Palette', shortcut: 'Ctrl+Shift+P' },
  { id: 'keybindings', label: 'Open Keyboard Shortcuts' },
  { id: 'extensions', label: 'Open Extensions' },
  { id: 'outline', label: 'Toggle Outline' },
  { id: 'go-to-line', label: 'Go to Line…', shortcut: 'Ctrl+G' },
  { id: 'find-in-file', label: 'Find in File', shortcut: 'Ctrl+F' },
  { id: 'replace-in-file', label: 'Replace in File', shortcut: 'Ctrl+H' },
  { id: 'format-document', label: 'Format Document', shortcut: 'Alt+Shift+F' },
  { id: 'run-preview', label: 'Run or preview current file' },
  { id: 'focus-search', label: 'Focus Search in Files', shortcut: 'Ctrl+Shift+F' },
  { id: 'open-visual', label: 'Open Visual canvas' },
  { id: 'open-emotion', label: 'Open Emotion (AI partners)' },
  { id: 'open-finetuning', label: 'Open Fine-tuning panel' },
  { id: 'open-guide', label: "Open Guide (What's new)" },
  { id: 'new-task', label: 'New Task' },
  { id: 'settings', label: 'Open Settings' }
];

export default function CommandPalette({ isOpen, onClose, onCommand }) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setFilter('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    if (selectedIndex < 0) setSelectedIndex(filtered.length - 1);
    if (selectedIndex >= filtered.length) setSelectedIndex(0);
  }, [selectedIndex, filtered.length]);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      const child = el.children[selectedIndex];
      child?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => i + 1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => i - 1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd) {
        onCommand(cmd.id);
        onClose();
      }
    }
  };

  const handleSelect = (id) => {
    onCommand(id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          placeholder="Type a command..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div ref={listRef} className="command-palette-list">
          {filtered.length === 0 ? (
            <div className="command-palette-item empty">No commands found</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(cmd.id)}
              >
                <span className="command-label">{cmd.label}</span>
                {cmd.shortcut && (
                  <span className="command-shortcut">{cmd.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
