import React, { useState, useEffect } from 'react';

const TIPS = [
  'Ctrl+Shift+N — Create anything launcher (templates, Visual, Emotion)',
  'Use the Run chip to preview HTML in browser or run Node/Python in terminal',
  'Classify & Ask AI: classify selection then open AI with context',
  'Edit agent personality and system prompt in Emotion panel',
  'Visual canvas: Ctrl+C / Ctrl+V to copy and paste nodes',
  'Voice: mic in editor bar inserts at cursor; mic in chat appends to input',
];

/**
 * Decked-out AI IDE welcome: AI first, then start, recent, features.
 */
export default function WelcomeScreen({
  onOpenFolder,
  onNewFile,
  onCommandPalette,
  onQuickOpen,
  onOpenAIChat,
  onOpenVisual,
  onOpenEmotion,
  onOpenCreateLauncher,
  recentFolders = [],
  onOpenRecentFolder
}) {
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="welcome-screen-full">
      <div className="welcome-brand">
        <h1>Deepiri IDE</h1>
        <p className="welcome-tagline">Create anything. For everyone. With feeling. — Code, Visual, Emotion, Cyrex & Helox</p>
        <p className="welcome-tip">💡 {TIPS[tipIndex]}</p>
      </div>

      <section className="welcome-section welcome-ai-hero">
        <h2>✨ Create anything</h2>
        <p className="welcome-ai-desc">Code in the editor, build UIs in the Visual canvas, or pair with an emotional AI agent. No one has seen this before.</p>
        <div className="welcome-actions">
          {onOpenAIChat && (
            <button type="button" className="welcome-btn ai-primary" onClick={onOpenAIChat}>
              Open AI Chat
            </button>
          )}
          {onOpenVisual && (
            <button type="button" className="welcome-btn ai-primary" onClick={onOpenVisual}>
              Visual — No-code canvas
            </button>
          )}
          {onOpenEmotion && (
            <button type="button" className="welcome-btn ai-primary" onClick={onOpenEmotion}>
              Emotion — AI partners
            </button>
          )}
          {onOpenCreateLauncher && (
            <button type="button" className="welcome-btn ai-primary" onClick={onOpenCreateLauncher}>
              Create anything (Ctrl+Shift+N)
            </button>
          )}
        </div>
      </section>

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
            <li>Code: Monaco editor, AI completion, format, find/replace</li>
            <li>Visual: Drag-and-drop canvas, export to React/HTML</li>
            <li>Emotion: AI agents with personality (deepiri-emotion)</li>
            <li>AI Chat (context-aware, apply edits)</li>
            <li>Cyrex AI: Agent Playground, RAG, Workflows</li>
            <li>Helox training pipelines</li>
            <li>Terminal, search, problems, outline</li>
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
