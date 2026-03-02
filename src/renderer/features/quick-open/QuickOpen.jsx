import React, { useState, useEffect, useRef } from 'react';

/**
 * Cursor-style Quick Open: Ctrl+P for files, type to filter.
 * Shows open tabs + recent files + (if project) placeholder for full search.
 */
export default function QuickOpen({ isOpen, onClose, openTabs = [], projectRoot, onSelectFile, onSelectTab }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const recentFiles = (typeof window !== 'undefined' && window.recentService)
    ? window.recentService.getRecentFiles()
    : [];

  const openTabEntries = openTabs.map((t) => ({ type: 'tab', id: t.id, path: t.path, name: t.name }));
  const recentEntries = recentFiles
    .filter((f) => !openTabs.some((t) => t.path === f.path))
    .map((f) => ({ type: 'recent', path: f.path, name: f.name }));

  const all = [...openTabEntries, ...recentEntries];
  const filtered = query.trim()
    ? all.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
    : all.slice(0, 30);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex < 0) setSelectedIndex(filtered.length - 1);
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [selectedIndex, filtered.length]);

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
      const item = filtered[selectedIndex];
      if (item) {
        if (item.type === 'tab' && onSelectTab) onSelectTab(item.id);
        else if (onSelectFile) onSelectFile({ path: item.path, name: item.name });
        onClose();
      }
    }
  };

  const handleSelect = (item) => {
    if (item.type === 'tab' && onSelectTab) onSelectTab(item.id);
    else if (onSelectFile) onSelectFile({ path: item.path, name: item.name });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="quick-open-backdrop" onClick={onClose}>
      <div className="quick-open" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="quick-open-input"
          placeholder="Type to search files (Ctrl+P)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="quick-open-list">
          {filtered.length === 0 ? (
            <div className="quick-open-item empty">No files match</div>
          ) : (
            filtered.map((item, i) => (
              <div
                key={item.path || item.id}
                className={`quick-open-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(item)}
              >
                <span className="quick-open-name">{item.name}</span>
                <span className="quick-open-path">{item.path}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
