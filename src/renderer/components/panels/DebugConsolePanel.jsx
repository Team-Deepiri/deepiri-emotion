import React from 'react';

/**
 * Debug Console panel — shows debug output, evaluated expressions, call stack placeholder.
 */
export default function DebugConsolePanel() {
  return (
    <div className="debug-console-panel">
      <div className="debug-console-panel-header">
        <span>Debug Console</span>
      </div>
      <div className="debug-console-content">
        <div className="debug-console-empty">
          Start a debug session or run with debugging to see output here.
        </div>
      </div>
    </div>
  );
}
