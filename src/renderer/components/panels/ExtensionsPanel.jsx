import React, { useState, useEffect } from 'react';
import { api } from '../../api';

/**
 * Extensions panel: lists built-in extensions from extensions/ folder (via main process scanner).
 */
export default function ExtensionsPanel() {
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.listExtensions()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setExtensions(list);
      })
      .catch(() => {
        if (!cancelled) setExtensions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="extensions-panel">
      <div className="extensions-header">Extensions</div>
      <div className="extensions-list">
        <div className="extensions-section-title">Built-in</div>
        {loading ? (
          <p className="extensions-hint">Loading…</p>
        ) : extensions.length === 0 ? (
          <p className="extensions-hint">No built-in extensions found. Add extensions in the <code>extensions/</code> folder.</p>
        ) : (
          extensions.map((ext) => (
            <div key={ext.id} className="extensions-item">
              <div className="extensions-item-name">{ext.name}</div>
              <div className="extensions-item-desc">{ext.description}</div>
              <span className="extensions-item-badge">{ext.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          ))
        )}
      </div>
      <div className="extensions-placeholder">
        <p className="extensions-hint">Extension marketplace (install community extensions) coming in a future release.</p>
      </div>
    </div>
  );
}
