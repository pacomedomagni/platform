/**
 * Language State Management using Zustand
 * Manages multi-language/i18n for storefront
 */
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StoreLanguage {
  id: string;
  languageCode: string;
  countryCode?: string;
  name: string;
  nativeName: string;
  isDefault: boolean;
  isEnabled: boolean;
}

interface LanguageState {
  // State
  languages: StoreLanguage[];
  selectedLanguage: StoreLanguage | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadLanguages: () => Promise<void>;
  selectLanguage: (languageCode: string) => void;
  getLocale: () => string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

function getTenantId(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_TENANT_ID || 'default';
  // Use resolved tenant from session, or localStorage, or env fallback
  return sessionStorage.getItem('resolved_tenant_id')
    || localStorage.getItem('tenantId')
    || process.env.NEXT_PUBLIC_TENANT_ID
    || 'default';
}

// Language flag emoji mapping
const LANGUAGE_FLAGS: Record<string, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
  nl: '🇳🇱',
  pl: '🇵🇱',
  ru: '🇷🇺',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇨🇳',
  ar: '🇸🇦',
  hi: '🇮🇳',
  tr: '🇹🇷',
  vi: '🇻🇳',
  th: '🇹🇭',
  sv: '🇸🇪',
  no: '🇳🇴',
  da: '🇩🇰',
  fi: '🇫🇮',
  he: '🇮🇱',
  id: '🇮🇩',
  ms: '🇲🇾',
  uk: '🇺🇦',
  cs: '🇨🇿',
  el: '🇬🇷',
  ro: '🇷🇴',
  hu: '🇭🇺',
  bg: '🇧🇬',
};

export function getLanguageFlag(languageCode: string): string {
  return LANGUAGE_FLAGS[languageCode.toLowerCase()] || '🌐';
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      // Initial state
      languages: [],
      selectedLanguage: null,
      isLoading: false,
      error: null,

      // Load available languages from API
      loadLanguages: async () => {
        set({ isLoading: true, error: null });

        try {
          const tenantId = getTenantId();
          const response = await fetch(`${API_BASE}/v1/storefront/${tenantId}/i18n/languages`, {
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': tenantId,
            },
          });

          if (!response.ok) {
            throw new Error('Failed to load languages');
          }

          const languages: StoreLanguage[] = await response.json();
          const defaultLanguage = languages.find((l) => l.isDefault) || languages[0];

          set({
            languages,
            selectedLanguage: get().selectedLanguage || defaultLanguage,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load languages';
          set({ error: message });
          console.error('Failed to load languages:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      // Select a language
      selectLanguage: (languageCode: string) => {
        const { languages } = get();
        const language = languages.find((l) => l.languageCode === languageCode);
        if (language) {
          set({ selectedLanguage: language });
          // Update HTML lang attribute
          if (typeof document !== 'undefined') {
            document.documentElement.lang = languageCode;
          }
        }
      },

      // Get the current locale string (e.g., "en-US", "es-ES")
      getLocale: () => {
        const { selectedLanguage } = get();
        if (!selectedLanguage) return 'en-US';
        
        const { languageCode, countryCode } = selectedLanguage;
        if (countryCode) {
          return `${languageCode}-${countryCode}`;
        }
        return languageCode;
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
