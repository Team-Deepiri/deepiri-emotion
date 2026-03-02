import React from 'react';

/**
 * Breadcrumb above editor: folder > file or path segments.
 */
export default function Breadcrumbs({ path, name }) {
  if (!path && !name) return null;

  const segments = path ? path.replace(/\\/g, '/').split('/').filter(Boolean) : [];
  const displayName = name || segments[segments.length - 1] || 'Untitled';

  return (
    <div className="breadcrumbs">
      {segments.length > 0 ? (
        <>
          {segments.slice(0, -1).map((seg, i) => (
            <span key={i} className="breadcrumb-segment">{seg}</span>
          ))}
          <span className="breadcrumb-segment active">{displayName}</span>
        </>
      ) : (
        <span className="breadcrumb-segment active">{displayName}</span>
      )}
    </div>
  );
}
