import React, { useState } from 'react';
import { DEFAULT_KEYBINDINGS } from '../../constants/keybindings';

export default function KeybindingsPanel({ keybindings = DEFAULT_KEYBINDINGS }) {
  const [filter, setFilter] = useState('');

  const filtered = filter.trim()
    ? keybindings.filter(
        (k) =>
          k.command.toLowerCase().includes(filter.toLowerCase()) ||
          k.keys.toLowerCase().includes(filter.toLowerCase())
      )
    : keybindings;

  return (
    <div className="keybindings-panel">
      <div className="keybindings-header">
        <input
          type="text"
          className="keybindings-search"
          placeholder="Search keybindings..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="keybindings-table-wrap">
        <table className="keybindings-table">
          <thead>
            <tr>
              <th className="keybindings-th-command">Command</th>
              <th className="keybindings-th-key">Keybinding</th>
              <th className="keybindings-th-category">Category</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((k, i) => (
              <tr key={`${k.command}-${i}`}>
                <td className="keybindings-command">{k.command}</td>
                <td className="keybindings-keys">{k.keys || '—'}</td>
                <td className="keybindings-category">{k.category || 'Other'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
