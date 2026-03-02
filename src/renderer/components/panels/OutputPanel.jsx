import React from 'react';

export default function OutputPanel({ logs = [], onClear }) {
  return (
    <div className="output-panel">
      <div className="output-panel-header">
        <span>Output</span>
        <button type="button" className="icon-btn" onClick={onClear}>Clear</button>
      </div>
      <div className="output-content">
        {logs.length === 0 && (
          <div className="output-empty">Run a task or command to see output here.</div>
        )}
        {logs.map((log, i) => (
          <pre key={i} className={`output-line ${log.type || 'stdout'}`}>
            {log.text}
          </pre>
        ))}
      </div>
    </div>
  );
}
