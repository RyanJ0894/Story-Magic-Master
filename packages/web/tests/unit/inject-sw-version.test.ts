/**
 * Smoke tests for the SW version injector script.
 *
 * The script edits packages/web/public/sw.js in place during build, replacing
 * a `__BUILD_VERSION__` placeholder with the commit SHA so every deploy
 * invalidates the prior SW cache automatically. The 2026-06-14 incident
 * (Chris saw CF 524 + stuck "Uploading..." UI in his regular browser but it
 * worked in incognito) was a stale SW intercepting fetches because the old
 * manual v3 → v4 → v5 bump pattern got skipped on some deploys.
 *
 * These tests don't invoke the script (they don't want to mutate the real
 * sw.js mid-test), they assert the source-controlled file holds the
 * placeholder so the script has something to replace.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

const SW_PATH = join(__dirname, '..', '..', 'public', 'sw.js');
const INJECTOR_PATH = join(__dirname, '..', '..', 'scripts', 'inject-sw-version.mjs');

describe('SW build-time version injection', () => {
  it('sw.js holds the __BUILD_VERSION__ placeholder so the injector can replace it', () => {
    const sw = readFileSync(SW_PATH, 'utf-8');
    expect(sw).toContain("CACHE_NAME = 'story-magic-__BUILD_VERSION__'");
  });

  it('injector regex matches the placeholder', () => {
    const injector = readFileSync(INJECTOR_PATH, 'utf-8');
    const match = injector.match(/const PATTERN = (\/[^/]+\/[gimsuy]*);/);
    expect(match, 'injector PATTERN literal not found').toBeTruthy();
    // Reconstruct and test against the sw.js content.
    const pattern = new RegExp(match![1].slice(1, match![1].lastIndexOf('/')));
    const sw = readFileSync(SW_PATH, 'utf-8');
    expect(pattern.test(sw), 'injector pattern must match the placeholder line').toBe(true);
  });

  it('injector regex is idempotent — also matches an already-injected value', () => {
    const injector = readFileSync(INJECTOR_PATH, 'utf-8');
    const match = injector.match(/const PATTERN = (\/[^/]+\/[gimsuy]*);/);
    const pattern = new RegExp(match![1].slice(1, match![1].lastIndexOf('/')));
    // Both should match — placeholder and a real commit SHA.
    expect(pattern.test("const CACHE_NAME = 'story-magic-__BUILD_VERSION__'")).toBe(true);
    expect(pattern.test("const CACHE_NAME = 'story-magic-abc1234'")).toBe(true);
    expect(pattern.test("const CACHE_NAME = 'story-magic-v5'")).toBe(true);
  });
});
