/**
 * Create-anything launcher — Code, Visual, Emotion, or from template.
 */

import React, { useState, useEffect, useRef } from 'react';
import './CreateLauncher.css';

const TEMPLATES = [
  { id: 'react-app', label: 'React app', desc: 'New React component', file: 'App.jsx', content: 'import React from \'react\';\n\nexport default function App() {\n  return <div>Hello</div>;\n}\n' },
  { id: 'typescript', label: 'TypeScript', desc: 'New .ts file', file: 'main.ts', content: 'function main(): void {\n  console.log("Hello");\n}\nmain();\n' },
  { id: 'python-script', label: 'Python script', desc: 'New .py file', file: 'main.py', content: 'def main():\n    print("Hello")\n\nif __name__ == "__main__":\n    main()\n' },
  { id: 'markdown', label: 'Markdown doc', desc: 'New .md file', file: 'doc.md', content: '# Title\n\nContent here.\n' },
  { id: 'json-config', label: 'JSON config', desc: 'New .json', file: 'config.json', content: '{\n  "name": "",\n  "version": "1.0.0"\n}\n' },
  { id: 'html-page', label: 'HTML page', desc: 'New .html', file: 'index.html', content: '<!DOCTYPE html>\n<html><head><title>Page</title></head><body></body></html>\n' },
  { id: 'css-file', label: 'CSS', desc: 'New .css file', file: 'styles.css', content: '/* Styles */\n.container {\n  padding: 1rem;\n}\n' },
  { id: 'vue-snippet', label: 'Vue SFC', desc: 'New .vue file', file: 'App.vue', content: '<template>\n  <div>Hello</div>\n</template>\n\n<script setup>\n</script>\n\n<style scoped>\n</style>\n' },
];

export default function CreateLauncher({ onClose, onOpenVisual, onOpenEmotion, onNewFileFromTemplate, projectRoot }) {
  const [choice, setChoice] = useState(null);
  const [template, setTemplate] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCode = () => { setChoice('code'); setTemplate(null); };
  const handleVisual = () => { onOpenVisual?.(); onClose(); };
  const handleEmotion = () => { onOpenEmotion?.(); onClose(); };
  const handleTemplate = (t) => {
    if (!t) return;
    if (onNewFileFromTemplate && projectRoot) {
      onNewFileFromTemplate(t.file, t.content);
      onClose();
    } else {
      window.toast?.('Open a folder first, then use New File or pick a template.');
    }
  };

  return (
    <div className="create-launcher-backdrop" onClick={onClose} ref={ref}>
      <div className="create-launcher" onClick={(e) => e.stopPropagation()}>
        <div className="create-launcher-header">
          <h2>Create anything</h2>
          <p>Code, visual, emotion, or start from a template</p>
          <button type="button" className="create-launcher-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="create-launcher-grid">
          <button type="button" className="create-launcher-card" onClick={handleCode}>
            <span className="create-launcher-icon">📝</span>
            <span className="create-launcher-title">Code</span>
            <span className="create-launcher-desc">New file in editor</span>
          </button>
          <button type="button" className="create-launcher-card" onClick={handleVisual}>
            <span className="create-launcher-icon">▦</span>
            <span className="create-launcher-title">Visual</span>
            <span className="create-launcher-desc">No-code canvas</span>
          </button>
          <button type="button" className="create-launcher-card" onClick={handleEmotion}>
            <span className="create-launcher-icon">❤</span>
            <span className="create-launcher-title">Emotion</span>
            <span className="create-launcher-desc">AI partners</span>
          </button>
        </div>
        <div className="create-launcher-templates">
          <h3>Templates</h3>
          <div className="create-launcher-template-list">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="create-launcher-template-btn" onClick={() => handleTemplate(t)}>
                <span>{t.label}</span>
                <span className="create-launcher-template-desc">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>
        {choice === 'code' && (
          <div className="create-launcher-code">
            <p>Use <kbd>Ctrl+N</kbd> or Command Palette → New File</p>
            <button type="button" onClick={() => { setChoice(null); onClose(); }}>Got it</button>
          </div>
        )}
      </div>
    </div>
  );
}
