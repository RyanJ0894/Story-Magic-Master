/**
 * Resolves an audio filePath to a playable URL.
 *
 * Absolute URLs (http/https) are returned as-is.
 * Relative paths are prefixed with the orchestrator base URL so the browser
 * can reach the /audio static file server on the orchestrator service.
 *
 * This avoids the "audio static" bug where relative paths were passed directly
 * to `new Audio()`, causing the browser to resolve them against the web origin
 * and receive a 404 HTML page that plays back as static noise.
 */
export function resolveAudioUrl(filePath: string | undefined | null): string {
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const base = (process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? '').replace(/\/+$/, '');
  const path = filePath.replace(/^\/+/, '');
  return `${base}/audio/${path}`;
}
