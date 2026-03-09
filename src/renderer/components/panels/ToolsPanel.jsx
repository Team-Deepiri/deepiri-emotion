import React, { useState, useEffect } from 'react';
import { getTools, invokeTool } from '../../services/toolsRegistry';

export default function ToolsPanel() {
  const [tools, setTools] = useState([]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setTools(getTools());
  }, []);

  const handleInvoke = async (id, args = {}) => {
    setResult(null);
    try {
      const out = await invokeTool(id, args);
      setResult({ ok: true, data: out });
    } catch (e) {
      setResult({ ok: false, error: e?.message || String(e) });
    }
  };

  return (
    <div className="tools-panel">
      <div className="tools-panel-header">
        <h3>Tools</h3>
        <p className="tools-panel-desc">Callable tools for AI and automation. Built-in: run_command, read_file.</p>
      </div>
      <ul className="tools-list">
        {tools.length === 0 && (
          <li className="tools-empty">No tools registered. Built-in tools load when the app starts.</li>
        )}
        {tools.map((t) => (
          <li key={t.id} className="tools-item">
            <div className="tools-item-head">
              <span className="tools-item-name">{t.name}</span>
              <span className="tools-item-id">{t.id}</span>
            </div>
            {t.description && <p className="tools-item-desc">{t.description}</p>}
            {t.paramsSchema && (
              <p className="tools-item-params">
                Params: {typeof t.paramsSchema === 'object' ? JSON.stringify(t.paramsSchema) : t.paramsSchema}
              </p>
            )}
            {t.id === 'run_command' && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  const cmd = window.prompt('Command to run in terminal:');
                  if (cmd) handleInvoke('run_command', { command: cmd });
                }}
              >
                Run command…
              </button>
            )}
          </li>
        ))}
      </ul>
      {result && (
        <div className={`tools-result ${result.ok ? 'success' : 'error'}`}>
          <pre>{JSON.stringify(result.ok ? result.data : result.error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
