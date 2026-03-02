import React, { useState, useEffect, useRef } from 'react';

export default function TerminalPanel({ projectRoot }) {
  const [output, setOutput] = useState([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [cwd, setCwd] = useState(projectRoot || '');
  const endRef = useRef(null);

  useEffect(() => {
    setCwd(projectRoot || '');
  }, [projectRoot]);

  useEffect(() => {
    if (!window.electronAPI?.onCommandOutput || !window.electronAPI?.onCommandExit) return;
    const unsubOut = window.electronAPI.onCommandOutput(({ type, text }) => {
      setOutput((prev) => [...prev, { type, text }]);
    });
    const unsubExit = window.electronAPI.onCommandExit(() => {
      setRunning(false);
      setOutput((prev) => [...prev, { type: 'system', text: '' }]);
    });
    return () => {
      unsubOut();
      unsubExit();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd || running || !window.electronAPI?.runCommand) return;
    setOutput((prev) => [...prev, { type: 'input', text: `$ ${cmd}` }]);
    setInput('');
    setRunning(true);
    try {
      await window.electronAPI.runCommand({ command: cmd, cwd: cwd || undefined });
    } catch (err) {
      setOutput((prev) => [...prev, { type: 'stderr', text: String(err.message) }]);
    }
    setRunning(false);
  };

  const handleClear = () => setOutput([]);

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <span>Terminal</span>
        <span className="terminal-cwd" title={cwd}>{cwd || 'No folder'}</span>
        <button type="button" className="icon-btn" onClick={handleClear}>Clear</button>
      </div>
      <div className="terminal-output" ref={endRef}>
        {output.map((line, i) => (
          <pre
            key={i}
            className={`terminal-line ${line.type}`}
          >
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
        />
      </form>
    </div>
  );
}
