import React, { useState, useEffect } from 'react';

/**
 * Optional embed for an external AI UI (Cyrex or any URL).
 * Only loads when configured via CYREX_INTERFACE_URL / getConfig — no hardcoded ports.
 */
export default function CyrexEmbed() {
  const [url, setUrl] = useState(null);
  const [hint, setHint] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const config = window.electronAPI?.getConfig
          ? await window.electronAPI.getConfig()
          : null;
        const embedUrl = config?.cyrexInterfaceUrl?.trim();
        if (!mounted) return;
        if (embedUrl) {
          setUrl(embedUrl);
          setHint(null);
        } else {
          setUrl(null);
          setHint(
            'No external AI UI URL configured. Set CYREX_INTERFACE_URL in the environment or add an integration URL in settings.'
          );
        }
      } catch {
        if (mounted) {
          setUrl(null);
          setHint('Could not read app configuration.');
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  if (hint) {
    return (
      <div className="cyrex-embed-fallback">
        <p>{hint}</p>
        <p className="settings-hint">The IDE runs standalone; this panel is only for an optional embedded web UI you host yourself.</p>
      </div>
    );
  }

  if (!url) {
    return <div className="cyrex-embed-fallback"><p>Loading…</p></div>;
  }

  return (
    <div className="cyrex-embed">
      <iframe title="External AI interface" src={url} />
    </div>
  );
}
