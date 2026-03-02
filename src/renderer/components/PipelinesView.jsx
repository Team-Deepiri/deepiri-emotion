import React, { useState, useEffect, useRef } from 'react';

const PIPELINES = [
  { id: 'full-training', label: 'Full Training Pipeline', description: 'Generate data, prepare, train, evaluate' },
  { id: 'quick-train', label: 'Quick Train', description: 'Fast training run' },
  { id: 'rag-training', label: 'RAG Training', description: 'RAG pipeline with config' }
];

export default function PipelinesView() {
  const [output, setOutput] = useState([]);
  const [running, setRunning] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState('full-training');
  const [exitCode, setExitCode] = useState(null);
  const [heloxPath, setHeloxPath] = useState('');
  const outputEndRef = useRef(null);

  useEffect(() => {
    if (window.electronAPI?.getConfig) {
      window.electronAPI.getConfig().then((c) => {
        if (c?.heloxPath) setHeloxPath(c.heloxPath);
      });
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onHeloxOutput || !window.electronAPI?.onHeloxExit) return;
    const unsubOut = window.electronAPI.onHeloxOutput(({ type, text }) => {
      setOutput((prev) => [...prev, { type, text }]);
    });
    const unsubExit = window.electronAPI.onHeloxExit(({ code, signal }) => {
      setRunning(false);
      setExitCode(code);
      setOutput((prev) => [...prev, { type: 'system', text: `\n--- Exit: ${code} ${signal || ''} ---\n` }]);
    });
    return () => {
      unsubOut();
      unsubExit();
    };
  }, []);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const handleRun = async () => {
    if (running || !window.electronAPI?.runHeloxPipeline) return;
    setOutput([]);
    setExitCode(null);
    setRunning(true);
    try {
      await window.electronAPI.runHeloxPipeline({
        pipelineId: selectedPipeline,
        cwd: heloxPath || undefined
      });
    } catch (err) {
      setOutput((prev) => [...prev, { type: 'stderr', text: String(err.message || err) }]);
      setRunning(false);
    }
  };

  const handleCancel = async () => {
    if (window.electronAPI?.cancelHeloxPipeline) {
      await window.electronAPI.cancelHeloxPipeline();
    }
  };

  return (
    <div className="pipelines-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
      <div className="pipelines-sidebar-section" style={{ marginBottom: 16 }}>
        <div className="sidebar-header" style={{ marginBottom: 8 }}>
          <span>HELOX PIPELINES</span>
        </div>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          Run training pipelines from the desktop. Ensure Helox path is set and Python is available.
        </p>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: '#aaa' }}>Pipeline</label>
          <select
            value={selectedPipeline}
            onChange={(e) => setSelectedPipeline(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              background: '#2d2d2d',
              color: '#eee',
              border: '1px solid #444',
              borderRadius: 4
            }}
          >
            {PIPELINES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleRun}
            disabled={running}
            style={{
              padding: '8px 16px',
              background: running ? '#555' : '#0e639c',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: running ? 'not-allowed' : 'pointer'
            }}
          >
            {running ? 'Running…' : 'Run'}
          </button>
          {running && (
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 16px',
                background: '#5a1e1e',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          )}
        </div>
        {heloxPath && (
          <p style={{ fontSize: 11, color: '#666', marginTop: 8 }}>Helox: {heloxPath}</p>
        )}
      </div>
      <div className="pipelines-output" style={{ flex: 1, minHeight: 200, background: '#1e1e1e', borderRadius: 4, padding: 12, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        {output.length === 0 && !running && (
          <span style={{ color: '#666' }}>Output will appear here when you run a pipeline.</span>
        )}
        {output.map((line, i) => (
          <pre
            key={i}
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: line.type === 'stderr' ? '#f48771' : line.type === 'system' ? '#569cd6' : '#d4d4d4'
            }}
          >
            {line.text}
          </pre>
        ))}
        {exitCode !== null && (
          <pre style={{ margin: 0, color: '#569cd6' }}>Exit code: {exitCode}</pre>
        )}
        <div ref={outputEndRef} />
      </div>
    </div>
  );
}
