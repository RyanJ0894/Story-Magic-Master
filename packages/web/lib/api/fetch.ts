/**
 * Shared fetch wrapper for client-side API calls.
 *
 * Automatically includes the X-Requested-With header required by CSRF
 * validation when Origin/Referer headers are missing or stripped.
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'story-magic');
  }
  return fetch(input, { ...init, headers });
}
