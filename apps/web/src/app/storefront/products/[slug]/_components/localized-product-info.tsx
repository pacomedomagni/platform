/**
 * LocalizedProductInfo
 *
 * Client component that overlays translated product name and description
 * when a non-default language is selected. Falls back to the server-rendered
 * base values when no translation is available.
 */
'use client';

import { useEffect, useState } from 'react';
import { useLanguageStore } from '../../../../../lib/language-store';
import { i18nApi, type LocalizedProduct } from '../../../../../lib/store-api';

interface LocalizedProductInfoProps {
  productId: string;
  /** Server-rendered display name (default language) */
  displayName: string;
  /** Server-rendered description (default language) */
  description: string | null;
}

export function LocalizedProductName({
  productId,
  displayName,
}: Pick<LocalizedProductInfoProps, 'productId' | 'displayName'>) {
  const translated = useLocalizedProduct(productId);

  return <>{translated?.displayName ?? displayName}</>;
}

export function LocalizedProductDescription({
  productId,
  description,
}: Pick<LocalizedProductInfoProps, 'productId' | 'description'>) {
  const translated = useLocalizedProduct(productId);
  const desc = translated
    ? translated.shortDescription ?? translated.description ?? description
    : description;

  return <>{desc}</>;
}

// ---------------------------------------------------------------------------
// Internal hook that fetches the localized product exactly once per
// language switch. Returns null for default language or while loading.
// ---------------------------------------------------------------------------

function useLocalizedProduct(productId: string) {
  const { selectedLanguage } = useLanguageStore();
  const [data, setData] = useState<LocalizedProduct | null>(null);

  useEffect(() => {
    // Skip fetch for default language -- server-rendered content is correct
    if (!selectedLanguage || selectedLanguage.isDefault) {
      setData(null);
      return;
    }

    let cancelled = false;

    i18nApi
      .getLocalizedProduct(productId, selectedLanguage.languageCode)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        // Translation unavailable -- fall back silently
        if (!cancelled) setData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [productId, selectedLanguage]);

  return data;
}
