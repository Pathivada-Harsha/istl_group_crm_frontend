// context/ThemeContext.js
// Lightweight theme manager. Defaults to LIGHT on first load (does NOT follow OS),
// persists the user's choice in localStorage, and applies it via a `data-theme`
// attribute on <html>. All actual color switching is handled in theme.css.
import React, { createContext, useState, useEffect, useCallback } from 'react';

export const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'app-theme';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (e) {
    /* localStorage unavailable — fall through */
  }
  return 'light'; // always start light on first load
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  // Apply the attribute to <html> whenever theme changes.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* ignore persistence errors */
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next === 'dark' ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
