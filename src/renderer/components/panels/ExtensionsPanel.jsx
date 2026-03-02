import React from 'react';

const BUILTIN_EXTENSIONS = [
  { id: 'cyrex', name: 'Cyrex AI', description: 'Agent Playground, RAG, Workflows, task classification, challenge generation.', enabled: true },
  { id: 'helox', name: 'Helox Pipelines', description: 'Run training and RAG pipelines from the IDE with live output.', enabled: true },
  { id: 'github', name: 'GitHub', description: 'Sync issues and integrate with repositories.', enabled: true },
  { id: 'notion', name: 'Notion', description: 'Connect tasks and docs to Notion.', enabled: true }
];

/**
 * Extensions panel: built-in integrations and placeholder for future marketplace.
 */
export default function ExtensionsPanel() {
  return (
    <div className="extensions-panel">
      <div className="extensions-header">Extensions</div>
      <div className="extensions-list">
        <div className="extensions-section-title">Built-in</div>
        {BUILTIN_EXTENSIONS.map((ext) => (
          <div key={ext.id} className="extensions-item">
            <div className="extensions-item-name">{ext.name}</div>
            <div className="extensions-item-desc">{ext.description}</div>
            <span className="extensions-item-badge">{ext.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        ))}
      </div>
      <div className="extensions-placeholder">
        <p className="extensions-hint">Extension marketplace (install community extensions) coming in a future release.</p>
      </div>
    </div>
  );
}
