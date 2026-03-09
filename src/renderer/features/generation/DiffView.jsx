import React from 'react';

/**
 * Simple diff view: original vs suggested. Apply replaces content; Reject closes.
 * Cursor-style "see proposed changes" then accept/reject.
 */
export default function DiffView({ original, suggested, fileName = '', onApply, onReject }) {
  const origLines = (original || '').split('\n');
  const suggLines = (suggested || '').split('\n');
  const _maxLines = Math.max(origLines.length, suggLines.length);

  return (
    <div className="diff-view">
      <div className="diff-view-header">
        <span className="diff-view-title">{fileName || 'Diff'}</span>
        <div className="diff-view-actions">
          <button type="button" className="diff-btn reject" onClick={onReject}>Reject</button>
          <button type="button" className="diff-btn apply" onClick={() => onApply(suggested)}>Apply</button>
        </div>
      </div>
      <div className="diff-view-body">
        <div className="diff-column">
          <div className="diff-column-header">Original</div>
          <div className="diff-column-content">
            {origLines.map((line, i) => (
              <div key={i} className="diff-line original">{line || ' '}</div>
            ))}
          </div>
        </div>
        <div className="diff-column">
          <div className="diff-column-header">Suggested</div>
          <div className="diff-column-content">
            {suggLines.map((line, i) => (
              <div key={i} className="diff-line suggested">{line || ' '}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
