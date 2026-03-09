import React, { createContext, useContext, useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { getJSON, setItem } from '../utils/storage';

const ThemeContext = createContext(null);

const THEMES = {
  dark: 'vs-dark',
  light: 'vs',
  hc: 'hc-black'
};

const MIN_FONT = 10;
const MAX_FONT = 28;
const DEFAULT_FONT = 14;

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getJSON(STORAGE_KEYS.THEME) || 'dark');
  const [editorFontSize, setEditorFontSize] = useState(() => {
    const v = getJSON(STORAGE_KEYS.EDITOR_FONT_SIZE);
    const n = typeof v === 'number' ? v : parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(MAX_FONT, Math.max(MIN_FONT, n)) : DEFAULT_FONT;
  });

  useEffect(() => {
    setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-hc');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    setItem(STORAGE_KEYS.EDITOR_FONT_SIZE, editorFontSize);
  }, [editorFontSize]);

  const zoomIn = () => setEditorFontSize((f) => Math.min(MAX_FONT, f + 2));
  const zoomOut = () => setEditorFontSize((f) => Math.max(MIN_FONT, f - 2));
  const zoomReset = () => setEditorFontSize(DEFAULT_FONT);

  const monacoTheme = THEMES[theme] || THEMES.dark;

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      monacoTheme,
      themeOptions: Object.keys(THEMES),
      editorFontSize,
      setEditorFontSize,
      zoomIn,
      zoomOut,
      zoomReset
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Intentional: provider and hook in same file for co-location
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
