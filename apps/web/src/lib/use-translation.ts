/**
 * useTranslation hook
 *
 * Convenience React hook that reads from the language store and returns
 * a `t()` function for translating content keys. It also exposes the
 * current language and a helper to eagerly load a batch of keys.
 *
 * Usage:
 *   const { t, language, loadKeys } = useTranslation();
 *   // t('hero.title')            -> translated string or the key itself
 *   // t('hero.title', 'Welcome') -> translated string or 'Welcome'
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useLanguageStore } from './language-store';

export function useTranslation(preloadKeys?: string[]) {
  const {
    selectedLanguage,
    translations,
    loadLanguages,
    loadTranslations,
    languages,
    isLoading,
    isLoadingTranslations,
  } = useLanguageStore();

  const hasInitialized = useRef(false);

  // Bootstrap: ensure languages are loaded on first mount
  useEffect(() => {
    if (!hasInitialized.current && languages.length === 0 && !isLoading) {
      hasInitialized.current = true;
      loadLanguages();
    }
  }, [languages.length, isLoading, loadLanguages]);

  // Pre-load keys when the selected language changes (or on mount)
  useEffect(() => {
    if (preloadKeys && preloadKeys.length > 0 && selectedLanguage) {
      loadTranslations(preloadKeys);
    }
    // Only re-run when the language changes, not when keys reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage?.languageCode]);

  /**
   * Translate a content key.
   * Falls back to the optional `fallback` string, then to the raw key.
   */
  const t = useCallback(
    (key: string, fallback?: string): string => {
      return translations[key] ?? fallback ?? key;
    },
    [translations]
  );

  /**
   * Imperatively load additional keys (e.g. after a dynamic section mounts).
   */
  const loadKeys = useCallback(
    (keys: string[]) => {
      if (keys.length > 0) {
        loadTranslations(keys);
      }
    },
    [loadTranslations]
  );

  return {
    /** Translate a content key */
    t,
    /** The currently selected language object (null until loaded) */
    language: selectedLanguage,
    /** The language code string, e.g. "en" */
    languageCode: selectedLanguage?.languageCode ?? 'en',
    /** Whether the language is the store default */
    isDefaultLanguage: selectedLanguage?.isDefault ?? true,
    /** Load additional translation keys on demand */
    loadKeys,
    /** Whether languages are still loading */
    isLoading,
    /** Whether translations are still loading */
    isLoadingTranslations,
  };
}
