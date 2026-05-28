import React from 'react';

const FileTypeIcons = {
  js: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#f7df1e"/>
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">JS</text>
    </svg>
  ),
  ts: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#3178c6"/>
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff">TS</text>
    </svg>
  ),
  jsx: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#61dafb"/>
      <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#000">JSX</text>
    </svg>
  ),
  tsx: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#3178c6"/>
      <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff">TSX</text>
    </svg>
  ),
  html: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#e34c26"/>
      <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#fff">HTML</text>
    </svg>
  ),
  css: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#264de4"/>
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff">CSS</text>
    </svg>
  ),
  json: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#cbcb41"/>
      <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#000">{}</text>
    </svg>
  ),
  md: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#083fa1"/>
      <text x="12" y="17" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">M</text>
    </svg>
  ),
  py: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#3776ab"/>
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ffd43b">Py</text>
    </svg>
  ),
  rs: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#dea584"/>
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#000">Rs</text>
    </svg>
  ),
  go: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '100%', height: '100%' }}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#00add8"/>
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff">Go</text>
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '100%', height: '100%' }}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
};

const FolderIcon = ({ open = false }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '100%', height: '100%' }}>
    {open ? (
      <>
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" fill="#f0a020" stroke="#f0a020"/>
        <path d="M2 10l3 2 3-2"/>
      </>
    ) : (
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" fill="#f0a020" stroke="#f0a020"/>
    )}
  </svg>
);

const ChevronIcon = ({ expanded = false }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    style={{ 
      width: '12px', 
      height: '12px',
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s ease'
    }}
  >
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

function getFileExtension(filename) {
  if (!filename) return 'default';
  const parts = filename.split('.');
  if (parts.length < 2) return 'default';
  return parts[parts.length - 1].toLowerCase();
}

export function getFileIcon(filename) {
  const ext = getFileExtension(filename);
  return FileTypeIcons[ext] || FileTypeIcons.default;
}

export function getFileIconClass(filename) {
  const ext = getFileExtension(filename);
  return `file-icon-${ext}`;
}

export function FileIcon({ filename, size = 16 }) {
  const ext = getFileExtension(filename);
  const icon = FileTypeIcons[ext] || FileTypeIcons.default;
  
  return (
    <div style={{ width: size, height: size }} className={`tree-icon ${getFileIconClass(filename)}`}>
      {icon}
    </div>
  );
}

export { FolderIcon, ChevronIcon, FileTypeIcons };
export default FileIcon;
