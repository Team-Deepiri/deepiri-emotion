import React, { useState, useEffect } from 'react';

/**
 * Embeds the Cyrex AI interface (Agent Playground, RAG, Workflows, etc.)
 * In dev loads http://localhost:5175; in prod uses config cyrexInterfaceUrl.
 */
export default function CyrexEmbed() {
  const [url, setUrl] = useState('about:blank');
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (window.electronAPI?.getConfig) {
      window.electronAPI.getConfig().then((config) => {
        if (mounted && config?.cyrexInterfaceUrl) {
          setUrl(config.cyrexInterfaceUrl);
        } else {
          setUrl('http://localhost:5175');
        }
      }).catch(() => {
        if (mounted) setUrl('http://localhost:5175');
      });
    } else {
      setUrl('http://localhost:5175');
    }
    return () => { mounted = false; };
  }, []);

  if (error) {
    return (
      <div className="cyrex-embed-fallback">
        <p>Cyrex interface could not be loaded.</p>
        <p>{error}</p>
        <p>Run the Cyrex interface on port 5175 (e.g. in <code>diri-cyrex/cyrex-interface</code>: <code>npm run dev</code>).</p>
      </div>
    );
  }

  return (
    <div className="cyrex-embed">
      <iframe
        title="Cyrex AI Interface"
        src={url}
        onError={() => setError('Failed to load Cyrex')}
      />
    </div>
  );
}
