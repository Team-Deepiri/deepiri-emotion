import React, { useState } from 'react';

const DEFAULT_KEYBINDINGS = [
  { command: 'Create anything (launcher)', keys: 'Ctrl+Shift+N', category: 'File' },
  { command: 'Open Folder', keys: 'Ctrl+O', category: 'File' },
  { command: 'New File', keys: 'Ctrl+N', category: 'File' },
  { command: 'Save', keys: 'Ctrl+S', category: 'File' },
  { command: 'Command Palette', keys: 'Ctrl+Shift+P', category: 'View' },
  { command: 'Quick Open (Go to File)', keys: 'Ctrl+P', category: 'View' },
  { command: 'Go to Line', keys: 'Ctrl+G', category: 'View' },
  { command: 'Open Guide', keys: 'Command palette', category: 'View' },
  { command: 'Open Visual canvas', keys: 'Command palette', category: 'View' },
  { command: 'Open Emotion (AI partners)', keys: 'Command palette', category: 'View' },
  { command: 'Open Fine-tuning panel', keys: 'Command palette', category: 'View' },
  { command: 'Find in File', keys: 'Ctrl+F', category: 'Editor' },
  { command: 'Replace in File', keys: 'Ctrl+H', category: 'Editor' },
  { command: 'Focus Search in Files', keys: 'Ctrl+Shift+F', category: 'View' },
  { command: 'Format Document', keys: 'Alt+Shift+F', category: 'Editor' },
  { command: 'Run or preview file', keys: 'Command palette / Run chip', category: 'Editor' },
  { command: 'Classify selection', keys: 'Command palette / Classify chip', category: 'Editor' },
  { command: 'Classify and ask AI', keys: 'Command palette / chip', category: 'Editor' },
  { command: 'Zoom In', keys: 'Ctrl+Plus', category: 'View' },
  { command: 'Zoom Out', keys: 'Ctrl+Minus', category: 'View' },
  { command: 'Reset Zoom', keys: 'Ctrl+0', category: 'View' },
  { command: 'Visual: Duplicate node', keys: 'Ctrl+D', category: 'Visual' },
  { command: 'Visual: Copy / Paste', keys: 'Ctrl+C / Ctrl+V', category: 'Visual' },
  { command: 'Toggle Terminal', keys: '', category: 'View' },
  { command: 'Toggle AI Assistant', keys: 'Click AI in status bar', category: 'View' },
  { command: 'New Task', keys: '', category: 'Task' },
  { command: 'Generate Challenge', keys: '', category: 'Task' }
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
