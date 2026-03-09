import React, { useState } from 'react';

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
      <div key={file.path} style={{ paddingLeft: `${depth * 16}px` }}>
        <div
          className={`file-item ${isSelected ? 'selected' : ''}`}
          onClick={() => isFolder ? toggleExpand(file.path) : handleSelect(file)}
        >
          <span className="file-icon">
            {isFolder ? (isExpanded ? '📂' : '📁') : '📄'}
          </span>
          <span className="file-name">{file.name}</span>
          {file.badge && <span className="file-badge">{file.badge}</span>}
        </div>
        {isFolder && isExpanded && file.children && (
          <div>
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
          <button onClick={onFileCreate} title="New File">+</button>
        </div>
      </div>
      <div className="file-tree">
        {files.map(file => renderFile(file))}
      </div>
    </div>
  );
};

export default FileExplorer;

