import React, { useState, useEffect, useCallback } from 'react';

function TreeEntry({ entry, depth, selectedPath, onSelect, onRefresh, onCreateFile, onCreateFolder, onDelete, onRename }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);

  const loadChildren = useCallback(async () => {
    if (!entry.isDirectory || !window.electronAPI?.listDirectory) return;
    setLoading(true);
    try {
      const list = await window.electronAPI.listDirectory(entry.path);
      setChildren(list.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entry.path, entry.isDirectory]);

  useEffect(() => {
    if (expanded && entry.isDirectory) loadChildren();
  }, [expanded, entry.isDirectory, loadChildren]);

  const isSelected = selectedPath === entry.path;
  const handleClick = () => {
    if (entry.isDirectory) {
      setExpanded((e) => !e);
    } else {
      onSelect(entry);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleNewFile = async () => {
    const name = window.prompt('File name');
    if (!name) return closeContextMenu();
    const dir = entry.isDirectory ? entry.path : entry.path.replace(/\/[^/]+$/, '');
    try {
      await window.electronAPI.createFile({ dirPath: dir, name });
      if (entry.isDirectory && expanded) loadChildren();
      else if (!entry.isDirectory) onRefresh();
    } catch (err) {
      window.alert(err.message);
    }
    closeContextMenu();
  };

  const handleNewFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name) return closeContextMenu();
    const dir = entry.isDirectory ? entry.path : entry.path.replace(/\/[^/]+$/, '');
    try {
      await window.electronAPI.createFolder({ dirPath: dir, name });
      if (entry.isDirectory && expanded) loadChildren();
      else onRefresh();
    } catch (err) {
      window.alert(err.message);
    }
    closeContextMenu();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${entry.name}?`)) return closeContextMenu();
    try {
      await window.electronAPI.deletePath(entry.path);
      onRefresh();
    } catch (err) {
      window.alert(err.message);
    }
    closeContextMenu();
  };

  const handleRename = async () => {
    const newName = window.prompt('New name', entry.name);
    if (!newName || newName === entry.name) return closeContextMenu();
    try {
      await window.electronAPI.renamePath({ oldPath: entry.path, newName });
      onRefresh();
    } catch (err) {
      window.alert(err.message);
    }
    closeContextMenu();
  };

  return (
    <div className="tree-entry" onContextMenu={handleContextMenu}>
      <div
        className={`file-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        <span className="file-icon">
          {entry.isDirectory ? (expanded ? '📂' : '📁') : '📄'}
        </span>
        {entry.isDirectory && (
          <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
        )}
        <span className="file-name" title={entry.path}>{entry.name}</span>
      </div>
      {entry.isDirectory && expanded && (
        <div className="tree-children">
          {loading ? (
            <div style={{ paddingLeft: `${(depth + 1) * 12 + 8}px`, color: '#666' }}>Loading…</div>
          ) : (
            children.map((child) => (
              <TreeEntry
                key={child.path}
                entry={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onRefresh={onRefresh}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))
          )}
        </div>
      )}
      {contextMenu && (
        <>
          <div className="context-menu-backdrop" onClick={closeContextMenu} />
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button type="button" onClick={handleNewFile}>New File</button>
            <button type="button" onClick={handleNewFolder}>New Folder</button>
            <hr />
            <button type="button" onClick={handleRename}>Rename</button>
            <button type="button" onClick={handleDelete} className="danger">Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkspaceFileExplorer({ projectRoot, selectedPath, onSelectFile, onRefresh }) {
  const [rootEntries, setRootEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadRoot = useCallback(async () => {
    if (!projectRoot || !window.electronAPI?.listDirectory) return;
    setLoading(true);
    try {
      const list = await window.electronAPI.listDirectory(projectRoot);
      setRootEntries(list.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectRoot]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot, projectRoot]);

  if (!projectRoot) {
    return (
      <div className="workspace-file-explorer empty">
        <div className="workspace-header">
          <span>EXPLORER</span>
        </div>
        <div className="workspace-empty">
          <p>No folder opened</p>
          <p className="hint">File → Open Folder (or Ctrl+K Ctrl+O)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-file-explorer">
      <div className="workspace-header">
        <span>EXPLORER</span>
        <button type="button" className="icon-btn" onClick={loadRoot} title="Refresh">↻</button>
      </div>
      <div className="file-tree">
        {loading ? (
          <div className="tree-loading">Loading…</div>
        ) : (
          rootEntries.map((entry) => (
            <TreeEntry
              key={entry.path}
              entry={entry}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelectFile}
              onRefresh={loadRoot}
            />
          ))
        )}
      </div>
    </div>
  );
}
