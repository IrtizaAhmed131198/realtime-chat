import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext(null);

function applyTheme(dark) {
  if (dark) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
}

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    const dark = saved === 'dark';
    applyTheme(dark);
    return dark;
  });

  const toggleTheme = () => {
    setIsDark((d) => {
      applyTheme(!d);
      return !d;
    });
  };

  return <ThemeContext.Provider value={{ isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
