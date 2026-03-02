/**
 * Visual / no-code editor — canvas state, component definitions, export, undo.
 * The beast: real visual programming, not a toy.
 */

const STORAGE_KEY = 'deepiri_visual_canvas';
const HISTORY_MAX = 50;

export const COMPONENT_DEFS = {
  button: {
    label: 'Button',
    icon: '▢',
    defaultProps: { text: 'Click me', variant: 'primary' },
    propSchema: [
      { key: 'text', label: 'Label', type: 'string' },
      { key: 'variant', label: 'Variant', type: 'select', options: ['primary', 'secondary', 'outline', 'ghost'] }
    ]
  },
  text: {
    label: 'Text',
    icon: 'T',
    defaultProps: { content: 'Hello world', tag: 'p' },
    propSchema: [
      { key: 'content', label: 'Content', type: 'string' },
      { key: 'tag', label: 'Tag', type: 'select', options: ['p', 'h1', 'h2', 'h3', 'span'] }
    ]
  },
  input: {
    label: 'Input',
    icon: '◫',
    defaultProps: { placeholder: 'Enter text...', type: 'text' },
    propSchema: [
      { key: 'placeholder', label: 'Placeholder', type: 'string' },
      { key: 'type', label: 'Type', type: 'select', options: ['text', 'email', 'password', 'number'] }
    ]
  },
  image: {
    label: 'Image',
    icon: '🖼',
    defaultProps: { src: '', alt: 'Image' },
    propSchema: [
      { key: 'src', label: 'URL', type: 'string' },
      { key: 'alt', label: 'Alt text', type: 'string' }
    ]
  },
  container: {
    label: 'Container',
    icon: '▦',
    defaultProps: { layout: 'column', gap: 8, padding: 16 },
    propSchema: [
      { key: 'layout', label: 'Layout', type: 'select', options: ['row', 'column', 'grid'] },
      { key: 'gap', label: 'Gap', type: 'number' },
      { key: 'padding', label: 'Padding', type: 'number' }
    ]
  },
  card: {
    label: 'Card',
    icon: '▣',
    defaultProps: { title: 'Card', subtitle: '' },
    propSchema: [
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'subtitle', label: 'Subtitle', type: 'string' }
    ]
  },
  spacer: {
    label: 'Spacer',
    icon: '▤',
    defaultProps: { height: 24 },
    propSchema: [{ key: 'height', label: 'Height', type: 'number' }]
  }
};

const GRID_SIZE = 8;

export function snapToGrid(x, y) {
  return {
    x: Math.round(x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(y / GRID_SIZE) * GRID_SIZE
  };
}

export function getStoredCanvas(projectId = 'default') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const canvas = data[projectId] || data.default;
      if (canvas && Array.isArray(canvas.nodes)) return canvas;
    }
  } catch (_) {}
  return { nodes: [], viewport: { zoom: 1, panX: 0, panY: 0 } };
}

export function saveCanvasToStorage(projectId, canvas) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[projectId || 'default'] = { nodes: canvas.nodes || [], viewport: canvas.viewport || {} };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('visualEditorService: save failed', e);
  }
}

export function createNode(type, x, y, parentId = null) {
  const def = COMPONENT_DEFS[type];
  if (!def) return null;
  const id = `n-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    type,
    parentId: parentId || null,
    x: Math.round(x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(y / GRID_SIZE) * GRID_SIZE,
    width: type === 'container' ? 280 : type === 'card' ? 240 : 160,
    height: type === 'container' ? 120 : type === 'spacer' ? 24 : 40,
    props: { ...def.defaultProps }
  };
}

export function getRootNodes(nodes) {
  return (nodes || []).filter((n) => !n.parentId);
}

export function getChildNodes(nodes, parentId) {
  return (nodes || []).filter((n) => n.parentId === parentId);
}

function nodeToReactJSX(n, nodes, indent) {
  const def = COMPONENT_DEFS[n.type];
  if (!def) return [];
  const p = n.props || {};
  const lines = [];
  const pad = '  '.repeat(indent);
  if (n.type === 'button') {
    lines.push(`${pad}<button className="btn btn-${p.variant || 'primary'}">${(p.text || 'Button').replace(/"/g, '\\"')}</button>`);
  } else if (n.type === 'text') {
    const tag = p.tag || 'p';
    lines.push(`${pad}<${tag}>${(p.content || '').replace(/</g, '\\u003c')}</${tag}>`);
  } else if (n.type === 'input') {
    lines.push(`${pad}<input type="${p.type || 'text'}" placeholder="${(p.placeholder || '').replace(/"/g, '\\"')}" />`);
  } else if (n.type === 'image') {
    lines.push(`${pad}<img src="${(p.src || '').replace(/"/g, '\\"')}" alt="${(p.alt || '').replace(/"/g, '\\"')}" />`);
  } else if (n.type === 'container') {
    const children = getChildNodes(nodes, n.id);
    lines.push(`${pad}<div style={{ display: 'flex', flexDirection: '${p.layout || 'column'}', gap: ${p.gap ?? 8}, padding: ${p.padding ?? 16} }}>`);
    children.forEach((ch) => lines.push(...nodeToReactJSX(ch, nodes, indent + 1)));
    lines.push(`${pad}</div>`);
  } else if (n.type === 'card') {
    lines.push(`${pad}<div className="card">`);
    lines.push(`${pad}  <h3>${(p.title || 'Card').replace(/"/g, '\\"')}</h3>`);
    if (p.subtitle) lines.push(`${pad}  <p>${String(p.subtitle).replace(/"/g, '\\"')}</p>`);
    lines.push(`${pad}</div>`);
  } else if (n.type === 'spacer') {
    lines.push(`${pad}<div style={{ height: ${p.height ?? 24} }} />`);
  }
  return lines;
}

export function exportToReact(canvas) {
  const nodes = (canvas?.nodes || []).filter(Boolean);
  const roots = getRootNodes(nodes);
  const lines = [
    'import React from \'react\';',
    '',
    'export default function VisualScreen() {',
    '  return (',
    '    <div className="visual-screen" style={{ padding: 24 }}>'
  ];
  roots.forEach((n) => {
    const jsx = nodeToReactJSX(n, nodes, 0);
    jsx.forEach((line) => lines.push('    ' + line));
  });
  lines.push('    </div>');
  lines.push('  );');
  lines.push('}');
  return lines.join('\n');
}

export function exportToHTML(canvas) {
  const nodes = (canvas?.nodes || []).filter(Boolean);
  const parts = [];
  nodes.forEach((n) => {
    const p = n.props || {};
    if (n.type === 'button') parts.push(`<button>${(p.text || 'Button').replace(/</g, '&lt;')}</button>`);
    else if (n.type === 'text') parts.push(`<${p.tag || 'p'}>${(p.content || '').replace(/</g, '&lt;')}</${p.tag || 'p'}>`);
    else if (n.type === 'input') parts.push(`<input type="${p.type || 'text'}" placeholder="${(p.placeholder || '').replace(/"/g, '&quot;')}" />`);
    else if (n.type === 'image') parts.push(`<img src="${(p.src || '').replace(/"/g, '&quot;')}" alt="${(p.alt || '').replace(/"/g, '&quot;')}" />`);
    else if (n.type === 'card') parts.push(`<div class="card"><h3>${(p.title || 'Card').replace(/</g, '&lt;')}</h3></div>`);
    else if (n.type === 'spacer') parts.push(`<div style="height:${p.height ?? 24}px"></div>`);
  });
  return `<!DOCTYPE html>\n<html><body>\n${parts.join('\n')}\n</body></html>`;
}

export function pushHistory(history, canvas) {
  const next = [...history, JSON.parse(JSON.stringify(canvas))];
  return next.slice(-HISTORY_MAX);
}

export function popHistory(history) {
  if (history.length <= 1) return history;
  return history.slice(0, -1);
}
