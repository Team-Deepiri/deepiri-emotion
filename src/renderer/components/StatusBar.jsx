import React from 'react';

const DEFAULT_ZOOM_FONT = 14;
function zoomPercent(fontSize) {
  if (fontSize == null) return null;
  return Math.round((fontSize / DEFAULT_ZOOM_FONT) * 100);
}

const GitIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="18" r="3"/>
    <circle cx="6" cy="6" r="3"/>
    <circle cx="18" cy="6" r="3"/>
    <path d="M6 9v12"/>
    <path d="M18 9v12"/>
    <path d="M6 6h12"/>
  </svg>
);

const TerminalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);

const OutputIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M7 8h10"/>
    <path d="M7 12h6"/>
  </svg>
);

const MinimizeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
  </svg>
);

const ThemeIcon = ({ theme }) => {
  if (theme === 'dark') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
      </svg>
    );
  } else if (theme === 'light') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 000 20z"/>
    </svg>
  );
};

const ErrorIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

const WarningIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 22h20L12 2zm0 15a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm0-8a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1z"/>
  </svg>
);

const AIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1a7 7 0 01-7 7h-1v1.27c.6.34 1 .99 1 1.73a2 2 0 01-2 2 2 2 0 01-2-2c0-.74.4-1.39 1-1.73V17h-1a7 7 0 01-7-7H4a1 1 0 010-2h1a7 7 0 017-7h1V5.27C9.4 4.93 9 4.28 9 3.54a2 2 0 012-2z"/>
  </svg>
);

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
  onPanelClick,
  minimapEnabled = true,
  onMinimapToggle,
  gitBranch = null,
  errorsCount = 0,
  warningsCount = 0,
  indentationGuide = false,
  onIndentationToggle,
}) {
  const line = cursorPosition?.lineNumber ?? '—';
  const col = cursorPosition?.column ?? '—';
  const zoom = zoomPercent(editorFontSize);
  const langDisplay = language ? language.toLowerCase() : 'plain text';

  return (
    <div className="status-bar">
      <div className="status-left">
        {gitBranch && (
          <span className="status-item status-git-branch" title={`Git branch: ${gitBranch}`}>
            <GitIcon />
            {gitBranch}
          </span>
        )}
        <span className="status-item" title="Line:Column">
          Ln {line}, Col {col}
        </span>
        <span className="status-item status-language" title="File language">
          {langDisplay}
        </span>
        <span className="status-item status-encoding" title="File encoding">
          {encoding}
        </span>
        <span className="status-item status-line-ending" title="Line ending">
          {eol}
        </span>
        <span className="status-item" title="Tab size">
          Spaces: {tabSize}
        </span>
        {onIndentationToggle && (
          <span 
            className={`status-item status-clickable ${indentationGuide ? 'active' : ''}`}
            onClick={onIndentationToggle}
            title="Toggle indentation guides"
            style={{ opacity: indentationGuide ? 1 : 0.5 }}
          >
            Indent
          </span>
        )}
        {wordCount != null && (
          <span className="status-item" title="Word count">
            {wordCount} words
          </span>
        )}
        <span className="status-item status-zoom" title="Editor font size">
          {editorFontSize || 14}px
        </span>
        {projectRoot && (
          <span className="status-item" title={projectRoot}>
            {projectRoot.split(/[/\\]/).pop() || projectRoot}
          </span>
        )}
      </div>
      
      <div className="status-right">
        {errorsCount > 0 && (
          <span 
            className="status-item status-problems errors" 
            onClick={onProblemsClick}
            role="button"
            tabIndex={0}
            title={`${errorsCount} error(s)`}
          >
            <ErrorIcon />
            {errorsCount}
          </span>
        )}
        {warningsCount > 0 && (
          <span 
            className="status-item status-problems warnings" 
            onClick={onProblemsClick}
            role="button"
            tabIndex={0}
            title={`${warningsCount} warning(s)`}
          >
            <WarningIcon />
            {warningsCount}
          </span>
        )}
        {problemsCount > 0 && errorsCount === 0 && warningsCount === 0 && (
          <span 
            className="status-item status-problems-info problems-badge" 
            onClick={onProblemsClick}
            role="button"
            tabIndex={0}
            title={`${problemsCount} problem(s)`}
          >
            {problemsCount}
          </span>
        )}
        {onMinimapToggle && (
          <span 
            className={`status-item status-clickable status-minimap-toggle ${minimapEnabled ? 'active' : ''}`}
            onClick={onMinimapToggle}
            title="Toggle minimap"
          >
            <MinimizeIcon />
          </span>
        )}
        {onTerminalClick && (
          <span 
            className="status-item status-clickable" 
            onClick={onTerminalClick} 
            title="Toggle Terminal (Ctrl+`)" 
            role="button" 
            tabIndex={0}
            aria-label="Toggle Terminal"
          >
            <TerminalIcon />
          </span>
        )}
        {onOutputClick && (
          <span 
            className="status-item status-clickable" 
            onClick={onOutputClick} 
            title="Toggle Output" 
            role="button" 
            tabIndex={0}
            aria-label="Toggle Output"
          >
            <OutputIcon />
          </span>
        )}
        {onPanelClick && (
          <span 
            className="status-item status-clickable" 
            onClick={onPanelClick} 
            title="Toggle Panel (Ctrl+J)" 
            role="button" 
            tabIndex={0}
            aria-label="Toggle bottom panel"
          >
            Panel
          </span>
        )}
        {onThemeCycle && (
          <span 
            className="status-item status-clickable" 
            onClick={onThemeCycle} 
            title="Cycle theme"
          >
            <ThemeIcon theme={theme} />
          </span>
        )}
        {onZoomClick && (
          <span 
            className="status-item status-clickable" 
            onClick={onZoomClick}
            title="Adjust zoom"
          >
            {zoom != null ? `${zoom}%` : '100%'}
          </span>
        )}
        {onAIClick && (
          <span
            className={`status-item status-clickable status-ai ${showAIAssistant ? 'active' : ''}`}
            onClick={onAIClick}
            title="Toggle AI panel"
          >
            <AIcon />
            AI
          </span>
        )}
        <span className="status-item status-brand">
          Deepiri
        </span>
      </div>
    </div>
  );
}
