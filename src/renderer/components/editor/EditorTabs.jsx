import React from 'react';

function getTabIcon(name) {
  const ext = (name || '').split('.').pop() || '';
  const icons = { js: '⬡', ts: '⬡', jsx: '⚛', tsx: '⚛', py: '🐍', json: '{ }', md: '📝', html: '🌐', css: '🎨' };
  return icons[ext] || '📄';
}

export default function EditorTabs({ tabs, activeId, onSelect, onClose }) {
  return (
    <div className="editor-tabs">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`editor-tab ${activeId === tab.id ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          <span className="tab-icon">{getTabIcon(tab.name)}</span>
          <span className="tab-name" title={tab.path}>{tab.name}</span>
          <button
            type="button"
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
