import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { EmotionProvider } from './features/emotion/EmotionContext';
import './services/recentService';
import './styles/ide.css';
import './styles/ide-extended.css';
import './styles/features.css';
import './styles/missions.css';
import './styles/components.css';

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <EmotionProvider>
            <App />
          </EmotionProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

