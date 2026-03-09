import React, { useState, useEffect, useRef } from 'react';
import './PipelinesView.css';

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
    <div className="pipelines-view">
      <div className="pipelines-sidebar-section">
        <div className="sidebar-header">
          <span>HELOX PIPELINES</span>
        </div>
        <p className="pipelines-desc">
          Run training pipelines from the desktop. Ensure Helox path is set and Python is available.
        </p>
        <div className="pipelines-field">
          <label>Pipeline</label>
          <select
            className="pipelines-select"
            value={selectedPipeline}
            onChange={(e) => setSelectedPipeline(e.target.value)}
          >
            {PIPELINES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="pipelines-actions">
          <button
            type="button"
            className="pipelines-btn pipelines-btn-run"
            onClick={handleRun}
            disabled={running}
          >
            {running ? 'Running…' : 'Run'}
          </button>
          {running && (
            <button
              type="button"
              className="pipelines-btn pipelines-btn-cancel"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
        </div>
        {heloxPath && (
          <p className="pipelines-helox-path">Helox: {heloxPath}</p>
        )}
      </div>
      <div className="pipelines-output">
        {output.length === 0 && !running && (
          <span className="pipelines-output-empty">Output will appear here when you run a pipeline.</span>
        )}
        {output.map((line, i) => (
          <pre
            key={i}
            className={`pipelines-output-line ${line.type}`}
          >
            {line.text}
          </pre>
        ))}
        {exitCode !== null && (
          <pre className="pipelines-exit">Exit code: {exitCode}</pre>
        )}
        <div ref={outputEndRef} />
      </div>
    </div>
  );
}
