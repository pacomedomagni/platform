'use client';

/**
 * Theme Loading Components
 * Provides loading states and transitions for theme switching
 */

import { useEffect, useState } from 'react';
import { useTheme } from './use-theme';

/**
 * Theme Loading Skeleton
 * Shows while theme is being loaded
 */
export function ThemeLoadingSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="text-center space-y-4">
        <div className="relative h-12 w-12 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-gray-600">Loading theme...</p>
      </div>
    </div>
  );
}

/**
 * Theme Error Fallback
 * Shows when theme fails to load
 */
export function ThemeErrorFallback({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="h-12 w-12 mx-auto rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Theme Loading Failed</h3>
          <p className="text-sm text-gray-600 mt-1">{error}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Theme Transition Overlay
 * Smooth fade effect when switching themes
 */
export function ThemeTransitionOverlay({ duration = 300 }: { duration?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => setShow(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-white pointer-events-none transition-opacity"
      style={{
        opacity: show ? 1 : 0,
        transitionDuration: `${duration}ms`,
      }}
    />
  );
}

/**
 * Theme Ready Guard
 * Only renders children when theme is ready
 */
export function ThemeReadyGuard({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { loading, error } = useTheme();

  if (loading) {
    return fallback || <ThemeLoadingSkeleton />;
  }

  if (error) {
    return <ThemeErrorFallback error={error} />;
  }

  return <>{children}</>;
}

/**
 * Prevent Flash of Unstyled Content (FOUC)
 * Hides content until theme is applied
 */
export function PreventFOUC({ children }: { children: React.ReactNode }) {
  const { loading } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR or initial load, show nothing
  if (!mounted || loading) {
    return (
      <div className="invisible opacity-0" aria-hidden="true">
        {children}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {children}
    </div>
  );
}

/**
 * Theme Switch Animation
 * Wraps content that should animate when theme changes
 */
export function ThemeSwitchAnimation({
  children,
  duration = 300,
}: {
  children: React.ReactNode;
  duration?: number;
}) {
  const { theme } = useTheme();
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (theme) {
      setKey((prev) => prev + 1);
    }
  }, [theme?.id]);

  return (
    <div
      key={key}
      className="transition-all"
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Theme Loading Progress
 * Shows a progress bar during theme loading
 */
export function ThemeLoadingProgress() {
  const { loading } = useTheme();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!loading) {
      setProgress(100);
      return;
    }

    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [loading]);

  if (!loading && progress === 100) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
      <div
        className="h-full bg-blue-600 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/**
 * Minimal Theme Loader
 * Lightweight loading indicator
 */
export function MinimalThemeLoader() {
  const { loading } = useTheme();

  if (!loading) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <span className="text-sm text-gray-600">Loading theme...</span>
      </div>
    </div>
  );
}
