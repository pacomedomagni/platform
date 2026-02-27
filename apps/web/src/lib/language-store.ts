/**
 * Language State Management using Zustand
 * Manages i18n / multi-language support for the storefront.
 *
 * Mirrors the currency-store pattern:
 *   - persists the selected language in localStorage
 *   - loads available languages from the public i18n API
 *   - caches content translations per language in memory
 */
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { i18nApi, type StoreLanguage } from './store-api';

// ==========================================
// Flag emoji helper
// ==========================================

const LANGUAGE_FLAGS: Record<string, string> = {
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
  fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}',
  it: '\u{1F1EE}\u{1F1F9}',
  pt: '\u{1F1E7}\u{1F1F7}',
  ja: '\u{1F1EF}\u{1F1F5}',
  ko: '\u{1F1F0}\u{1F1F7}',
  zh: '\u{1F1E8}\u{1F1F3}',
  ar: '\u{1F1F8}\u{1F1E6}',
  hi: '\u{1F1EE}\u{1F1F3}',
  ru: '\u{1F1F7}\u{1F1FA}',
  nl: '\u{1F1F3}\u{1F1F1}',
  sv: '\u{1F1F8}\u{1F1EA}',
  pl: '\u{1F1F5}\u{1F1F1}',
  tr: '\u{1F1F9}\u{1F1F7}',
  th: '\u{1F1F9}\u{1F1ED}',
  vi: '\u{1F1FB}\u{1F1F3}',
  id: '\u{1F1EE}\u{1F1E9}',
  ms: '\u{1F1F2}\u{1F1FE}',
  uk: '\u{1F1FA}\u{1F1E6}',
  cs: '\u{1F1E8}\u{1F1FF}',
  ro: '\u{1F1F7}\u{1F1F4}',
  el: '\u{1F1EC}\u{1F1F7}',
  he: '\u{1F1EE}\u{1F1F1}',
  da: '\u{1F1E9}\u{1F1F0}',
  fi: '\u{1F1EB}\u{1F1EE}',
  no: '\u{1F1F3}\u{1F1F4}',
  hu: '\u{1F1ED}\u{1F1FA}',
  bg: '\u{1F1E7}\u{1F1EC}',
};

/**
 * Look up a flag emoji for a language code. Falls back to a globe icon when
 * the language/country code is not in the static map.
 */
export function getFlagEmoji(languageCode: string, countryCode?: string | null): string {
  // Try country code first (more specific)
  if (countryCode) {
    const cc = countryCode.toUpperCase();
    const flag = String.fromCodePoint(
      ...cc.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
    return flag;
  }
  return LANGUAGE_FLAGS[languageCode.toLowerCase()] ?? '\u{1F310}';
}

// ==========================================
// Store types
// ==========================================

interface LanguageState {
  // State
  languages: StoreLanguage[];
  selectedLanguage: StoreLanguage | null;
  translations: Record<string, string>; // contentKey -> translated string
  isLoading: boolean;
  isLoadingTranslations: boolean;
  error: string | null;

  // Actions
  loadLanguages: () => Promise<void>;
  setLanguage: (languageCode: string) => Promise<void>;
  loadTranslations: (keys: string[]) => Promise<void>;
  t: (key: string, fallback?: string) => string;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      // Initial state
      languages: [],
      selectedLanguage: null,
      translations: {},
      isLoading: false,
      isLoadingTranslations: false,
      error: null,

      // ------------------------------------------------------------------
      // Load available languages from the i18n API
      // ------------------------------------------------------------------
      loadLanguages: async () => {
        set({ isLoading: true, error: null });

        try {
          const languages = await i18nApi.getLanguages();
          const defaultLanguage =
            languages.find((l) => l.isDefault) || languages[0] || null;

          // Only set selected language if one hasn't been persisted yet
          const current = get().selectedLanguage;
          const selected =
            current && languages.find((l) => l.languageCode === current.languageCode)
              ? current
              : defaultLanguage;

          set({ languages, selectedLanguage: selected });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load languages';
          set({ error: message });
          console.error('Failed to load languages:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      // ------------------------------------------------------------------
      // Switch the active language and reload translations
      // ------------------------------------------------------------------
      setLanguage: async (languageCode: string) => {
        const { languages } = get();
        const language = languages.find((l) => l.languageCode === languageCode);
        if (!language) return;

        set({ selectedLanguage: language, translations: {} });

        // Reload any translations that were previously loaded
        // (callers can also call loadTranslations explicitly)
      },

      // ------------------------------------------------------------------
      // Load content translations for a set of keys
      // ------------------------------------------------------------------
      loadTranslations: async (keys: string[]) => {
        const { selectedLanguage } = get();
        if (!selectedLanguage || keys.length === 0) return;

        set({ isLoadingTranslations: true });

        try {
          const result = await i18nApi.getContents(
            keys,
            selectedLanguage.languageCode
          );

          set((state) => ({
            translations: { ...state.translations, ...result },
          }));
        } catch (error) {
          console.error('Failed to load translations:', error);
        } finally {
          set({ isLoadingTranslations: false });
        }
      },

      // ------------------------------------------------------------------
      // Translate a content key, falling back to the key itself
      // ------------------------------------------------------------------
      t: (key: string, fallback?: string) => {
        const { translations } = get();
        return translations[key] ?? fallback ?? key;
      },
    }),
    {
      name: 'language-storage',
      partialize: (state) => ({
        selectedLanguage: state.selectedLanguage,
      }),
    }
  )
);
