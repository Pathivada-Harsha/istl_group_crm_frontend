// components/ThemeToggle.js
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle-btn${isDark ? ' theme-toggle-btn--dark' : ''}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      data-tooltip={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark
        ? <Sun className="theme-toggle-icon" size={17} />
        : <Moon className="theme-toggle-icon" size={17} />
      }
    </button>
  );
}

export default ThemeToggle;