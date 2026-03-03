/**
 * Admin-side fetch utility that:
 * 1. Adds auth + tenant headers automatically
 * 2. Unwraps the standardized { data, meta } API response envelope
 */

function getAdminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) headers['x-tenant-id'] = tenantId;
  }
  return headers;
}

/**
 * Unwrap the { data, meta } envelope from API responses.
 * Falls back to the raw JSON if the envelope pattern is not found.
 */
export function unwrapJson<T = any>(json: any): T {
  if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
    return json.data as T;
  }
  return json as T;
}

/**
 * Fetch wrapper for admin pages that auto-attaches auth headers.
 * Returns a standard Response (does NOT unwrap — call unwrapJson on .json() result).
 */
export async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  const authHeaders = getAdminHeaders();
  const existingHeaders = options?.headers
    ? options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : (options.headers as Record<string, string>)
    : {};

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...existingHeaders,
    },
  });
}
