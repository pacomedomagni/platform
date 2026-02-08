/**
 * Language Switcher Component
 * Dropdown to select language in storefront header
 */
'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Languages } from 'lucide-react';
import { useLanguageStore, getLanguageFlag } from '../../../lib/language-store';

export function LanguageSwitcher() {
  const { languages, selectedLanguage, isLoading, loadLanguages, selectLanguage } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (languages.length === 0) {
      loadLanguages();
    }
  }, [languages.length, loadLanguages]);

  // Update HTML lang attribute when language changes
  useEffect(() => {
    if (selectedLanguage && typeof document !== 'undefined') {
      document.documentElement.lang = selectedLanguage.languageCode;
    }
  }, [selectedLanguage]);

  if (isLoading || languages.length <= 1) {
    return null; // Don't show if only one language or still loading
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Select language. Current: ${selectedLanguage?.name || 'English'}`}
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        <span className="font-medium hidden sm:inline">
          {selectedLanguage?.languageCode?.toUpperCase() || 'EN'}
        </span>
        <span className="sm:hidden" aria-hidden="true">
          {getLanguageFlag(selectedLanguage?.languageCode || 'en')}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Dropdown */}
          <div 
            className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
            aria-label="Select language"
          >
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Select Language
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {languages.filter((l) => l.isEnabled).map((language) => (
                <button
                  key={language.languageCode}
                  type="button"
                  role="option"
                  aria-selected={selectedLanguage?.languageCode === language.languageCode}
                  onClick={() => {
                    selectLanguage(language.languageCode);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                    selectedLanguage?.languageCode === language.languageCode
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-base" aria-hidden="true">
                      {getLanguageFlag(language.languageCode)}
                    </span>
                    <span className="flex flex-col items-start">
                      <span className="font-medium">{language.name}</span>
                      {language.nativeName !== language.name && (
                        <span className="text-xs text-slate-400">{language.nativeName}</span>
                      )}
                    </span>
                  </span>
                  <span className="text-slate-400 text-xs uppercase">
                    {language.languageCode}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Compact Language Switcher for mobile/footer
 */
export function LanguageSwitcherCompact() {
  const { languages, selectedLanguage, isLoading, loadLanguages, selectLanguage } = useLanguageStore();

  useEffect(() => {
    if (languages.length === 0) {
      loadLanguages();
    }
  }, [languages.length, loadLanguages]);

  if (isLoading || languages.length <= 1) {
    return null;
  }

  return (
    <select
      value={selectedLanguage?.languageCode || ''}
      onChange={(e) => selectLanguage(e.target.value)}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      aria-label="Select language"
    >
      {languages.filter((l) => l.isEnabled).map((language) => (
        <option key={language.languageCode} value={language.languageCode}>
          {getLanguageFlag(language.languageCode)} {language.name}
        </option>
      ))}
    </select>
  );
}
