import React, { useState, useEffect } from 'react';

const IntegrationPanel = () => {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const result = await window.electronAPI.apiRequest({
        method: 'GET',
        endpoint: '/integrations'
      });
      if (result.success) {
        setIntegrations(result.data);
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
    }
  };

  const handleConnect = async (provider) => {
    setLoading(true);
    try {
      if (provider === 'github') {
        const token = prompt('Enter GitHub Personal Access Token:');
        if (token) {
          await window.electronAPI.syncGithubIssues('', token);
          alert('GitHub connected!');
          loadIntegrations();
        }
      } else if (provider === 'notion') {
        const token = prompt('Enter Notion API Token:');
        if (token) {
          await window.electronAPI.apiRequest({
            method: 'POST',
            endpoint: '/integrations/notion/connect',
            data: { token }
          });
          alert('Notion connected!');
          loadIntegrations();
        }
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (provider) => {
    setLoading(true);
    try {
      if (provider === 'github') {
        const repo = prompt('Enter repository (owner/repo):');
        if (repo) {
          const issues = await window.electronAPI.syncGithubIssues(repo);
          alert(`Synced ${issues.length} issues from GitHub`);
        }
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (provider) => {
    if (!window.confirm(`Disconnect ${provider}?`)) return;
    setLoading(true);
    try {
      await window.electronAPI.apiRequest({
        method: 'POST',
        endpoint: '/integrations/disconnect',
        data: { provider }
      });
      setIntegrations((prev) => prev.filter((i) => i.provider !== provider));
    } catch (error) {
      setIntegrations((prev) => prev.map((i) => i.provider === provider ? { ...i, connected: false } : i));
    } finally {
      setLoading(false);
    }
  };

  const providers = [
    { id: 'github', name: 'GitHub', icon: '🐙', color: '#24292e' },
    { id: 'notion', name: 'Notion', icon: '📝', color: '#000000' },
    { id: 'trello', name: 'Trello', icon: '📋', color: '#0079bf' },
    { id: 'google_docs', name: 'Google Docs', icon: '📄', color: '#4285f4' }
  ];

  return (
    <div className="integration-panel">
      <div className="integration-header">
        <h3>Integrations</h3>
        <button onClick={loadIntegrations}>Refresh</button>
      </div>
      <div className="integration-list">
        {providers.map(provider => {
          const integration = integrations.find(i => i.provider === provider.id);
          const isConnected = integration && integration.connected;

          return (
            <div key={provider.id} className="integration-item">
              <div className="integration-info">
                <span className="integration-icon" style={{ color: provider.color }}>
                  {provider.icon}
                </span>
                <div>
                  <h4>{provider.name}</h4>
                  <p>{isConnected ? 'Connected' : 'Not connected'}</p>
                </div>
              </div>
              <div className="integration-actions">
                {isConnected ? (
                  <>
                    <button onClick={() => handleSync(provider.id)} disabled={loading}>
                      Sync
                    </button>
                    <button onClick={() => handleDisconnect(provider.id)} disabled={loading}>Disconnect</button>
                  </>
                ) : (
                  <button onClick={() => handleConnect(provider.id)} disabled={loading}>
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntegrationPanel;

