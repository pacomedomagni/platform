'use client';

/**
 * Color Mode Toggle Component
 * Accessible toggle for light/dark/system mode
 * WCAG 2.1 AA compliant with proper focus states and ARIA labels
 */

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, ChevronDown, Check } from 'lucide-react';
import { useColorModeStore, type ColorMode, initializeColorMode } from '@/lib/color-mode-store';

interface ColorModeToggleProps {
  /** Show only icon (compact mode) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const modeOptions: { value: ColorMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Main Color Mode Toggle - Dropdown with all options
 */
export function ColorModeToggle({ compact = false, className = '' }: ColorModeToggleProps) {
  const { mode, resolvedMode, setMode, isHydrated } = useColorModeStore();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initializeColorMode();
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-color-mode-toggle]')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = modeOptions.findIndex((opt) => opt.value === mode);
      const nextIndex =
        e.key === 'ArrowDown'
          ? (currentIndex + 1) % modeOptions.length
          : (currentIndex - 1 + modeOptions.length) % modeOptions.length;
      setMode(modeOptions[nextIndex].value);
    }
  };

  // Prevent hydration mismatch
  if (!mounted || !isHydrated) {
    return (
      <button
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white/80 hover:bg-gray-50 transition-colors ${className}`}
        aria-label="Toggle color mode"
        disabled
      >
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
        {!compact && <div className="w-12 h-4 bg-gray-200 rounded animate-pulse" />}
      </button>
    );
  }

  const CurrentIcon = resolvedMode === 'dark' ? Moon : Sun;
  const currentOption = modeOptions.find((opt) => opt.value === mode);

  return (
    <div className="relative" data-color-mode-toggle>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`
          flex items-center gap-2 px-3 py-2 text-sm rounded-lg border
          transition-all duration-200
          bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
          border-gray-200 dark:border-slate-700
          hover:bg-gray-50 dark:hover:bg-slate-700/80
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
          dark:focus:ring-offset-slate-900
          text-gray-700 dark:text-gray-200
          ${className}
        `}
        aria-label={`Color mode: ${currentOption?.label}. Click to change.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <CurrentIcon 
          className="w-4 h-4 text-amber-500 dark:text-amber-400" 
          aria-hidden="true" 
        />
        {!compact && (
          <>
            <span className="min-w-[60px] text-left">{currentOption?.label}</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Select color mode"
          className={`
            absolute right-0 mt-2 w-40 py-1 z-50
            bg-white dark:bg-slate-800 rounded-lg shadow-lg
            border border-gray-200 dark:border-slate-700
            focus:outline-none
          `}
        >
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = mode === option.value;

            return (
              <li key={option.value}>
                <button
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setMode(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 text-sm
                    transition-colors
                    ${
                      isSelected
                        ? 'bg-primary/10 text-primary dark:bg-primary/20'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }
                    focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-700
                  `}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span className="flex-1 text-left">{option.label}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Simple Toggle Button - Just switches between light and dark
 * Good for minimal UI or mobile
 */
export function ColorModeToggleSimple({ className = '' }: { className?: string }) {
  const { resolvedMode, toggleMode, isHydrated } = useColorModeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initializeColorMode();
    setMounted(true);
  }, []);

  if (!mounted || !isHydrated) {
    return (
      <button
        className={`p-2 rounded-lg border border-gray-200 bg-white/80 ${className}`}
        aria-label="Toggle color mode"
        disabled
      >
        <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
      </button>
    );
  }

  const Icon = resolvedMode === 'dark' ? Sun : Moon;
  const nextMode = resolvedMode === 'dark' ? 'light' : 'dark';

  return (
    <button
      onClick={toggleMode}
      className={`
        p-2 rounded-lg border transition-all duration-200
        bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
        border-gray-200 dark:border-slate-700
        hover:bg-gray-50 dark:hover:bg-slate-700/80
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        dark:focus:ring-offset-slate-900
        text-gray-700 dark:text-gray-200
        ${className}
      `}
      aria-label={`Switch to ${nextMode} mode`}
    >
      <Icon className="w-5 h-5 text-amber-500 dark:text-amber-400" aria-hidden="true" />
    </button>
  );
}

/**
 * Compact Toggle for Mobile Navigation
 */
export function ColorModeToggleMobile() {
  const { mode, setMode, isHydrated } = useColorModeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initializeColorMode();
    setMounted(true);
  }, []);

  if (!mounted || !isHydrated) {
    return <div className="h-10 bg-gray-200 rounded animate-pulse" />;
  }

  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Color mode">
      {modeOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = mode === option.value;

        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={isSelected}
            onClick={() => setMode(option.value)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
              text-sm font-medium transition-all
              ${
                isSelected
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }
              focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
            `}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
