'use client';

import { useCallback, useMemo } from 'react';

type Router = {
  push: (href: string, opts?: { scroll?: boolean }) => void;
  replace: (href: string, opts?: { scroll?: boolean }) => void;
};

type Updater<T> = (next: Partial<T>, opts?: { replace?: boolean }) => void;

export interface UseUrlStateOptions<T> {
  pathname: string;
  searchParams: URLSearchParams | ReadonlyURLSearchParamsLike;
  router: Router;
  defaults?: Partial<T>;
}

export interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
  toString(): string;
  forEach?(cb: (value: string, key: string) => void): void;
  entries?(): IterableIterator<[string, string]>;
}

function toSearchParams(sp: URLSearchParams | ReadonlyURLSearchParamsLike): URLSearchParams {
  if (sp instanceof URLSearchParams) return new URLSearchParams(sp);
  const next = new URLSearchParams();
  if (typeof (sp as ReadonlyURLSearchParamsLike).forEach === 'function') {
    (sp as ReadonlyURLSearchParamsLike).forEach!((value, key) => next.append(key, value));
  } else if (typeof (sp as ReadonlyURLSearchParamsLike).entries === 'function') {
    for (const [k, v] of (sp as ReadonlyURLSearchParamsLike).entries!()) next.append(k, v);
  } else {
    const str = sp.toString();
    if (str) {
      for (const [k, v] of new URLSearchParams(str)) next.append(k, v);
    }
  }
  return next;
}

/**
 * Reads + writes filter/pagination state to URL search params.
 * Returns the current state (string-typed) merged with defaults, plus a setter
 * that pushes/replaces the URL.
 */
export function useUrlState<T extends Record<string, string | number | boolean | undefined>>(
  opts: UseUrlStateOptions<T>
): [T, Updater<T>] {
  const { pathname, searchParams, router, defaults } = opts;

  const state = useMemo(() => {
    const out: Record<string, string | number | boolean | undefined> = { ...(defaults ?? {}) };
    if (typeof (searchParams as URLSearchParams).forEach === 'function') {
      (searchParams as URLSearchParams).forEach((value, key) => {
        out[key] = value;
      });
    } else if (typeof (searchParams as ReadonlyURLSearchParamsLike).entries === 'function') {
      for (const [k, v] of (searchParams as ReadonlyURLSearchParamsLike).entries!()) out[k] = v;
    }
    return out as T;
  }, [searchParams, defaults]);

  const set: Updater<T> = useCallback(
    (next, options) => {
      const merged = toSearchParams(searchParams);
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === null || value === '' || value === false) {
          merged.delete(key);
        } else {
          merged.set(key, String(value));
        }
      }
      const qs = merged.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (options?.replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, searchParams, router]
  );

  return [state, set];
}

export function getUrlString(sp: URLSearchParams | ReadonlyURLSearchParamsLike, key: string, fallback = ''): string {
  return sp.get(key) ?? fallback;
}

export function getUrlNumber(sp: URLSearchParams | ReadonlyURLSearchParamsLike, key: string, fallback = 0): number {
  const v = sp.get(key);
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getUrlBool(sp: URLSearchParams | ReadonlyURLSearchParamsLike, key: string, fallback = false): boolean {
  const v = sp.get(key);
  if (v == null) return fallback;
  return v === 'true' || v === '1';
}
