/**
 * Visual programming canvas — no-code UI builder.
 * Drag from palette, move on canvas, edit in property panel, export to code.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  COMPONENT_DEFS,
  getStoredCanvas,
  saveCanvasToStorage,
  createNode,
  snapToGrid,
  exportToReact,
  exportToHTML,
  pushHistory,
  popHistory
} from './visualEditorService.js';
import './visual-editor.css';

const PROJECT_ID = 'default';

export default function VisualCanvas({ onExportToFile }) {
  const [canvas, setCanvas] = useState(() => getStoredCanvas(PROJECT_ID));
  const [history, setHistory] = useState(() => [JSON.parse(JSON.stringify(getStoredCanvas(PROJECT_ID)))]);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, _setPan] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });
  const [_isDraggingFromPalette, setIsDraggingFromPalette] = useState(null);
  const [clipboardNodes, setClipboardNodes] = useState([]);
  const canvasRef = useRef(null);

  const nodes = canvas?.nodes || [];
  const selected = nodes.find((n) => n.id === selectedId);
  const canUndo = history.length > 1;

  const persist = useCallback((nextCanvas) => {
    setCanvas(nextCanvas);
    setHistory((h) => pushHistory(h, nextCanvas));
    saveCanvasToStorage(PROJECT_ID, nextCanvas);
  }, []);

  const updateNode = useCallback((id, updates) => {
    const nextNodes = nodes.map((n) => (n.id === id ? { ...n, ...updates } : n));
    persist({ ...canvas, nodes: nextNodes });
  }, [canvas, nodes, persist]);

  const updateNodeProps = useCallback((id, propKey, value) => {
    const nextNodes = nodes.map((n) => {
      if (n.id !== id) return n;
      const nextProps = { ...(n.props || {}), [propKey]: value };
      return { ...n, props: nextProps };
    });
    persist({ ...canvas, nodes: nextNodes });
  }, [canvas, nodes, persist]);

  const removeNode = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : prev));
    persist({ ...canvas, nodes: nodes.filter((n) => n.id !== id) });
  }, [canvas, nodes, persist]);

  const copyNodes = useCallback(() => {
    if (!selectedId || !selected) return;
    setClipboardNodes([{ ...selected, props: { ...(selected.props || {}) } }]);
  }, [selectedId, selected]);

  const pasteNodes = useCallback(() => {
    if (clipboardNodes.length === 0) return;
    const offset = 24;
    const newNodes = clipboardNodes.map((n) => ({
      ...n,
      id: `n-${n.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: n.x + offset,
      y: n.y + offset,
      props: { ...(n.props || {}) }
    }));
    persist({ ...canvas, nodes: [...nodes, ...newNodes] });
    setSelectedId(newNodes[0]?.id || null);
  }, [clipboardNodes, canvas, nodes, persist]);

  const duplicateNode = useCallback(() => {
    if (!selectedId || !selected) return;
    const clone = {
      ...selected,
      id: `n-${selected.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: selected.x + 20,
      y: selected.y + 20,
      props: { ...(selected.props || {}) }
    };
    persist({ ...canvas, nodes: [...nodes, clone] });
    setSelectedId(clone.id);
  }, [canvas, nodes, persist, selectedId, selected]);

  const zoomToFit = useCallback(() => {
    if (nodes.length === 0) { setZoom(1); return; }
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + (n.width || 160)));
    const maxY = Math.max(...nodes.map((n) => n.y + (n.height || 40)));
    const w = Math.max(400, maxX - minX + 80);
    const h = Math.max(300, maxY - minY + 80);
    const canvasEl = canvasRef.current;
    if (canvasEl) {
      const r = canvasEl.getBoundingClientRect();
      const scale = Math.min((r.width || 800) / w, (r.height || 600) / h, 2);
      setZoom(Math.max(0.25, Math.min(2, scale)));
    } else setZoom(1);
  }, [nodes]);

  const undo = useCallback(() => {
    if (history.length <= 1) return;
    const prev = popHistory(history);
    setHistory(prev);
    const restored = prev[prev.length - 1];
    setCanvas(restored);
    saveCanvasToStorage(PROJECT_ID, restored);
  }, [history]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          removeNode(selectedId);
        }
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        duplicateNode();
      }
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        copyNodes();
      }
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        pasteNodes();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, removeNode, undo, duplicateNode, copyNodes, pasteNodes]);

  const handlePaletteDragStart = (e, type) => {
    e.dataTransfer.setData('application/visual-component', type);
    e.dataTransfer.effectAllowed = 'copy';
    setIsDraggingFromPalette(type);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/visual-component');
    if (!type || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left - pan.x;
    const rawY = e.clientY - rect.top - pan.y;
    const { x, y } = snapToGrid(rawX / zoom, rawY / zoom);
    const node = createNode(type, x, y);
    if (node) {
      persist({ ...canvas, nodes: [...nodes, node] });
      setSelectedId(node.id);
    }
    setIsDraggingFromPalette(null);
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleNodeMouseDown = (e, node) => {
    if (e.target.closest('.visual-node-resize')) return;
    e.stopPropagation();
    setSelectedId(node.id);
    setDragNode(node);
    setDragOffset({
      dx: e.clientX - node.x,
      dy: e.clientY - node.y
    });
  };

  const handleGlobalMouseMove = useCallback((e) => {
    if (!dragNode) return;
    const { x, y } = snapToGrid(e.clientX - dragOffset.dx, e.clientY - dragOffset.dy);
    updateNode(dragNode.id, { x, y });
  }, [dragNode, dragOffset, updateNode]);

  const handleGlobalMouseUp = useCallback(() => {
    setDragNode(null);
  }, []);

  useEffect(() => {
    if (dragNode) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [dragNode, handleGlobalMouseMove, handleGlobalMouseUp]);

  const handleExportReact = () => {
    const code = exportToReact(canvas);
    if (onExportToFile && typeof onExportToFile === 'function') {
      onExportToFile('VisualScreen.jsx', code);
    } else {
      navigator.clipboard?.writeText(code);
      window.toast?.(code ? 'Copied React component to clipboard' : 'Nothing to export');
    }
  };

  const handleExportHTML = () => {
    const html = exportToHTML(canvas);
    if (onExportToFile && typeof onExportToFile === 'function') {
      onExportToFile('visual.html', html);
    } else {
      navigator.clipboard?.writeText(html);
      window.toast?.('Copied HTML to clipboard');
    }
  };

  const handleClear = () => {
    if (nodes.length === 0) return;
    if (window.confirm('Clear entire canvas? This cannot be undone.')) {
      persist({ ...canvas, nodes: [] });
      setSelectedId(null);
    }
  };

  return (
    <div className="visual-editor-root">
      <header className="visual-toolbar">
        <div className="visual-toolbar-left">
          <span className="visual-toolbar-title">Visual</span>
          <span className="visual-toolbar-subtitle">No-code canvas — drag, drop, export</span>
        </div>
        <div className="visual-toolbar-center">
          <div className="visual-palette">
            {Object.entries(COMPONENT_DEFS).map(([type, def]) => (
              <button
                key={type}
                type="button"
                className="visual-palette-btn"
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, type)}
                title={`Drag ${def.label} onto canvas`}
              >
                <span className="visual-palette-icon">{def.icon}</span>
                <span className="visual-palette-label">{def.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="visual-toolbar-right">
          <button type="button" className="visual-toolbar-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button type="button" className="visual-toolbar-btn" onClick={() => duplicateNode()} disabled={!selectedId} title="Duplicate (Ctrl+D)">
            Duplicate
          </button>
          <button type="button" className="visual-toolbar-btn" onClick={copyNodes} disabled={!selectedId} title="Copy (Ctrl+C)">
            Copy
          </button>
          <button type="button" className="visual-toolbar-btn" onClick={pasteNodes} disabled={clipboardNodes.length === 0} title="Paste (Ctrl+V)">
            Paste
          </button>
          <button type="button" className="visual-toolbar-btn" onClick={zoomToFit} title="Zoom to fit">
            Fit
          </button>
          <button type="button" className="visual-toolbar-btn" onClick={handleClear}>Clear</button>
          <div className="visual-zoom">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.25))}>+</button>
          </div>
          <button type="button" className="visual-toolbar-btn primary" onClick={handleExportReact}>
            Export React
          </button>
          <button type="button" className="visual-toolbar-btn" onClick={handleExportHTML}>
            Export HTML
          </button>
        </div>
      </header>

      <div className="visual-workspace">
        <div
          ref={canvasRef}
          className="visual-canvas-wrap"
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
          style={{ '--zoom': zoom, '--pan-x': pan.x, '--pan-y': pan.y }}
        >
          <div className="visual-canvas-grid" />
          <div className="visual-canvas-nodes">
            {nodes.map((node) => (
              <VisualNode
                key={node.id}
                node={node}
                isSelected={selectedId === node.id}
                zoom={zoom}
                onSelect={() => setSelectedId(node.id)}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
              />
            ))}
          </div>
          {nodes.length === 0 && (
            <div className="visual-canvas-empty">
              <p>Drag components from the toolbar above onto this canvas.</p>
              <p>Select a node to edit it in the properties panel. Delete key to remove.</p>
            </div>
          )}
        </div>

        {selected && (
          <aside className="visual-props-panel">
            <h3>Properties — {COMPONENT_DEFS[selected.type]?.label || selected.type}</h3>
            <div className="visual-props-list">
              {(COMPONENT_DEFS[selected.type]?.propSchema || []).map((field) => (
                <div key={field.key} className="visual-prop-row">
                  <label>{field.label}</label>
                  {field.type === 'string' && (
                    <input
                      type="text"
                      value={selected.props?.[field.key] ?? ''}
                      onChange={(e) => updateNodeProps(selected.id, field.key, e.target.value)}
                    />
                  )}
                  {field.type === 'number' && (
                    <input
                      type="number"
                      value={selected.props?.[field.key] ?? 0}
                      onChange={(e) => updateNodeProps(selected.id, field.key, Number(e.target.value))}
                    />
                  )}
                  {field.type === 'select' && (
                    <select
                      value={selected.props?.[field.key] ?? field.options[0]}
                      onChange={(e) => updateNodeProps(selected.id, field.key, e.target.value)}
                    >
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            <div className="visual-prop-row">
              <label>Parent container</label>
              <select
                value={selected.parentId || ''}
                onChange={(e) => updateNode(selected.id, { parentId: e.target.value || null })}
              >
                <option value="">None (root)</option>
{nodes.filter((n) => n.type === 'container' && n.id !== selected.id).map((n) => (
                <option key={n.id} value={n.id}>Container {n.id.slice(-6)}</option>
                ))}
              </select>
            </div>
            </div>
            <button type="button" className="visual-props-remove" onClick={() => removeNode(selected.id)}>
              Remove component
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}

function VisualNode({ node, isSelected, zoom, onSelect, onMouseDown }) {
  const _def = COMPONENT_DEFS[node.type];
  const { width = 160, height = 40, x: _x = 0, y: _y = 0, props = {} } = node;

  return (
    <div
      className={`visual-node ${isSelected ? 'selected' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width || width,
        height: node.height || height,
        transform: `scale(${zoom})`,
        transformOrigin: '0 0'
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={(e) => onMouseDown(e)}
    >
      <div className="visual-node-inner">
        {node.type === 'button' && <span className="visual-node-preview-btn">{props.text || 'Button'}</span>}
        {node.type === 'text' && <span className="visual-node-preview-text">{(props.content || 'Text').slice(0, 20)}{(props.content || '').length > 20 ? '…' : ''}</span>}
        {node.type === 'input' && <span className="visual-node-preview-input">{props.placeholder || 'Input'}</span>}
        {node.type === 'image' && <span className="visual-node-preview-img">{props.src ? '🖼' : 'Image'}</span>}
        {node.type === 'container' && <span className="visual-node-preview-box">{props.layout || 'column'}</span>}
        {node.type === 'card' && <span className="visual-node-preview-card">{props.title || 'Card'}</span>}
        {node.type === 'spacer' && <span className="visual-node-preview-spacer" style={{ height: props.height ?? 24 }} />}
      </div>
      {isSelected && <div className="visual-node-selection-ring" />}
    </div>
  );
}
