import React, { useState, useCallback, useRef, useEffect } from 'react';

export function SplitEditor({ 
  children, 
  direction = 'horizontal',
  minSize = 200,
  defaultSizes,
  onResize,
  className = ''
}) {
  const [sizes, setSizes] = useState(defaultSizes || [50, 50]);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const dragIndex = useRef(null);

  const childrenArray = React.Children.toArray(children);
  if (childrenArray.length < 2) {
    return children;
  }

  const handleMouseDown = useCallback((e, index) => {
    e.preventDefault();
    setIsDragging(true);
    dragIndex.current = index;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current || dragIndex.current === null) return;

    const rect = containerRef.current.getBoundingClientRect();
    const isHorizontal = direction === 'horizontal';
    const totalSize = isHorizontal ? rect.width : rect.height;
    const mousePos = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top;

    let newSizes = [...sizes];
    const idx = dragIndex.current;
    const prevSize = sizes[idx];
    const nextSize = sizes[idx + 1];
    
    const delta = ((mousePos / totalSize) * 100) - (prevSize);
    let newPrev = prevSize + delta;
    let newNext = nextSize - delta;

    if (newPrev < (minSize / totalSize) * 100) {
      newPrev = (minSize / totalSize) * 100;
      newNext = 100 - newPrev;
    }
    if (newNext < (minSize / totalSize) * 100) {
      newNext = (minSize / totalSize) * 100;
      newPrev = 100 - newNext;
    }

    newSizes[idx] = newPrev;
    newSizes[idx + 1] = newNext;

    setSizes(newSizes);
    onResize?.(newSizes);
  }, [isDragging, sizes, direction, minSize, onResize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragIndex.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div 
      ref={containerRef}
      className={`split-editor ${isHorizontal ? 'split-editor-h' : 'split-editor-v'} ${className}`}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        height: '100%',
        width: '100%'
      }}
    >
      {childrenArray.map((child, index) => (
        <React.Fragment key={index}>
          <div
            className="split-editor-pane"
            style={{
              flex: sizes[index] ? `0 0 ${sizes[index]}%` : 1,
              overflow: 'hidden'
            }}
          >
            {child}
          </div>
          {index < childrenArray.length - 1 && (
            <div
              className={`split-handle ${isDragging && dragIndex.current === index ? 'active' : ''}`}
              onMouseDown={(e) => handleMouseDown(e, index)}
              style={{
                [isHorizontal ? 'width' : 'height']: '4px',
                [isHorizontal ? 'cursor' : 'cursor']: isHorizontal ? 'col-resize' : 'row-resize',
                background: isDragging && dragIndex.current === index 
                  ? 'var(--focusBorder)' 
                  : 'var(--split-handle)',
                transition: 'background 0.15s ease'
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export function EditorGroup({ 
  children, 
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  showTabs = true,
  className = ''
}) {
  return (
    <div className={`editor-group ${className}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {showTabs && tabs && tabs.length > 0 && (
        <div className="editor-group-tabs" style={{
          display: 'flex',
          background: 'var(--editorGroupHeader-tabsBackground)',
          borderBottom: '1px solid var(--tab-border)'
        }}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`editor-tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => onSelectTab?.(tab.id)}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                background: tab.id === activeTabId ? 'var(--tab-activeBackground)' : 'var(--tab-inactiveBackground)',
                color: tab.id === activeTabId ? 'var(--tab-activeForeground)' : 'var(--tab-inactiveForeground)',
                borderBottom: tab.id === activeTabId ? '2px solid var(--tab-activeBorder)' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '100px',
                maxWidth: '200px',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.name}
              </span>
              {tab.dirty && (
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--color-orange)',
                  flexShrink: 0
                }} />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab?.(tab.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '2px',
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="editor-group-content" style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

export default SplitEditor;
