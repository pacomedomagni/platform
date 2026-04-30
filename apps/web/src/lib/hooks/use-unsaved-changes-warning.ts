'use client';

import { useEffect } from 'react';

/**
 * Wire `window.beforeunload` so closing the tab / refreshing while a form
 * has unsaved edits prompts a native confirm. Pair this with an in-app
 * Cancel-button confirm dialog (the browser hook only catches navigation
 * outside the SPA — Next's router transitions don't trigger beforeunload).
 *
 * Used by listings/new (M31) and settings/store (ST4).
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the message string and show their own copy,
      // but we still need to set returnValue to a non-empty string for the
      // prompt to fire.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
}
