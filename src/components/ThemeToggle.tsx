import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeContext';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Pale Blue Aurora theme' : 'Switch to Obsidian Dark Radiance theme'}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer border border-sky-200/80 dark:border-emerald-300/20 bg-white/75 dark:bg-[#1D2622]/85 text-slate-700 dark:text-[#D3DDD8] hover:bg-sky-50/90 dark:hover:bg-[#2B3832]/90 transition-colors"
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
          {!compact && <span>Light Aurora</span>}
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          {!compact && <span>Obsidian Dark</span>}
        </>
      )}
    </button>
  );
}
