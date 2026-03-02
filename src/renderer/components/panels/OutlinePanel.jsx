import React from 'react';

/**
 * Document outline / symbols from Monaco getDocumentSymbols. Supports nested children.
 */
function flattenSymbols(symbols, out = []) {
  if (!symbols) return out;
  for (const s of symbols) {
    out.push(s);
    if (s.children?.length) flattenSymbols(s.children, out);
  }
  return out;
}

export default function OutlinePanel({ symbols = [], onSelectSymbol }) {
  const flat = flattenSymbols(symbols);
  if (flat.length === 0) {
    return (
      <div className="outline-panel">
        <div className="outline-header">Outline</div>
        <div className="outline-empty">No symbols for this document.</div>
      </div>
    );
  }

  const renderSymbol = (sym, depth = 0) => {
    const line = sym.range?.startLineNumber ?? 0;
    return (
      <div
        key={sym.name + line + (sym.range?.startColumn ?? 0)}
        className="outline-item"
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => onSelectSymbol && onSelectSymbol(sym)}
      >
        <span className="outline-icon">{sym.kind === 5 ? '◇' : sym.kind === 12 ? 'ƒ' : '·'}</span>
        <span className="outline-name">{sym.name}</span>
      </div>
    );
  };

  const renderWithDepth = (sym, depth = 0) => (
    <React.Fragment key={sym.name + (sym.range?.startLineNumber ?? 0)}>
      {renderSymbol(sym, depth)}
      {sym.children?.length ? sym.children.map((c) => renderWithDepth(c, depth + 1)) : null}
    </React.Fragment>
  );

  return (
    <div className="outline-panel">
      <div className="outline-header">Outline</div>
      <div className="outline-list">
        {symbols.map((sym) => renderWithDepth(sym))}
      </div>
    </div>
  );
}
