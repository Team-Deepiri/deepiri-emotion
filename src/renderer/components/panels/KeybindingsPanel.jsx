import React, { useState } from 'react';

const DEFAULT_KEYBINDINGS = [
  { command: 'Open Folder', keys: 'Ctrl+O', category: 'File' },
  { command: 'New File', keys: 'Ctrl+N', category: 'File' },
  { command: 'Save', keys: 'Ctrl+S', category: 'File' },
  { command: 'Command Palette', keys: 'Ctrl+Shift+P', category: 'View' },
  { command: 'Quick Open (Go to File)', keys: 'Ctrl+P', category: 'View' },
  { command: 'Go to Line', keys: 'Ctrl+G', category: 'View' },
  { command: 'Focus Search in Files', keys: 'Ctrl+Shift+F', category: 'View' },
  { command: 'Format Document', keys: 'Alt+Shift+F', category: 'Editor' },
  { command: 'Toggle Terminal', keys: '', category: 'View' },
  { command: 'Toggle AI Assistant', keys: 'Click AI in status bar', category: 'View' },
  { command: 'New Task', keys: '', category: 'Task' },
  { command: 'Generate Challenge', keys: 'Ctrl+Shift+N', category: 'Task' }
];

export default function KeybindingsPanel({ keybindings = DEFAULT_KEYBINDINGS }) {
  const [filter, setFilter] = useState('');

  const filtered = filter.trim()
    ? keybindings.filter(
        (k) =>
          k.command.toLowerCase().includes(filter.toLowerCase()) ||
          k.keys.toLowerCase().includes(filter.toLowerCase())
      )
    : keybindings;

  const byCategory = filtered.reduce((acc, k) => {
    const cat = k.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(k);
    return acc;
  }, {});

  return (
    <div className="keybindings-panel">
      <div className="keybindings-header">
        <span>Keyboard Shortcuts</span>
        <input
          type="text"
          className="keybindings-search"
          placeholder="Search..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="keybindings-list">
        {Object.entries(byCategory).map(([category, list]) => (
          <div key={category} className="keybindings-category">
            <div className="keybindings-category-name">{category}</div>
            {list.map((k, i) => (
              <div key={i} className="keybindings-row">
                <span className="keybindings-command">{k.command}</span>
                <span className="keybindings-keys">{k.keys || '—'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
