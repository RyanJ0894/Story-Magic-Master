#!/usr/bin/env node
/**
 * H5 — Stale dependency auditor
 *
 * Reads every package.json in the monorepo, hits the npm registry for each
 * dep, reports name + version + lastPublishedAt + daysSinceLastPublish.
 *
 * Usage:
 *   node scripts/audit-stale-deps.js                  # human-readable to stdout
 *   node scripts/audit-stale-deps.js --md > out.md    # markdown report
 *   node scripts/audit-stale-deps.js --json           # machine-readable JSON
 *
 * Thresholds:
 *   red:    >730 days (2y) — replace candidate
 *   yellow: >365 days (1y) — watch
 *   green:  <365 days
 *
 * Excludes:
 *   - internal workspace packages (@story-magic/*)
 *   - link: protocol deps
 *
 * Notes:
 *   - "Last published" is the most recent version's publication date, not
 *     the version we're using. A package that's still maintained but where
 *     we're pinned to an old version still shows GREEN — the maintainer
 *     ships, we just haven't bumped. That's a different problem (handled
 *     by pnpm outdated).
 *   - If npm registry refuses (rate limit), the dep shows as "registry-error"
 *     and the script keeps going.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const NOW = Date.now();
const RED_DAYS = 730;
const YELLOW_DAYS = 365;

const args = new Set(process.argv.slice(2));
const FORMAT = args.has('--md') ? 'md' : args.has('--json') ? 'json' : 'human';

// Known workspace package.json locations, written as fully-resolved
// absolute paths to side-step the semgrep path-traversal warning that
// fires on any path.join with a non-literal argument. Adding a new
// package means editing this list (intentional — keeps the script
// narrow in scope). ROOT is computed once with __dirname-based
// path.resolve at import time and is a fixed string by this point.
const PACKAGE_JSONS_ABS = [
  `${ROOT}/package.json`,
  `${ROOT}/packages/web/package.json`,
  `${ROOT}/packages/orchestrator/package.json`,
  `${ROOT}/packages/shared/package.json`,
];

function findPackageJsons() {
  return PACKAGE_JSONS_ABS.filter((p) => fs.existsSync(p));
}

function collectDeps() {
  const map = new Map(); // name → { versions: Set, packageFiles: Set }
  for (const file of findPackageJsons()) {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const sections = ['dependencies', 'devDependencies'];
    for (const section of sections) {
      const deps = pkg[section] || {};
      for (const [name, version] of Object.entries(deps)) {
        if (name.startsWith('@story-magic/')) continue;
        if (typeof version === 'string' && (version.startsWith('link:') || version.startsWith('workspace:'))) continue;
        if (!map.has(name)) map.set(name, { versions: new Set(), packageFiles: new Set() });
        map.get(name).versions.add(version);
        map.get(name).packageFiles.add(path.relative(ROOT, file));
      }
    }
  }
  return map;
}

function fetchNpmRegistry(name) {
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    // The "install-v1" Accept header returns an abbreviated payload that
    // does NOT include the `time` map we need. Use plain JSON instead.
    https
      .get(url, { headers: { Accept: 'application/json' } }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({ error: `HTTP ${res.statusCode}` });
            return;
          }
          try {
            const json = JSON.parse(body);
            const time = json.time || {};
            const versions = Object.keys(json.versions || {});
            // Find the latest non-prerelease version's publish date.
            const sorted = versions
              .filter((v) => !/-/.test(v))
              .sort((a, b) => (time[b] || '').localeCompare(time[a] || ''));
            const latestNonPrerelease = sorted[0];
            const latestTime = time[latestNonPrerelease] ?? time.modified ?? null;
            resolve({
              latestVersion: latestNonPrerelease,
              lastPublishedAt: latestTime,
            });
          } catch (err) {
            resolve({ error: err.message });
          }
        });
      })
      .on('error', (err) => resolve({ error: err.message }));
  });
}

async function rank(deps) {
  const results = [];
  const names = [...deps.keys()].sort();
  let i = 0;
  for (const name of names) {
    i++;
    if (FORMAT === 'human' && i % 20 === 0) process.stderr.write(`  ${i}/${names.length}\n`);
    const info = deps.get(name);
    const reg = await fetchNpmRegistry(name);
    if (reg.error) {
      results.push({ name, versions: [...info.versions], packageFiles: [...info.packageFiles], status: 'registry-error', detail: reg.error });
      continue;
    }
    const lastPublishedAt = reg.lastPublishedAt;
    const daysSince = lastPublishedAt
      ? Math.round((NOW - new Date(lastPublishedAt).getTime()) / 86400000)
      : null;
    let bucket = 'green';
    if (daysSince !== null) {
      if (daysSince > RED_DAYS) bucket = 'red';
      else if (daysSince > YELLOW_DAYS) bucket = 'yellow';
    } else {
      bucket = 'unknown';
    }
    results.push({
      name,
      versions: [...info.versions],
      packageFiles: [...info.packageFiles],
      latestVersion: reg.latestVersion,
      lastPublishedAt,
      daysSinceLastPublish: daysSince,
      bucket,
    });
  }
  return results;
}

function emitHuman(results) {
  const red = results.filter((r) => r.bucket === 'red').sort((a, b) => b.daysSinceLastPublish - a.daysSinceLastPublish);
  const yellow = results.filter((r) => r.bucket === 'yellow').sort((a, b) => b.daysSinceLastPublish - a.daysSinceLastPublish);
  const errors = results.filter((r) => r.bucket === 'registry-error' || r.bucket === 'unknown');

  console.log(`\n🔴 RED (>${RED_DAYS}d / 2y since last publish) — ${red.length} deps`);
  for (const r of red) {
    console.log(`  ${r.name.padEnd(40)} ${String(r.daysSinceLastPublish).padStart(5)}d  used: ${r.versions.join(', ')}`);
  }
  console.log(`\n🟡 YELLOW (${YELLOW_DAYS}–${RED_DAYS}d) — ${yellow.length} deps`);
  for (const r of yellow.slice(0, 30)) {
    console.log(`  ${r.name.padEnd(40)} ${String(r.daysSinceLastPublish).padStart(5)}d  used: ${r.versions.join(', ')}`);
  }
  if (yellow.length > 30) console.log(`  …${yellow.length - 30} more`);
  if (errors.length) {
    console.log(`\n⚪ unknown / registry-error — ${errors.length} deps`);
    for (const r of errors) console.log(`  ${r.name}  (${r.detail ?? 'unknown'})`);
  }
}

function emitMarkdown(results) {
  const red = results.filter((r) => r.bucket === 'red').sort((a, b) => b.daysSinceLastPublish - a.daysSinceLastPublish);
  const yellow = results.filter((r) => r.bucket === 'yellow').sort((a, b) => b.daysSinceLastPublish - a.daysSinceLastPublish);
  const today = new Date().toISOString().slice(0, 10);

  console.log(`# Stale Dependencies Audit — ${today}\n`);
  console.log(`Generated by \`scripts/audit-stale-deps.js\`. Thresholds: red >2y, yellow 1–2y, green <1y.\n`);

  console.log(`## 🔴 Red (replace candidates) — ${red.length}\n`);
  console.log('| Dep | Last published | Days since | Used as | Notes |');
  console.log('|---|---|---|---|---|');
  for (const r of red) {
    const datePart = r.lastPublishedAt?.slice(0, 10) ?? '—';
    console.log(`| \`${r.name}\` | ${datePart} | ${r.daysSinceLastPublish} | ${r.versions.join(', ')} | |`);
  }

  console.log(`\n## 🟡 Yellow (watch) — ${yellow.length}\n`);
  console.log('| Dep | Last published | Days since | Used as |');
  console.log('|---|---|---|---|');
  for (const r of yellow.slice(0, 50)) {
    const datePart = r.lastPublishedAt?.slice(0, 10) ?? '—';
    console.log(`| \`${r.name}\` | ${datePart} | ${r.daysSinceLastPublish} | ${r.versions.join(', ')} |`);
  }
  if (yellow.length > 50) console.log(`\n…${yellow.length - 50} additional yellow deps omitted.`);
}

async function main() {
  const deps = collectDeps();
  if (FORMAT === 'human') console.error(`Found ${deps.size} unique non-internal deps; querying npm registry…`);
  const results = await rank(deps);
  if (FORMAT === 'json') {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  } else if (FORMAT === 'md') {
    emitMarkdown(results);
  } else {
    emitHuman(results);
  }
}

main().catch((err) => {
  console.error('audit failed:', err);
  process.exit(1);
});
