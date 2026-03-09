import React, { useState, useEffect } from 'react';

const TIPS = [
  'Ctrl+Shift+N — Create anything launcher (templates, Visual, Emotion)',
  'Terminal panel: use + to add multiple terminals; each runs commands independently',
  'Emotion → Runtime subagents: register in-process agents on the Fabric bus',
  'Bottom panel Tools tab: run_command, read_file; register more via toolsRegistry',
  'Hooks: beforeSave, afterSave, afterOpen — register in code via hooksRegistry',
  'AI Chat header shows current model; change in Settings → AI Provider',
  'Workspace view: file list is your index; Refresh rebuilds. Indexing in Settings.',
  'Pick an agent (Code Reviewer, Docs, Refactor…) then Open AI Chat for focused help',
  'Ctrl+B — Toggle sidebar · Ctrl+J — Toggle bottom panel',
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
  onOpenWorkspace,
  onOpenSettings,
  recentFolders = [],
  recentFiles = [],
  onOpenRecentFolder,
  onOpenRecentFile
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
            <button type="button" className="welcome-btn ai-primary" onClick={onOpenAIChat} aria-label="Open AI Chat">
              Open AI Chat
            </button>
          )}
          {onOpenVisual && (
            <button type="button" className="welcome-btn ai-primary" onClick={onOpenVisual} aria-label="Open Visual canvas">
              Visual — No-code canvas
            </button>
          )}
          {onOpenEmotion && (
            <button type="button" className="welcome-btn ai-primary" onClick={onOpenEmotion} aria-label="Open Emotion panel">
              Emotion — AI partners
            </button>
          )}
          {onOpenCreateLauncher && (
            <button type="button" className="welcome-btn ai-primary" onClick={onOpenCreateLauncher} aria-label="Create anything (Ctrl+Shift+N)">
              Create anything (Ctrl+Shift+N)
            </button>
          )}
        </div>
      </section>

      <div className="welcome-sections">
        <section className="welcome-section">
          <h2>Start</h2>
          <div className="welcome-actions">
            <button type="button" className="welcome-btn primary" onClick={onOpenFolder} aria-label="Open folder">
              Open Folder
            </button>
            <button type="button" className="welcome-btn" onClick={onNewFile} aria-label="New file">
              New File
            </button>
            {onOpenWorkspace && (
              <button type="button" className="welcome-btn" onClick={onOpenWorkspace}>
                Workspace — view &amp; add files
              </button>
            )}
            {onOpenSettings && (
              <button type="button" className="welcome-btn" onClick={onOpenSettings}>
                Settings
              </button>
            )}
            <button type="button" className="welcome-btn" onClick={onQuickOpen}>
              Go to File… (Ctrl+P)
            </button>
            <button type="button" className="welcome-btn" onClick={onCommandPalette}>
              Command Palette (Ctrl+Shift+P)
            </button>
          </div>
        </section>

        {(recentFolders.length > 0 || recentFiles.length > 0) && (
          <section className="welcome-section">
            <h2>Recent</h2>
            {recentFolders.length > 0 && (
              <>
                <span className="welcome-recent-label">Folders</span>
                <ul className="welcome-recent-list">
                  {recentFolders.slice(0, 5).map((path) => (
                    <li key={path}>
                      <button type="button" className="welcome-recent-item" onClick={() => onOpenRecentFolder(path)}>
                        📁 {path.split(/[/\\]/).filter(Boolean).pop() || path}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {recentFiles.length > 0 && onOpenRecentFile && (
              <>
                <span className="welcome-recent-label">Files</span>
                <ul className="welcome-recent-list">
                  {recentFiles.slice(0, 8).map((f) => (
                    <li key={f.path || f.name}>
                      <button
                        type="button"
                        className="welcome-recent-item"
                        onClick={() => onOpenRecentFile(f)}
                      >
                        📄 {f.name || f.path?.split(/[/\\]/).pop() || f.path}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <section className="welcome-section">
          <h2>Features</h2>
          <ul className="welcome-features">
            <li>Code: Monaco editor, AI completion, format, find/replace</li>
            <li>Workspace: See files, add files/folders, open folder</li>
            <li>Settings: Account, Agents, Tabs, Networking, Indexing, Tools</li>
            <li>Visual: Drag-and-drop canvas, export to React/HTML</li>
            <li>Emotion: AI agents (Code Reviewer, Docs, Refactor, Test Writer…)</li>
            <li>AI Chat (context-aware, apply edits)</li>
            <li>Cyrex AI: Agent Playground, RAG, Workflows</li>
            <li>Terminal, Output, Debug Console, Ports, Problems</li>
          </ul>
        </section>

        <section className="welcome-section welcome-tips">
          <h2>Quick tips</h2>
          <ul className="welcome-tips-list">
            <li><kbd>Ctrl+Shift+P</kbd> — Command palette</li>
            <li><kbd>Ctrl+P</kbd> — Go to file</li>
            <li><kbd>Ctrl+G</kbd> — Go to line</li>
            <li><kbd>Ctrl+Plus / Ctrl+Minus</kbd> — Zoom editor</li>
            <li><kbd>Ctrl+B</kbd> — Toggle sidebar · <kbd>Ctrl+J</kbd> — Toggle panel</li>
            <li>Use <strong>Explain</strong>, <strong>Refactor</strong>, <strong>Add tests</strong> above the editor for one-click AI prompts</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
