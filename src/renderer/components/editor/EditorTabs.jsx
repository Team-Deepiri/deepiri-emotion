import React, { useState, useRef, useEffect } from 'react';

function getTabIcon(name) {
  const ext = (name || '').split('.').pop() || '';
  const icons = { js: '⬡', ts: '⬡', jsx: '⚛', tsx: '⚛', py: '🐍', json: '{ }', md: '📝', html: '🌐', css: '🎨' };
  return icons[ext] || '📄';
}

export default function EditorTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  showFullPathInTab = false,
  doubleClickToClose = false
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const close = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) setOverflowOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [overflowOpen]);

  const tabLabel = (tab) => (showFullPathInTab && tab.path ? tab.path : tab.name);

  return (
    <div className="editor-tabs">
      <div className="editor-tabs-scroll">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`editor-tab ${activeId === tab.id ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}`}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => doubleClickToClose && onClose(tab.id)}
          >
            <span className="tab-icon">{getTabIcon(tab.name)}</span>
            <span className="tab-name" title={tab.path}>{tabLabel(tab)}</span>
            <button
              type="button"
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              aria-label={`Close ${tab.name}`}
              title={`Close ${tab.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {tabs.length > 0 && (
        <div className="editor-tabs-overflow" ref={overflowRef}>
          <button
            type="button"
            className="editor-tab-overflow-btn"
            onClick={() => setOverflowOpen((o) => !o)}
            title="More tabs"
            aria-label="More tabs"
            aria-expanded={overflowOpen}
          >
            ···
          </button>
          {overflowOpen && (
            <div className="editor-tabs-overflow-menu">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`editor-tab-overflow-item ${activeId === tab.id ? 'active' : ''}`}
                  onClick={() => { onSelect(tab.id); setOverflowOpen(false); }}
                >
                  <span className="tab-icon">{getTabIcon(tab.name)}</span>
                  <span className="tab-name">{tabLabel(tab)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
