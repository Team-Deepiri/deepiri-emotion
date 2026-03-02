import React from 'react';

export default function ProblemsPanel({ problems = [], onSelect }) {
  const errors = problems.filter((p) => p.severity === 'error' || p.severity === 8);
  const warnings = problems.filter((p) => p.severity === 'warning' || p.severity === 4);

  return (
    <div className="problems-panel">
      <div className="problems-header">
        <span>Problems</span>
        <span className="problems-summary">
          {errors.length} error(s), {warnings.length} warning(s)
        </span>
      </div>
      <div className="problems-list">
        {problems.length === 0 && (
          <div className="problems-empty">No problems detected.</div>
        )}
        {problems.map((p, i) => (
          <div
            key={i}
            className={`problems-item severity-${p.severity === 'error' || p.severity === 8 ? 'error' : 'warning'}`}
            onClick={() => onSelect && onSelect(p)}
          >
            <span className="problems-icon">
              {p.severity === 'error' || p.severity === 8 ? '✕' : '⚠'}
            </span>
            <span className="problems-location">
              {p.path || p.resource?.path || '?'}:{p.line || p.range?.startLineNumber || 0}
            </span>
            <span className="problems-message">{p.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
