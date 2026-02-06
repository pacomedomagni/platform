'use client';

/**
 * Font Loader Component
 * Dynamically loads Google Fonts for the theme
 */

import { useEffect, useState } from 'react';
import { extractFontFamilies, formatGoogleFontUrl } from './theme-utils';

interface FontLoaderProps {
  fonts: string[];
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function FontLoader({ fonts, onLoad, onError }: FontLoaderProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    if (!fonts || fonts.length === 0) {
      setStatus('loaded');
      onLoad?.();
      return;
    }

    // Extract actual font families (remove fallbacks)
    const fontFamilies = fonts.flatMap(extractFontFamilies);
    const uniqueFonts = [...new Set(fontFamilies)];

    if (uniqueFonts.length === 0) {
      setStatus('loaded');
      onLoad?.();
      return;
    }

    const linkId = 'noslag-font-loader';

    // Remove existing font link if present
    const existingLink = document.getElementById(linkId);
    if (existingLink) {
      existingLink.remove();
    }

    // Create new link element
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = formatGoogleFontUrl(uniqueFonts);

    // Handle load event
    link.onload = () => {
      setStatus('loaded');
      onLoad?.();
    };

    // Handle error event
    link.onerror = () => {
      const error = new Error('Failed to load fonts');
      setStatus('error');
      onError?.(error);
      console.error('Font loading error:', error);
    };

    // Append to document head
    document.head.appendChild(link);

    // Cleanup
    return () => {
      const linkElement = document.getElementById(linkId);
      if (linkElement) {
        linkElement.remove();
      }
    };
  }, [fonts, onLoad, onError]);

  // This is a utility component - no visual output
  return null;
}

/**
 * Hook for font loading status
 */
export function useFontLoader(fonts: string[]) {
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoaded(false);
    setError(null);

    if (!fonts || fonts.length === 0) {
      setLoading(false);
      setLoaded(true);
      return;
    }

    const fontFamilies = fonts.flatMap(extractFontFamilies);
    const uniqueFonts = [...new Set(fontFamilies)];

    if (uniqueFonts.length === 0) {
      setLoading(false);
      setLoaded(true);
      return;
    }

    const linkId = 'noslag-font-loader-hook';
    const existingLink = document.getElementById(linkId);
    if (existingLink) {
      existingLink.remove();
    }

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = formatGoogleFontUrl(uniqueFonts);

    link.onload = () => {
      setLoading(false);
      setLoaded(true);
    };

    link.onerror = () => {
      const err = new Error('Failed to load fonts');
      setLoading(false);
      setError(err);
    };

    document.head.appendChild(link);

    return () => {
      const linkElement = document.getElementById(linkId);
      if (linkElement) {
        linkElement.remove();
      }
    };
  }, [fonts]);

  return { loading, loaded, error };
}

/**
 * Preload fonts component - loads fonts without blocking
 */
export function FontPreloader({ fonts }: { fonts: string[] }) {
  useEffect(() => {
    if (!fonts || fonts.length === 0) return;

    const fontFamilies = fonts.flatMap(extractFontFamilies);
    const uniqueFonts = [...new Set(fontFamilies)];

    if (uniqueFonts.length === 0) return;

    // Use link preload for better performance
    const preloadId = 'noslag-font-preload';
    const existingPreload = document.getElementById(preloadId);
    if (existingPreload) {
      existingPreload.remove();
    }

    const link = document.createElement('link');
    link.id = preloadId;
    link.rel = 'preload';
    link.as = 'style';
    link.href = formatGoogleFontUrl(uniqueFonts);

    document.head.appendChild(link);

    // Also add the actual stylesheet
    const styleId = 'noslag-font-preload-style';
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    const styleLink = document.createElement('link');
    styleLink.id = styleId;
    styleLink.rel = 'stylesheet';
    styleLink.href = formatGoogleFontUrl(uniqueFonts);

    document.head.appendChild(styleLink);

    return () => {
      const preloadElement = document.getElementById(preloadId);
      const styleElement = document.getElementById(styleId);
      if (preloadElement) preloadElement.remove();
      if (styleElement) styleElement.remove();
    };
  }, [fonts]);

  return null;
}
