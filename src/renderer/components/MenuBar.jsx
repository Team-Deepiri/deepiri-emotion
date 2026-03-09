import React, { useState, useRef, useEffect } from 'react';

/**
 * IDE-style top menu bar: File, Selection, View, Go, Run, Terminal, Help.
 * Dropdowns invoke onCommand(commandId).
 */
export default function MenuBar({ onCommand }) {
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenu]);

  const run = (id) => {
    onCommand?.(id);
    setOpenMenu(null);
  };

  const menus = [
    {
      label: 'File',
      items: [
        { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N' },
        { id: 'open-folder', label: 'Open Folder…', shortcut: 'Ctrl+K Ctrl+O' },
        { id: 'quick-open', label: 'Go to File…', shortcut: 'Ctrl+P' },
        { type: 'divider' },
        { id: 'save', label: 'Save', shortcut: 'Ctrl+S' },
        { type: 'divider' },
        { id: 'create-anything', label: 'Create anything…', shortcut: 'Ctrl+Shift+N' }
      ]
    },
    {
      label: 'Selection',
      items: [
        { id: 'classify-selection', label: 'Classify selection' },
        { id: 'classify-and-ask-ai', label: 'Classify and ask AI' },
        { type: 'divider' },
        { id: 'ask-ai-explain', label: 'Ask AI: Explain' },
        { id: 'ask-ai-refactor', label: 'Ask AI: Refactor' },
        { id: 'ask-ai-add-tests', label: 'Ask AI: Add tests' }
      ]
    },
    {
      label: 'View',
      items: [
        { id: 'toggle-sidebar', label: 'Toggle Primary Sidebar', shortcut: 'Ctrl+B' },
        { id: 'toggle-panel', label: 'Toggle Panel', shortcut: 'Ctrl+J' },
        { type: 'divider' },
        { id: 'outline', label: 'Outline' },
        { id: 'focus-search', label: 'Search in Files', shortcut: 'Ctrl+Shift+F' },
        { id: 'keybindings', label: 'Keyboard Shortcuts' },
        { id: 'extensions', label: 'Extensions' },
        { type: 'divider' },
        { id: 'settings', label: 'Settings' }
      ]
    },
    {
      label: 'Go',
      items: [
        { id: 'go-to-line', label: 'Go to Line…', shortcut: 'Ctrl+G' },
        { id: 'go-to-symbol', label: 'Go to Symbol in Editor…', shortcut: 'Ctrl+Shift+O' },
        { type: 'divider' },
        { id: 'find-in-file', label: 'Find in File', shortcut: 'Ctrl+F' },
        { id: 'replace-in-file', label: 'Replace in File', shortcut: 'Ctrl+H' }
      ]
    },
    {
      label: 'Run',
      items: [
        { id: 'run-preview', label: 'Run / Preview current file' },
        { id: 'open-finetuning', label: 'Fine-tuning panel' }
      ]
    },
    {
      label: 'Terminal',
      items: [
        { id: 'toggle-terminal', label: 'Toggle Terminal' },
        { id: 'toggle-output', label: 'Toggle Output' },
        { id: 'toggle-problems', label: 'Toggle Problems' },
        { id: 'toggle-debug-console', label: 'Debug Console' },
        { id: 'toggle-ports', label: 'Ports' }
      ]
    },
    {
      label: 'Help',
      items: [
        { id: 'open-guide', label: "What's New / Guide" },
        { id: 'command-palette', label: 'Command Palette…', shortcut: 'Ctrl+Shift+P' },
        { type: 'divider' },
        { id: 'about', label: 'About Deepiri Emotion' }
      ]
    }
  ];

  return (
    <div className="menu-bar" ref={menuRef}>
      {menus.map((menu) => (
        <div key={menu.label} className="menu-bar-item-wrap">
          <button
            type="button"
            className={`menu-bar-trigger ${openMenu === menu.label ? 'open' : ''}`}
            onClick={() => setOpenMenu((m) => (m === menu.label ? null : menu.label))}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <div className="menu-bar-dropdown">
              {menu.items.map((item, i) =>
                item.type === 'divider' ? (
                  <div key={`d-${i}`} className="menu-bar-divider" />
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    className="menu-bar-option"
                    onClick={() => run(item.id)}
                  >
                    <span className="menu-bar-option-label">{item.label}</span>
                    {item.shortcut && <span className="menu-bar-shortcut">{item.shortcut}</span>}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
