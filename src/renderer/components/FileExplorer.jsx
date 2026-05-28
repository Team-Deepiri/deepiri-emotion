import React, { useState } from 'react';
import { FileIcon, FolderIcon, ChevronIcon } from './FileIcon';

const FileExplorer = ({ files = [], onFileSelect, onFileCreate, onFileDelete: _onFileDelete }) => {
  const [expanded, setExpanded] = useState({});
  const [selected, setSelected] = useState(null);

  const toggleExpand = (path) => {
    setExpanded(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleSelect = (file) => {
    setSelected(file.path);
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const renderFile = (file, depth = 0) => {
    const isExpanded = expanded[file.path];
    const isSelected = selected === file.path;
    const isFolder = file.type === 'folder';

    return (
      <div key={file.path} className="tree-node" style={{ paddingLeft: `${depth * 12}px` }}>
        <div
          className={`tree-item ${isSelected ? 'active' : ''} ${isFolder ? 'folder' : ''}`}
          onClick={() => isFolder ? toggleExpand(file.path) : handleSelect(file)}
        >
          {isFolder && (
            <span className="tree-chevron">
              <ChevronIcon expanded={isExpanded} />
            </span>
          )}
          <span className="tree-icon">
            {isFolder ? (
              <FolderIcon open={isExpanded} />
            ) : (
              <FileIcon filename={file.name} />
            )}
          </span>
          <span className="tree-name">{file.name}</span>
          {file.badge && <span className="file-badge">{file.badge}</span>}
        </div>
        {isFolder && isExpanded && file.children && (
          <div className="tree-children">
            {file.children.map(child => renderFile(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span>EXPLORER</span>
        <div className="file-actions">
          <button onClick={onFileCreate} title="New File" className="file-action-btn">+</button>
        </div>
      </div>
      <div className="file-tree">
        {files.map(file => renderFile(file))}
      </div>
    </div>
  );
};

export default FileExplorer;
