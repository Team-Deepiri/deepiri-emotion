import React, { useState, useEffect, useRef } from 'react';

function flattenSymbols(symbols, out = []) {
  if (!symbols) return out;
  for (const s of symbols) {
    out.push(s);
    if (s.children?.length) flattenSymbols(s.children, out);
  }
  return out;
}

function symbolIcon(sym) {
  const k = sym.kind;
  if (k === 5) return '◇';  // Class
  if (k === 12) return 'ƒ';  // Function
  if (k === 6) return '◉';   // Method
  if (k === 7) return '▢';   // Module
  if (k === 13) return '§';  // Variable
  return '·';
}

export default function GoToSymbolModal({ isOpen, symbols = [], onSelect, onClose }) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const flat = flattenSymbols(symbols);
  const filtered = filter.trim()
    ? flat.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()))
    : flat;

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
      const sym = filtered[selectedIndex];
      if (sym?.range) {
        onSelect(sym);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop go-to-symbol-backdrop" onClick={onClose}>
      <div className="command-palette go-to-symbol-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          placeholder="Type to filter symbols (@ to show)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div ref={listRef} className="command-palette-list">
          {filtered.length === 0 ? (
            <div className="command-palette-item empty">
              {flat.length === 0 ? 'No symbols in this file' : 'No matching symbols'}
            </div>
          ) : (
            filtered.map((sym, i) => (
              <div
                key={`${sym.name}-${sym.range?.startLineNumber ?? 0}-${i}`}
                className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  if (sym.range) { onSelect(sym); onClose(); }
                }}
              >
                <span className="go-to-symbol-icon">{symbolIcon(sym)}</span>
                <span className="command-label">{sym.name}</span>
                <span className="go-to-symbol-line">:{sym.range?.startLineNumber ?? ''}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
