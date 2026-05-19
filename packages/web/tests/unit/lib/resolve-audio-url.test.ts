/**
 * Tests for resolveAudioUrl utility.
 *
 * Regression coverage for "audio static" bug:
 *   Relative filePaths passed directly to new Audio() resolved against the
 *   web origin → 404 HTML page → decoded as audio = static noise.
 *   resolveAudioUrl prefixes relative paths with NEXT_PUBLIC_ORCHESTRATOR_URL.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('resolveAudioUrl', () => {
  const ORCHESTRATOR = 'https://story-magic-orchestrator.onrender.com';

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ORCHESTRATOR_URL', ORCHESTRATOR);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Re-import after stubbing env so the module picks up the new value
  async function getResolver() {
    vi.resetModules();
    const { resolveAudioUrl } = await import('@/lib/resolve-audio-url');
    return resolveAudioUrl;
  }

  it('returns absolute http URL unchanged', async () => {
    const resolveAudioUrl = await getResolver();
    const url = 'https://storage.example.com/audio/file.m4a';
    expect(resolveAudioUrl(url)).toBe(url);
  });

  it('returns absolute https URL unchanged', async () => {
    const resolveAudioUrl = await getResolver();
    const url = `${ORCHESTRATOR}/audio/abc123/episode-0.m4a`;
    expect(resolveAudioUrl(url)).toBe(url);
  });

  it('prefixes relative path with orchestrator base + /audio/', async () => {
    const resolveAudioUrl = await getResolver();
    expect(resolveAudioUrl('abc123/episode-0.m4a')).toBe(
      `${ORCHESTRATOR}/audio/abc123/episode-0.m4a`
    );
  });

  it('handles relative path with no directory component', async () => {
    const resolveAudioUrl = await getResolver();
    expect(resolveAudioUrl('episode.m4a')).toBe(
      `${ORCHESTRATOR}/audio/episode.m4a`
    );
  });

  it('falls back to empty string prefix when env var is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_ORCHESTRATOR_URL', '');
    const resolveAudioUrl = await getResolver();
    expect(resolveAudioUrl('abc123/episode.m4a')).toBe('/audio/abc123/episode.m4a');
  });

  it('does not double-prefix an already-absolute orchestrator URL', async () => {
    const resolveAudioUrl = await getResolver();
    const absolute = `${ORCHESTRATOR}/audio/abc123/episode.m4a`;
    const result = resolveAudioUrl(absolute);
    // Must not become orchestratorUrl/audio/orchestratorUrl/audio/...
    expect(result).toBe(absolute);
    expect(result).not.toContain(`${ORCHESTRATOR}/audio/${ORCHESTRATOR}`);
  });
});
