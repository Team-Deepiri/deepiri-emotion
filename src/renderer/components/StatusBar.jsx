import React from 'react';

const DEFAULT_ZOOM_FONT = 14;
function zoomPercent(fontSize) {
  if (fontSize == null) return null;
  return Math.round((fontSize / DEFAULT_ZOOM_FONT) * 100);
}

export default function StatusBar({
  cursorPosition,
  language,
  encoding = 'UTF-8',
  eol = 'LF',
  tabSize = 2,
  projectRoot,
  problemsCount = 0,
  theme = 'dark',
  wordCount = null,
  editorFontSize = null,
  onThemeCycle,
  onZoomClick,
  showAIAssistant,
  onAIClick,
  onProblemsClick,
  onTerminalClick,
  onOutputClick,
  onPanelClick
}) {
  const line = cursorPosition?.lineNumber ?? '—';
  const col = cursorPosition?.column ?? '—';
  const zoom = zoomPercent(editorFontSize);

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item" title="Line:Column">
          Ln {line}, Col {col}
        </span>
        <span className="status-item">{language || 'plaintext'}</span>
        {wordCount != null && (
          <span className="status-item" title="Word count">{wordCount} words</span>
        )}
        {zoom != null && (
          <span
            className="status-item status-clickable"
            title="Editor zoom (Ctrl+Plus/Minus). Click to zoom in."
            onClick={onZoomClick}
          >
            Zoom: {zoom}%
          </span>
        )}
        {editorFontSize != null && zoom == null && (
          <span className="status-item" title="Editor font size">{editorFontSize}px</span>
        )}
        <span className="status-item">Tab size: {tabSize}</span>
        <span className="status-item">{encoding}</span>
        <span className="status-item">{eol}</span>
        {projectRoot && (
          <span className="status-item" title={projectRoot}>
            📁 {projectRoot.split(/[/\\]/).pop() || projectRoot}
          </span>
        )}
        {onThemeCycle && (
          <span className="status-item status-clickable" onClick={onThemeCycle} title="Cycle theme">
            {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '◐'} {theme}
          </span>
        )}
        {onTerminalClick && (
          <span className="status-item status-clickable" onClick={onTerminalClick} title="Toggle Terminal (Ctrl+`)" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onTerminalClick()} aria-label="Toggle Terminal">Terminal</span>
        )}
        {onOutputClick && (
          <span className="status-item status-clickable" onClick={onOutputClick} title="Toggle Output" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOutputClick()} aria-label="Toggle Output">Output</span>
        )}
        {onPanelClick && (
          <span className="status-item status-clickable" onClick={onPanelClick} title="Toggle Panel (Ctrl+J)" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onPanelClick()} aria-label="Toggle bottom panel">Panel</span>
        )}
      </div>
      <div className="status-right">
        {problemsCount > 0 && (
          <span className="status-item problems-badge" onClick={onProblemsClick} role="button" tabIndex={0}>
            {problemsCount} problem(s)
          </span>
        )}
        {onAIClick && (
          <span
            className={`status-item status-clickable status-ai ${showAIAssistant ? 'active' : ''}`}
            onClick={onAIClick}
            title="Toggle AI panel"
          >
            AI
          </span>
        )}
        <span className="status-item">Deepiri Emotion</span>
      </div>
    </div>
  );
}
