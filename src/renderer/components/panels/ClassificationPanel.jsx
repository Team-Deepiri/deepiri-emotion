/**
 * Classification strip — last result + history. Embedded intelligence.
 */

import React, { useState } from 'react';
import { classifySelection } from '../../services/classificationService';
import './ClassificationPanel.css';

const MAX_HISTORY = 10;

export default function ClassificationPanel({ selection, onClassify, history: externalHistory }) {
  const [last, setLast] = useState(null);
  const [history, setHistory] = useState(externalHistory || []);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const runClassify = async () => {
    const text = (selection || '').trim();
    if (!text) return;
    setLoading(true);
    try {
      const r = await classifySelection(text);
      setLast(r);
      setHistory((prev) => [{ ...r, text: text.slice(0, 60), at: new Date().toISOString() }, ...prev].slice(0, MAX_HISTORY));
      onClassify?.(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`classification-panel ${expanded ? 'expanded' : ''}`}>
      <div className="classification-bar">
        <button type="button" className="classification-toggle" onClick={() => setExpanded((e) => !e)} title="Classification">
          Intent
        </button>
        {last ? (
          <span className="classification-last">
            <span className="classification-label">{last.label}</span>
            <span className="classification-conf">{Math.round((last.confidence || 0) * 100)}%</span>
          </span>
        ) : (
          <span className="classification-hint">Select text, then classify</span>
        )}
        <button type="button" className="classification-run" onClick={runClassify} disabled={loading || !selection?.trim()}>
          {loading ? '…' : 'Classify'}
        </button>
      </div>
      {expanded && (
        <div className="classification-history">
          <div className="classification-history-title">History</div>
          {history.length === 0 ? (
            <div className="classification-history-empty">No classifications yet</div>
          ) : (
            <ul className="classification-history-list">
              {history.map((h, i) => (
                <li key={i}>
                  <span className="classification-h-label">{h.label}</span>
                  <span className="classification-h-conf">{Math.round((h.confidence || 0) * 100)}%</span>
                  <span className="classification-h-text" title={h.text}>{h.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
