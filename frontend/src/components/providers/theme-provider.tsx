'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const DEFAULT_THEME_CONTEXT: ThemeContextType = {
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextType>(DEFAULT_THEME_CONTEXT);

const STORAGE_KEY = 'amr_mahrous_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [, startTransition] = useTransition();

  useEffect(() => {
    // Read saved theme from localStorage, default to 'dark' for royal historical ambiance
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initialTheme: ThemeMode = saved === 'light' ? 'light' : 'dark';
    setThemeState(initialTheme);
    applyThemeClass(initialTheme);
  }, []);

  const applyThemeClass = (mode: ThemeMode) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-mode', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-mode', 'light');
      root.style.colorScheme = 'light';
    }
  };

  const setTheme = (mode: ThemeMode) => {
    startTransition(() => {
      setThemeState(mode);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, mode);
      }
      applyThemeClass(mode);
    });
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  return context ?? DEFAULT_THEME_CONTEXT;
}

/**
 * زر تبديل الوضع الليلي / النهاري
 * بتأثير أيقوني سلس ولمسات ذهبية ملكية
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'التحويل إلى الوضع النهاري المشرق' : 'التحويل إلى الوضع الليلي الملكي'}
      title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-xl',
        'border border-gold-400/40 bg-midnight-900/60 text-gold-300',
        'hover:border-gold-300 hover:bg-gold-500/10 hover:text-gold-200',
        'border border-gold-400/40 bg-gold-500/10 dark:bg-midnight-900/60 text-amber-700 dark:text-gold-300',
        'hover:border-gold-400 hover:bg-gold-500/20 hover:text-amber-800 dark:hover:text-gold-200',
        'transition-all duration-300 shadow-sm active:scale-95',
        className,
      )}
    >
      {/* أيقونة الشمس (النهاري) */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          'h-4 w-4 transition-transform duration-500',
          isDark ? 'scale-0 rotate-90 absolute opacity-0' : 'scale-100 rotate-0 opacity-100 text-amber-500',
        )}
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>

      {/* أيقونة الهلال (الليلي) */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          'h-4 w-4 transition-transform duration-500',
          isDark ? 'scale-100 rotate-0 opacity-100 text-gold-300' : 'scale-0 -rotate-90 absolute opacity-0',
        )}
        aria-hidden
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        <path d="M19 3v4" strokeWidth="1.5" />
        <path d="M21 5h-4" strokeWidth="1.5" />
      </svg>
    </button>
  );
}
