import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Vertical resize handle (e.g. between sidebar and editor).
 * onResize(deltaPx) is called during drag with the movement amount (positive = right).
 */
export function ResizeHandleVertical({ onResize, onResizeEnd }) {
  const [dragging, setDragging] = useState(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    lastX.current = e.clientX;
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    };
    const up = () => {
      setDragging(false);
      onResizeEnd?.();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, onResize, onResizeEnd]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={`resize-handle resize-handle-vertical ${dragging ? 'resizing' : ''}`}
      onMouseDown={handleMouseDown}
      title="Drag to resize"
    />
  );
}

/**
 * Horizontal resize handle (e.g. top of bottom panel).
 * onResize(deltaPx) with positive = panel grows (drag down).
 */
export function ResizeHandleHorizontal({ onResize, onResizeEnd }) {
  const [dragging, setDragging] = useState(false);
  const lastY = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    lastY.current = e.clientY;
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const delta = e.clientY - lastY.current;
      lastY.current = e.clientY;
      onResize(delta);
    };
    const up = () => {
      setDragging(false);
      onResizeEnd?.();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, onResize, onResizeEnd]);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`resize-handle resize-handle-horizontal ${dragging ? 'resizing' : ''}`}
      onMouseDown={handleMouseDown}
      title="Drag to resize panel"
    />
  );
}
