'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Two-way bind a flat `Record<string, string>` of filter values to the URL
 * query string.
 *
 * - On mount: hydrates `setters[key]` from `?key=value` if present.
 * - On every change: replaces (no push) the URL so the back button still
 *   takes the user to the previous page rather than walking through every
 *   keystroke.
 *
 * Empty / undefined values are dropped from the URL so a clean page never
 * shows `?warehouseCode=&itemCode=`.
 *
 * R-COMMON-2: every report uses this so filter state survives reload and
 * is shareable.
 */
export function useUrlFilters(
  values: Record<string, string>,
  setters: Record<string, (next: string) => void>,
): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Hydrate once on mount. The setters arg is recreated on every render so
  // we deliberately ignore it in deps; the `hydratedRef` guard ensures we
  // don't clobber user edits with stale URL values on subsequent renders.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    for (const key of Object.keys(setters)) {
      const fromUrl = searchParams.get(key);
      if (fromUrl !== null && fromUrl !== values[key]) {
        setters[key](fromUrl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push current values back to URL.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value && value.trim() !== '') params.set(key, value);
    }
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    router.replace(next, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), pathname]);
}
