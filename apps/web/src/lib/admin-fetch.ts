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
    // 6.10: production resolves tenant from the JWT — the API ignores
    // x-tenant-id unless ALLOW_TENANT_HEADER=true, which is dev-only.
    // Sending a localStorage-derived tenant in prod is at best inert and
    // at worst a spoof vector if the backend ever flipped the flag, so
    // gate it on the matching public env var.
    if (process.env['NEXT_PUBLIC_ALLOW_TENANT_HEADER'] === 'true') {
      const tenantId = localStorage.getItem('tenantId');
      if (tenantId) headers['x-tenant-id'] = tenantId;
    }
  }
  return headers;
}

/**
 * Unwrap the { data, meta } envelope from API responses.
 * Falls back to the raw JSON if the envelope pattern is not found.
 *
 * Defensive against null/undefined input: callers that pre-guard with
 * `await res.json().catch(() => null)` won't crash on later property
 * access — they'll just see an empty record. Combined with safeJson()
 * below this lets every error-branch read a stable shape.
 */
export function unwrapJson<T = any>(json: any): T {
  if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
    return json.data as T;
  }
  if (json === null || json === undefined) {
    return {} as T;
  }
  return json as T;
}

/**
 * Read a fetch Response as JSON, but never throw on non-JSON bodies.
 *
 * The previous pattern across the admin app was:
 *   if (!res.ok) {
 *     const err = unwrapJson(await res.json().catch(() => null));
 *     toast({ ..., description: err.error || '...' });
 *   }
 *
 * That throws SyntaxError when the response is HTML (Next.js 5xx error
 * pages, gateway timeouts, proxy disconnects). The catch then surfaces a
 * cryptic "Unexpected token '<'..." instead of the real status. This
 * helper guards on `content-type` first and unwraps the standard
 * `{ data, meta }` envelope; on non-JSON bodies it returns a synthetic
 * error shape with the HTTP status so callers can still pull a message.
 *
 * Always prefer this over `unwrapJson(await res.json().catch(() => null))`.
 */
export async function safeJson<T = any>(res: Response): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json') || contentType.includes('+json');
  let parsed: any = null;
  if (isJson) {
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
  }
  // Envelope-aware: { data, meta } -> data, otherwise pass through.
  const data: T | null = parsed
    ? (typeof parsed === 'object' && 'data' in parsed && 'meta' in parsed
        ? (parsed.data as T)
        : (parsed as T))
    : null;

  if (res.ok) {
    return { ok: true, status: res.status, data, error: null };
  }

  // Best-effort error message — try every shape we've seen the API use.
  const errorPayload = parsed && typeof parsed === 'object'
    ? (('data' in parsed && 'meta' in parsed && parsed.data) || parsed)
    : null;
  const error =
    errorPayload?.message ??
    errorPayload?.error ??
    (res.statusText ? `${res.status} ${res.statusText}` : `HTTP ${res.status}`);

  return { ok: false, status: res.status, data, error };
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
