import React from 'react';

/**
 * Decked-out AI IDE welcome: AI first, then start, recent, features.
 */
export default function WelcomeScreen({
  onOpenFolder,
  onNewFile,
  onCommandPalette,
  onQuickOpen,
  onOpenAIChat,
  recentFolders = [],
  onOpenRecentFolder
}) {
  return (
    <div className="welcome-screen-full">
      <div className="welcome-brand">
        <h1>Deepiri IDE</h1>
        <p className="welcome-tagline">Decked-out AI-powered IDE — context-aware chat, apply edits, Cyrex & Helox</p>
      </div>

      {onOpenAIChat && (
        <section className="welcome-section welcome-ai-hero">
          <h2>✨ AI IDE</h2>
          <p className="welcome-ai-desc">Ask about your code, get edits applied in one click, or insert at cursor. Open a file and click AI in the status bar.</p>
          <div className="welcome-actions">
            <button type="button" className="welcome-btn ai-primary" onClick={onOpenAIChat}>
              Open AI Chat
            </button>
          </div>
        </section>
      )}

      <div className="welcome-sections">
        <section className="welcome-section">
          <h2>Start</h2>
          <div className="welcome-actions">
            <button type="button" className="welcome-btn primary" onClick={onOpenFolder}>
              Open Folder
            </button>
            <button type="button" className="welcome-btn" onClick={onNewFile}>
              New File
            </button>
            <button type="button" className="welcome-btn" onClick={onQuickOpen}>
              Go to File… (Ctrl+P)
            </button>
            <button type="button" className="welcome-btn" onClick={onCommandPalette}>
              Command Palette (Ctrl+Shift+P)
            </button>
          </div>
        </section>

        {recentFolders.length > 0 && (
          <section className="welcome-section">
            <h2>Recent</h2>
            <ul className="welcome-recent-list">
              {recentFolders.slice(0, 5).map((path) => (
                <li key={path}>
                  <button type="button" className="welcome-recent-item" onClick={() => onOpenRecentFolder(path)}>
                    {path.split(/[/\\]/).filter(Boolean).pop() || path}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="welcome-section">
          <h2>Features</h2>
          <ul className="welcome-features">
            <li>Monaco editor with syntax highlighting</li>
            <li>AI Chat (context-aware, apply edits)</li>
            <li>Cyrex AI: Agent Playground, RAG, Workflows</li>
            <li>Helox training pipelines</li>
            <li>Tasks, challenges, gamification</li>
            <li>Terminal, search, problems panel</li>
          </ul>
        </section>

        <section className="welcome-section welcome-tips">
          <h2>Quick tips</h2>
          <ul className="welcome-tips-list">
            <li><kbd>Ctrl+Shift+P</kbd> — Command palette</li>
            <li><kbd>Ctrl+P</kbd> — Go to file</li>
            <li><kbd>Ctrl+G</kbd> — Go to line</li>
            <li><kbd>Ctrl+Plus / Ctrl+Minus</kbd> — Zoom editor</li>
            <li>Use <strong>Explain</strong>, <strong>Refactor</strong>, <strong>Add tests</strong> above the editor for one-click AI prompts</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
