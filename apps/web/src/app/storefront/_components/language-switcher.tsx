/**
 * Language Switcher Component
 * Dropdown to select language in the storefront header.
 * Pattern mirrors CurrencySwitcher.
 */
'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Languages } from 'lucide-react';
import { useLanguageStore, getFlagEmoji } from '../../../lib/language-store';

export function LanguageSwitcher() {
  const {
    languages,
    selectedLanguage,
    isLoading,
    loadLanguages,
    setLanguage,
  } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (languages.length === 0) {
      loadLanguages();
    }
  }, [languages.length, loadLanguages]);

  // Don't render if still loading or only one language available
  if (isLoading || languages.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        <span className="font-medium">
          {selectedLanguage
            ? `${getFlagEmoji(selectedLanguage.languageCode, selectedLanguage.countryCode)} ${selectedLanguage.languageCode.toUpperCase()}`
            : 'EN'}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div
            className="absolute right-0 top-full z-40 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
            aria-label="Available languages"
          >
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Select Language
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {languages
                .filter((l) => l.isEnabled)
                .map((language) => {
                  const isSelected =
                    selectedLanguage?.languageCode === language.languageCode &&
                    selectedLanguage?.countryCode === language.countryCode;
                  return (
                    <button
                      key={language.languageCode}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setLanguage(language.languageCode);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-6 text-center">
                          {getFlagEmoji(language.languageCode, language.countryCode)}
                        </span>
                        <span>{language.nativeName || language.name}</span>
                      </span>
                      <span className="text-slate-400 text-xs">
                        {language.languageCode.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
            </div>
            {languages.some((l) => !l.isDefault) && (
              <div className="px-3 py-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-400">
                  Content translated where available
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
