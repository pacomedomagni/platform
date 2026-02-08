/**
 * Color Mode Store
 * Manages light/dark mode with system preference detection
 * WCAG 2.1 AA compliant - respects user preferences
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'light' | 'dark' | 'system';

interface ColorModeState {
  // User's preference (can be 'system' to follow OS)
  mode: ColorMode;
  // The resolved/actual mode being displayed
  resolvedMode: 'light' | 'dark';
  // Whether the store has been hydrated from localStorage
  isHydrated: boolean;

  // Actions
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  setHydrated: () => void;
}

/**
 * Get the system's preferred color scheme
 */
function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve the actual mode from user preference
 */
function resolveMode(mode: ColorMode): 'light' | 'dark' {
  if (mode === 'system') {
    return getSystemPreference();
  }
  return mode;
}

/**
 * Apply color mode to the document
 * Uses 'class' strategy for Tailwind dark mode
 */
function applyColorMode(resolvedMode: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Remove existing mode classes
  root.classList.remove('light', 'dark');

  // Add new mode class
  root.classList.add(resolvedMode);

  // Set color-scheme for native elements (scrollbars, form controls)
  root.style.colorScheme = resolvedMode;

  // Set meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      resolvedMode === 'dark' ? '#0f172a' : '#ffffff'
    );
  }
}

export const useColorModeStore = create<ColorModeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolvedMode: 'light',
      isHydrated: false,

      setMode: (mode: ColorMode) => {
        const resolvedMode = resolveMode(mode);
        applyColorMode(resolvedMode);
        set({ mode, resolvedMode });
      },

      toggleMode: () => {
        const { resolvedMode } = get();
        const newMode: ColorMode = resolvedMode === 'dark' ? 'light' : 'dark';
        applyColorMode(newMode);
        set({ mode: newMode, resolvedMode: newMode });
      },

      setHydrated: () => {
        const { mode } = get();
        const resolvedMode = resolveMode(mode);
        applyColorMode(resolvedMode);
        set({ isHydrated: true, resolvedMode });
      },
    }),
    {
      name: 'noslag-color-mode',
      // Only persist the mode preference, not resolved mode
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        // After hydration, apply the correct mode
        if (state) {
          state.setHydrated();
        }
      },
    }
  )
);

/**
 * Initialize color mode on app load
 * Call this in your root layout or _app
 */
export function initializeColorMode(): void {
  if (typeof window === 'undefined') return;

  // Listen for system preference changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = () => {
    const state = useColorModeStore.getState();
    if (state.mode === 'system') {
      const resolvedMode = getSystemPreference();
      applyColorMode(resolvedMode);
      useColorModeStore.setState({ resolvedMode });
    }
  };

  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else {
    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
  }

  // Apply initial mode to prevent flash
  const storedMode = localStorage.getItem('noslag-color-mode');
  if (storedMode) {
    try {
      const parsed = JSON.parse(storedMode);
      const mode = parsed.state?.mode || 'system';
      const resolvedMode = resolveMode(mode);
      applyColorMode(resolvedMode);
    } catch {
      applyColorMode(getSystemPreference());
    }
  } else {
    applyColorMode(getSystemPreference());
  }
}

/**
 * Script to inject in <head> to prevent flash of wrong color mode
 * Use this as an inline script before any content
 */
export const colorModeScript = `
(function() {
  try {
    var stored = localStorage.getItem('noslag-color-mode');
    var mode = 'system';
    if (stored) {
      var parsed = JSON.parse(stored);
      mode = parsed.state?.mode || 'system';
    }
    var resolved = mode;
    if (mode === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`;
