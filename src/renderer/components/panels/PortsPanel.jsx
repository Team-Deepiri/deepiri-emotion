import React from 'react';

/**
 * Ports panel — forwarded ports when debugging (VS Code–style).
 */
export default function PortsPanel() {
  return (
    <div className="ports-panel">
      <div className="ports-panel-header">
        <span>Ports</span>
      </div>
      <div className="ports-content">
        <div className="ports-empty">
          Forwarded ports will appear here when debugging or when processes listen on ports.
        </div>
      </div>
    </div>
  );
}
