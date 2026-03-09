import React, { useState, useEffect, useRef } from 'react';

function SingleTerminal({ terminalId, name, output, running, cwd, projectRoot, onSubmit, onClear, onCancel }) {
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd || running || !window.electronAPI?.runCommand) return;
    onSubmit(cmd);
    setInput('');
  };

  const cwdDisplay = cwd || projectRoot || '';

  return (
    <div className="terminal-panel-single" data-terminal-id={terminalId}>
      <div className="terminal-panel-header">
        <span className="terminal-cwd" title={cwdDisplay}>{cwdDisplay || 'No folder'}</span>
        <div className="terminal-panel-actions">
          {running && (
            <button type="button" className="icon-btn" onClick={() => onCancel?.(terminalId)} title="Stop">■</button>
          )}
          <button type="button" className="icon-btn" onClick={() => onClear(terminalId)} title="Clear">Clear</button>
        </div>
      </div>
      <div className="terminal-output">
        {output.map((line, i) => (
          <pre key={i} className={`terminal-line ${line.type}`}>
            {line.text}
          </pre>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSubmit} className="terminal-input-row">
        <span className="terminal-prompt">$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command..."
          disabled={running}
          className="terminal-input"
          aria-label={`Command input for ${name}`}
        />
      </form>
    </div>
  );
}

let nextTerminalNumber = 1;
function createTerminal() {
  const id = `t${Date.now()}-${nextTerminalNumber++}`;
  return { id, name: `Terminal ${nextTerminalNumber}`, output: [], running: false };
}

export default function TerminalPanel({ projectRoot }) {
  const [terminals, setTerminals] = useState(() => [{ id: 'default', name: 'Terminal 1', output: [], running: false }]);
  const [activeId, setActiveId] = useState('default');
  const [cwdMap, setCwdMap] = useState({ default: projectRoot || '' });

  useEffect(() => {
    setCwdMap((prev) => ({ ...prev, default: projectRoot || prev.default }));
  }, [projectRoot]);

  useEffect(() => {
    if (!window.electronAPI?.onCommandOutput || !window.electronAPI?.onCommandExit) return;
    const unsubOut = window.electronAPI.onCommandOutput(({ terminalId, type, text }) => {
      const tid = terminalId ?? 'default';
      setTerminals((prev) =>
        prev.map((t) => (t.id === tid ? { ...t, output: [...t.output, { type, text }] } : t))
      );
    });
    const unsubExit = window.electronAPI.onCommandExit(({ terminalId }) => {
      const tid = terminalId ?? 'default';
      setTerminals((prev) =>
        prev.map((t) => (t.id === tid ? { ...t, running: false } : t))
      );
    });
    return () => {
      unsubOut();
      unsubExit();
    };
  }, []);

  const activeTerminal = terminals.find((t) => t.id === activeId) || terminals[0];

  const handleSubmit = (terminalId, cmd) => {
    const cwd = cwdMap[terminalId] ?? projectRoot;
    setTerminals((prev) =>
      prev.map((t) =>
        t.id === terminalId ? { ...t, output: [...t.output, { type: 'input', text: `$ ${cmd}` }], running: true } : t
      )
    );
    window.electronAPI?.runCommand?.({ terminalId, command: cmd, cwd: cwd || undefined }).catch((err) => {
      setTerminals((prev) =>
        prev.map((t) =>
          t.id === terminalId
            ? { ...t, output: [...t.output, { type: 'stderr', text: String(err?.message || err) }], running: false }
            : t
        )
      );
    });
  };

  const handleClear = (terminalId) => {
    setTerminals((prev) => prev.map((t) => (t.id === terminalId ? { ...t, output: [] } : t)));
  };

  const handleCancel = (terminalId) => {
    window.electronAPI?.cancelCommand?.(terminalId);
  };

  const addTerminal = () => {
    const t = createTerminal();
    setTerminals((prev) => [...prev, t]);
    setActiveId(t.id);
  };

  const closeTerminal = (id, e) => {
    e?.stopPropagation?.();
    if (terminals.length <= 1) return;
    setTerminals((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) {
      const rest = terminals.filter((t) => t.id !== id);
      setActiveId(rest[0]?.id ?? 'default');
    }
  };

  return (
    <div className="terminal-panel multi">
      <div className="terminal-tabs">
        {terminals.map((t) => (
          <div
            key={t.id}
            role="tab"
            aria-selected={activeId === t.id}
            className={`terminal-tab ${activeId === t.id ? 'active' : ''}`}
            onClick={() => setActiveId(t.id)}
          >
            <span className="terminal-tab-label">{t.name}</span>
            <button
              type="button"
              className="terminal-tab-close"
              onClick={(e) => closeTerminal(t.id, e)}
              disabled={terminals.length <= 1}
              aria-label={`Close ${t.name}`}
              title={terminals.length <= 1 ? 'At least one terminal required' : `Close ${t.name}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="terminal-tab-add"
          onClick={addTerminal}
          aria-label="New terminal"
          title="New terminal"
        >
          +
        </button>
      </div>
      {activeTerminal && (
        <SingleTerminal
          terminalId={activeTerminal.id}
          name={activeTerminal.name}
          output={activeTerminal.output}
          running={activeTerminal.running}
          cwd={cwdMap[activeTerminal.id]}
          projectRoot={projectRoot}
          onSubmit={(cmd) => handleSubmit(activeTerminal.id, cmd)}
          onClear={handleClear}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
