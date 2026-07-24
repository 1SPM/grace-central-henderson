import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      // One-time reset: dark is now the standard default, superseding the
      // earlier v1 reset that had flipped everyone to light. Runs once per
      // browser; after that the user's own toggle choice always wins.
      // Mirrors index.html's inline pre-paint script, which applies this
      // same v2 default before React mounts to avoid a light-mode flash.
      const resetV2Done = localStorage.getItem('grace-theme-reset-v2');
      if (!resetV2Done) {
        localStorage.setItem('grace-theme-reset-v2', '1');
        localStorage.setItem('grace-theme', 'dark');
        return 'dark';
      }
      const saved = localStorage.getItem('grace-theme') as Theme;
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('grace-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
