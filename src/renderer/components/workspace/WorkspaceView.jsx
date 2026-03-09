import React, { useState, useEffect, useCallback } from 'react';

function getFileIcon(name) {
  const ext = (name || '').split('.').pop() || '';
  const icons = { js: '⬡', ts: '⬡', jsx: '⚛', tsx: '⚛', py: '🐍', json: '{}', md: '📝', html: '🌐', css: '🎨' };
  return icons[ext] || '📄';
}

/**
 * Full workspace view: path, file/folder count, list of files, add/open/new actions.
 */
export default function WorkspaceView({
  projectRoot,
  onOpenFolder,
  onNewFile,
  onNewFolder,
  onOpenFile,
  refreshTrigger = 0
}) {
  const [list, setList] = useState({ files: [], totalFiles: 0, totalFolders: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectRoot || !window.electronAPI?.listWorkspaceFiles) return;
    setLoading(true);
    try {
      const data = await window.electronAPI.listWorkspaceFiles(projectRoot);
      setList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectRoot]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  if (!projectRoot) {
    return (
      <div className="workspace-view">
        <div className="workspace-view-header">
          <h2>Workspace</h2>
          <p className="workspace-view-desc">See what’s in your workspace and add files or folders.</p>
        </div>
        <div className="workspace-view-empty">
          <p>No folder opened.</p>
          <button type="button" className="btn-primary" onClick={onOpenFolder}>Open Folder</button>
        </div>
      </div>
    );
  }

  const displayPath = projectRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() || projectRoot;
  const fileList = list.files.filter((f) => !f.isDirectory).slice(0, 500);

  return (
    <div className="workspace-view">
      <div className="workspace-view-header">
        <h2>Workspace</h2>
        <p className="workspace-view-desc">Path: <code className="workspace-view-path" title={projectRoot}>{displayPath}</code></p>
        <div className="workspace-view-stats">
          <span>{list.totalFiles} files</span>
          <span>{list.totalFolders} folders</span>
        </div>
        <div className="workspace-view-actions">
          <button type="button" className="btn-secondary" onClick={onOpenFolder}>Open Folder</button>
          <button type="button" className="btn-secondary" onClick={onNewFile}>New File</button>
          <button type="button" className="btn-secondary" onClick={onNewFolder}>New Folder</button>
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </div>
      <div className="workspace-view-list-section">
        <h3>Files in workspace</h3>
        {loading ? (
          <div className="workspace-view-loading">Loading…</div>
        ) : (
          <ul className="workspace-file-list">
            {fileList.length === 0 && (
              <li className="workspace-file-list-empty">
                <span>No files in workspace.</span>
                <span className="workspace-file-list-hint">Use New File or Open Folder to get started.</span>
              </li>
            )}
            {fileList.map((f) => (
              <li key={f.path} className="workspace-file-list-item">
                <button type="button" onClick={() => onOpenFile?.({ path: f.path, name: f.name })} title={f.path} aria-label={`Open ${f.name}`}>
                  <span className="workspace-file-icon" aria-hidden>{getFileIcon(f.name)}</span>
                  <span className="workspace-file-path">{f.relativePath}</span>
                </button>
              </li>
            ))}
            {list.totalFiles > 500 && (
              <li className="workspace-file-list-more">… and {list.totalFiles - 500} more (use Explorer tree for full list)</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
