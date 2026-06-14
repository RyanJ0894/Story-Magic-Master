#!/usr/bin/env node
/**
 * Injects a per-build cache version into packages/web/public/sw.js so the
 * browser sees fresh service-worker bytes after every deploy. Without this,
 * the SW's CACHE_NAME has to be manually bumped each release (v3 → v4 → v5
 * in the changelog at the top of sw.js); skipping that bump leaves users on
 * stale cached responses indefinitely.
 *
 * 2026-06-14: Chris hit a CF 524 + "Uploading..." UI hang in his regular
 * browser that vanished in incognito — classic symptom of a stale SW
 * intercepting fetches. This script makes the invalidation automatic.
 *
 * Source of the version, in order:
 *   1. RENDER_GIT_COMMIT — Render sets this in build containers
 *   2. GITHUB_SHA        — convention for GitHub Actions
 *   3. `git rev-parse --short HEAD`
 *   4. Date.now() fallback (always fresh; not ideal but never wrong)
 *
 * Edits packages/web/public/sw.js IN PLACE in the build container. Never
 * commits the change — the source-controlled file keeps the placeholder.
 */

import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SW_PATH = resolve(__dirname, '..', 'public', 'sw.js');

function getVersion() {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT.slice(0, 7);
  if (process.env.GITHUB_SHA)         return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return `t${Date.now()}`;
  }
}

const version = getVersion();
const src = readFileSync(SW_PATH, 'utf8');

// Match either the placeholder OR a previously-injected value. Idempotent:
// running twice on the same source produces the same output.
const PATTERN = /const CACHE_NAME = 'story-magic-(?:__BUILD_VERSION__|[^']+)'/;
if (!PATTERN.test(src)) {
  console.error('[sw-version] CACHE_NAME line not found in', SW_PATH);
  process.exit(1);
}

const out = src.replace(PATTERN, `const CACHE_NAME = 'story-magic-${version}'`);
writeFileSync(SW_PATH, out);
console.log(`[sw-version] CACHE_NAME → 'story-magic-${version}' (in ${SW_PATH})`);
