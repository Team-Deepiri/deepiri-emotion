import React from 'react';

/**
 * Catches render errors so the IDE doesn't go blank. Shows a fallback UI and a way to reload.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-box">
            <h2>Something went wrong</h2>
            <p className="error-boundary-message">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <p className="error-boundary-hint">You can try reloading the window to continue.</p>
            <button
              type="button"
              className="error-boundary-reload"
              onClick={() => window.location.reload()}
            >
              Reload window
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
