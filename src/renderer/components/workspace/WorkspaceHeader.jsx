import React from 'react';

/**
 * Workspace header: current path, Open Folder, New File, New Folder.
 * Shown when a folder is open; when no folder, shows empty state with Open Folder.
 */
export default function WorkspaceHeader({
  projectRoot,
  onOpenFolder,
  onNewFile,
  onNewFolder,
  onRefresh
}) {
  const displayPath = projectRoot
    ? projectRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() || projectRoot
    : null;

  if (!projectRoot) {
    return (
      <div className="workspace-header-bar workspace-header-empty">
        <span className="workspace-title">WORKSPACE</span>
        <p className="workspace-empty-message">No folder opened. Open a folder to see and add files.</p>
        <div className="workspace-actions">
          <button type="button" className="workspace-btn workspace-btn-primary" onClick={onOpenFolder}>
            Open Folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-header-bar">
      <span className="workspace-title">WORKSPACE</span>
      <div className="workspace-path-row">
        <span className="workspace-path" title={projectRoot}>{displayPath}</span>
        <button type="button" className="icon-btn" onClick={onRefresh} title="Refresh">↻</button>
      </div>
      <div className="workspace-actions">
        <button type="button" className="workspace-btn" onClick={onOpenFolder} title="Open another folder">
          Open Folder
        </button>
        <button type="button" className="workspace-btn" onClick={onNewFile} title="New file in workspace root">
          New File
        </button>
        <button type="button" className="workspace-btn" onClick={onNewFolder} title="New folder in workspace root">
          New Folder
        </button>
      </div>
    </div>
  );
}
