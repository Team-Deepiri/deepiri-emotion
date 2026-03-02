import React from 'react';

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
  showAIAssistant,
  onAIClick,
  onProblemsClick
}) {
  const line = cursorPosition?.lineNumber ?? '—';
  const col = cursorPosition?.column ?? '—';

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
        {editorFontSize != null && (
          <span className="status-item" title="Editor font size (Ctrl+Plus/Minus to zoom)">{editorFontSize}px</span>
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
