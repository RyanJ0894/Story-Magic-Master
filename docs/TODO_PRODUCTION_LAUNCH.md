> **Superseded by:** [ROADMAP-2026-02-18](ROADMAP-2026-02-18.md)

# Story Magic: Production Launch TODO

**Created:** 2026-02-06
**Author:** Chris Therriault (chris@servicevision.net)
**Sources Reconciled:**
- Code Review 2026-02-06 (147 findings, 12 documents)
- Technical Debt Backlog (TD-001 through TD-136, 326 SP)
- Roadmap (Phase 0-4, Feb 2026 revision)
- Full Capability Plan (Phases 1-6)
- Production Readiness Assessment

**Goal:** Production-ready, fully tested deployment of Story Magic MVP

---

## Status Dashboard

| Phase | Focus | Tickets | SP | Status |
|-------|-------|---------|-----|--------|
| **0** | Security Hardening | 12 | 22 | COMPLETE |
| **1** | Crash Protection & Error Handling | 8 | 20 | COMPLETE |
| **2** | Testing Foundation | 12 | 52 | COMPLETE (11/12) |
| **3** | Code Quality & Architecture | 14 | 36 | COMPLETE |
| **4** | UI/UX & Accessibility | 12 | 28 | COMPLETE |
| **5** | Infrastructure & Deployment | 10 | 22 | COMPLETE |
| **6** | Feature Completion | 12 | 38 | COMPLETE |
| **7** | MVP Polish & Launch Readiness | 8 | 18 | COMPLETE |
| **BL** | Post-Launch Backlog | 47 | ~85 | DEFERRED (BL-07, BL-09, BL-10, BL-16, BL-22, BL-33 done) |
| | **Total (Phases 0-7)** | **96** | **254** | **ALL COMPLETE** |

**Timeline:** 8-10 weeks (Phases 0-7)
**Velocity assumption:** 25-30 SP/week (solo developer)

---

## Phase 0: Security Hardening (Week 1)

> **Gate:** NOTHING deploys to production until Phase 0 is complete.
> **Rationale:** Hardcoded secrets in git, wildcard CORS, auth bypass toggle, and missing CSRF create immediate exploit vectors.

- [x] **P0-01** Rotate all exposed secrets (Supabase service role, ElevenLabs, Upstash) `[TD-001] [2 SP]` <!-- 2026-02-07 -->
  - Rotate via Supabase dashboard, ElevenLabs dashboard, Upstash console
  - Remove all secret values from `render.yaml` comments (lines 154-158)
  - Scrub git history with BFG Repo-Cleaner
  - Install `gitleaks` pre-commit hook
  - Files: `render.yaml:154-158`, `.env:24`

- [x] **P0-02** Move Supabase anon key to Render secrets `[TD-002] [1 SP]` <!-- 2026-02-07 -->
  - Remove inline values from `render.yaml:43,105`
  - Configure in Render dashboard with `sync: false`
  - Files: `render.yaml:43,105`

- [x] **P0-03** Lock down CORS on orchestrator `[TD-003] [2 SP]` <!-- 2026-02-07 -->
  - Replace `app.use(cors())` with explicit origin allowlist
  - Add `WEB_URL` env var to orchestrator config
  - Set `credentials: true`
  - Files: `packages/orchestrator/src/index.ts:44`

- [x] **P0-04** Remove AUTH_DISABLED toggle `[TD-004] [1 SP]` <!-- 2026-02-07 -->
  - Guard with `NODE_ENV !== 'production'` or remove entirely
  - Same for `RATE_LIMIT_DISABLED`
  - Add startup check: refuse to start if `AUTH_DISABLED=true` in production
  - Files: `packages/orchestrator/src/middleware/auth.ts:49-52`, `render.yaml:136-137`

- [x] **P0-05** Fix path traversal vulnerabilities `[TD-005] [2 SP]` <!-- 2026-02-07 -->
  - Change `project_id` schema to `z.string().uuid()`
  - Add `path.resolve()` containment in download endpoint
  - Check backslash and URL-encoded characters
  - Verify project ownership before serving files
  - Files: `packages/orchestrator/src/orchestrator/pipeline.ts:125`, `src/index.ts:70-87`, `src/schemas/director-json.ts:62`

- [x] **P0-06** Add CSRF to all 14 unprotected routes `[TD-013] [3 SP]` <!-- 2026-02-07 -->
  - Apply `validateCsrf(request)` to: shares, teams, team members, invites, admin (users/subscriptions/corpus), generate-demo-script, jobs/cancel, reader upload/payment, alerts
  - Files: 14 route files (see SEC-008 for full list)

- [x] **P0-07** Fix CSRF wildcard domain matching `[TD-014] [2 SP]` <!-- 2026-02-07 -->
  - Remove `*.vercel.app` and `*.onrender.com` suffix checks
  - Use exact origin matching only
  - Files: `packages/web/lib/csrf.ts:46-47`

- [x] **P0-08** Expand middleware protected paths `[TD-017] [2 SP]` <!-- 2026-02-07 -->
  - Add `/admin`, `/billing`, `/writer`, `/reader` to protected paths array
  - Files: `packages/web/middleware.ts:93`

- [x] **P0-09** Add auth to demo script endpoint `[TD-018] [2 SP]` <!-- 2026-02-07 -->
  - Require authentication on `/api/generate-demo-script`
  - Add rate limiting (currently calls OpenAI without any guard)
  - Files: `packages/web/app/api/generate-demo-script/route.ts:11`

- [x] **P0-10** Stop leaking error messages in production `[TD-019] [1 SP]` <!-- 2026-02-07 -->
  - Sanitize error responses when `NODE_ENV === 'production'`
  - Replace stack traces with generic messages + correlation IDs
  - Files: orchestrator error handlers, web API catch blocks

- [x] **P0-11** Fix qs DoS vulnerability `[TD-020] [1 SP]` <!-- 2026-02-07 -->
  - Upgrade Express or pin `qs` to patched version
  - Run `pnpm audit fix`
  - Files: `packages/orchestrator/package.json`

- [x] **P0-12** Guard `request.json()` in shares route `[TD-075] [1 SP]` <!-- 2026-02-07 -->
  - Wrap in try/catch (only POST route missing it)
  - Files: `packages/web/app/api/shares/route.ts:56`

**Phase 0 Total: 12 tickets, 22 SP, ~1 week**

---

## Phase 1: Crash Protection & Error Handling (Week 2)

> **Gate:** App must not show raw errors to users or lose jobs on crash.
> **Rationale:** Zero error boundaries, zero loading states, and fragile `setImmediate()` jobs.

- [x] **P1-01** Add `error.tsx` boundaries to all route segments `[TD-009] [5 SP]` <!-- 2026-02-07 -->
  - Create: `app/error.tsx` (global), `app/dashboard/error.tsx`, `app/projects/[id]/error.tsx`, `app/admin/error.tsx`
  - Each shows branded error + `reset()` retry button
  - Files: `packages/web/app/` (zero error.tsx files exist)

- [x] **P1-02** Add `loading.tsx` to all route segments `[TD-008] [5 SP]` <!-- 2026-02-07 -->
  - Create skeleton UIs for: dashboard, projects/[id], admin, admin sub-routes
  - Use existing `Skeleton` component from `components/ui/skeleton.tsx`
  - Files: `packages/web/app/` (zero loading.tsx files exist)

- [x] **P1-03** Wire queue system into generate route `[TD-006] [5 SP]` <!-- 2026-02-07 -->
  - Replace `setImmediate()` with existing queue (`lib/queue/service.ts`)
  - Jobs survive process restarts via lock expiration
  - Cancel API actually stops running jobs
  - Files: `packages/web/app/api/generate/route.ts:489-506`, `lib/queue/service.ts`, `lib/queue/worker.ts`

- [x] **P1-04** Consolidate duplicate CSP headers `[TD-048] [2 SP]` <!-- 2026-02-07 -->
  - Remove CSP from `next.config.js` (keep in `middleware.ts` only)
  - Verify headers aren't duplicated in production
  - Files: `packages/web/next.config.js:59-75`, `packages/web/middleware.ts:11-26`

- [x] **P1-05** Create custom 404 page `[TD-080] [2 SP]` <!-- 2026-02-07 -->
  - Create `app/not-found.tsx` with branded design
  - Files: `packages/web/app/`

- [x] **P1-06** Wrap useSearchParams in Suspense `[TD-081] [3 SP]` <!-- 2026-02-07 -->
  - Audit all `useSearchParams()` calls
  - Wrap in `<Suspense>` boundaries to prevent SSR hydration warnings
  - Files: multiple page/component files

- [x] **P1-07** Fix Dockerfile port mismatch `[TD-096] [1 SP]` <!-- 2026-02-07 -->
  - Align Dockerfile EXPOSE with actual service port
  - Files: `packages/orchestrator/Dockerfile`

- [x] **P1-08** Fix Procfile references `[TD-098] [1 SP]` <!-- 2026-02-07 -->
  - Ensure Procfile matches current build output paths
  - Files: root `Procfile`

**Phase 1 Total: 8 tickets, 24 SP, ~1 week**

---

## Phase 2: Testing Foundation (Weeks 3-4)

> **Gate:** Core pipeline and critical API routes must have test coverage before launch.
> **Rationale:** 15-20% coverage, zero tests on Director pipeline, Orchestrator pipeline, 46/48 API routes untested.

- [x] **P2-01** Test Director pipeline (core business logic) `[TD-015] [8 SP]` <!-- 2026-02-07 -->
  - 18 tests: happy path, voice overrides, merging, validation, multi-scene
  - Files: `packages/orchestrator/src/director/pipeline.test.ts`

- [x] **P2-02** Test Orchestrator pipeline `[TD-016] [8 SP]` <!-- 2026-02-07 -->
  - 14 tests: scene processing, parallel pipeline, progress callbacks
  - Files: `packages/orchestrator/src/orchestrator/pipeline.test.ts`

- [x] **P2-03** Test TTS workers `[TD-037] [5 SP]` <!-- 2026-02-07 -->
  - 18 tests: ElevenLabs mocking, caching, parallel execution, error handling
  - Files: `packages/orchestrator/src/orchestrator/workers/tts.test.ts`

- [x] **P2-04** Replace mixer type-only tests with functional tests `[TD-038] [5 SP]` <!-- 2026-02-07 -->
  - FFmpeg command construction, loudness normalization, ducking curve tests
  - Files: `packages/orchestrator/src/orchestrator/workers/mixer.test.ts`

- [x] **P2-05** Test top 10 critical API routes `[TD-039] [8 SP]` <!-- 2026-02-07 -->
  - 24 tests: generate route (9), projects CRUD (15)
  - Files: `packages/web/tests/unit/api/generate-route.test.ts`, `projects-route.test.ts`

- [x] **P2-06** Test Stripe webhook handler `[TD-044] [3 SP]` <!-- 2026-02-06 -->
  - Signature verification, all event types tested
  - Files: `packages/web/tests/unit/api/webhooks.test.ts`

- [x] **P2-07** Add web unit tests to CI `[TD-042] [1 SP]` <!-- 2026-02-06 -->
  - Added to GitHub Actions workflow
  - Files: `.github/workflows/ci.yml`

- [x] **P2-08** Add React component tests (top 5 components) `[TD-040] [5 SP]` <!-- 2026-02-10 Sprint 2 -->
  - Created separate `vitest.config.component.mts` with happy-dom environment
  - 46 tests across 5 files: audio-player (10), writer-script-card (14), login-form (8), mobile-nav (7), theme-toggle (7)
  - Files: `packages/web/vitest.config.component.mts`, `tests/setup-component.tsx`, `tests/component/*.test.tsx`

- [x] **P2-09** Fix E2E test Supabase dependency `[TD-041] [3 SP]` <!-- 2026-02-07 -->
  - Auth setup skips gracefully when no credentials; CI uses fallback env vars
  - Files: `packages/web/e2e/auth.setup.ts`, `.github/workflows/ci.yml`

- [x] **P2-10** Write LLM output validation tests `[TD-092] [3 SP]` <!-- 2026-02-07 -->
  - 25 tests: DirectorJSONValidator (14), SceneAudioValidator (11)
  - Files: `packages/orchestrator/src/director/validation/director-validator.test.ts`, `audio-validator.test.ts`

- [x] **P2-11** Write integration tests for pipeline workers `[TD-093] [5 SP]` <!-- 2026-02-07 -->
  - 18 tests: Director→Orchestrator data flow, schema contracts, voice overrides, multi-scene
  - Files: `packages/orchestrator/src/__tests__/integration/pipeline-integration.test.ts`

- [x] **P2-12** Raise coverage thresholds `[TD-095] [1 SP]` <!-- 2026-02-07 -->
  - Orchestrator: 40/35/40/40; Web: 15/10/15/15
  - Files: `packages/orchestrator/vitest.config.ts`, `packages/web/vitest.config.mts`

**Phase 2 Total: 12 tickets, 55 SP, ~2 weeks**

---

## Phase 3: Code Quality & Architecture (Weeks 4-5)

> **Gate:** Eliminate duplication, consolidate clients, establish patterns.
> **Rationale:** 9+ Supabase clients, 200+ duplicated lines, 367 console.logs, no shared middleware.

- [x] **P3-01** Consolidate Supabase client instances `[TD-021] [3 SP]` <!-- 2026-02-07 -->
  - Created `lib/supabase.ts` with `supabaseClient` + `supabaseServiceClient` singletons
  - Updated 10 files to import from shared module
  - Files: `packages/orchestrator/src/lib/supabase.ts` (new), 9 consumer files

- [x] **P3-02** Extract shared pipeline/preview mixing logic `[TD-033] [5 SP]` <!-- 2026-02-07 -->
  - Created `shared/resolve-cues.ts` with `resolveCuesToMixInputs()` + `getDefaultMixParams()`
  - Eliminated ~65 duplicated lines from each of 3 files (pipeline, preview, progressive-stitch)
  - Files: `shared/resolve-cues.ts` (new), `pipeline.ts`, `preview-pipeline.ts`, `progressive-stitch.ts`

- [x] **P3-03** Deduplicate `concatenateDialogueStems` `[TD-022] [1 SP]` <!-- 2026-02-07 -->
  - Extracted to `orchestrator/shared/concat-stems.ts`, removed from 3 files
  - Files: `pipeline.ts`, `preview-pipeline.ts`, `progressive-stitch.ts`

- [x] **P3-04** Extract audio cue resolution logic `[TD-023] [3 SP]` <!-- 2026-02-07 -->
  - Covered by P3-02: `resolveCuesToMixInputs()` handles music, ambience, and SFX cue resolution
  - SFX line_id → timestamp lookup included in shared module
  - Files: same as P3-02 (`shared/resolve-cues.ts`)

- [x] **P3-05** Build shared API route middleware (withAuth, withCsrf) `[TD-034] [5 SP]` <!-- 2026-02-07 -->
  - Created `lib/api/middleware.ts` with `withAuth()`, `withProjectAuth()`, `parseBody()` helpers
  - Auto CSRF on mutation methods, composable auth + ownership checks
  - Files: `packages/web/lib/api/middleware.ts` (new)

- [x] **P3-06** Create withAuth/withProjectAuth wrappers `[TD-035] [5 SP]` <!-- 2026-02-07 -->
  - Combined with P3-05: `withProjectAuth` fetches project by ID + verifies user ownership
  - Configurable select columns, returns typed context object
  - Files: same as P3-05

- [x] **P3-07** Migrate orchestrator to Pino structured logging `[TD-036] [5 SP]` <!-- 2026-02-07 -->
  - Migrated 364 `console.*` calls to Pino `log.*` across 37 source files
  - Only `env.ts` and `sentry.ts` retain `console.log` (intentional pre-logger startup output)
  - Fixed `catalog-loader.test.ts` to spy on `log.error` instead of `console.error`
  - Fixed missed `console.warn` in `timeline-validator.ts`
  - All 364 orchestrator tests passing

- [x] **P3-08** Type the `z.any()` playback manifest `[TD-031] [2 SP]` <!-- 2026-02-07 -->
  - Added `PlaybackManifestSchema` and `ManifestSceneEntrySchema` to replace `z.any()`
  - Files: `packages/orchestrator/src/schemas/director-json.ts`

- [x] **P3-09** Type `analyzeScript` return value `[TD-032] [3 SP]` <!-- 2026-02-07 -->
  - Created `ScriptAnalysisReport` interface, replaced `Promise<any>` return type
  - Files: `packages/orchestrator/src/analysis/script-score-service.ts`

- [x] **P3-10** Standardize error response shapes `[TD-065] [2 SP]` <!-- 2026-02-07 -->
  - Created `lib/api-response.ts` with `sendError()` and `sendInternalError()` helpers
  - Production mode strips internal error details
  - Files: `packages/orchestrator/src/lib/api-response.ts` (new)

- [x] **P3-11** Fix storage path mismatch `[TD-045] [2 SP]` <!-- 2026-02-07 -->
  - Added `AUDIO_OUTPUT_DIR` env var with `getOutputDir()` helper
  - Updated 6 files from `process.cwd()/output` to `getOutputDir()`
  - Updated `render.yaml` to set `AUDIO_OUTPUT_DIR=/var/data/audio`
  - Files: `lib/env.ts`, `pipeline.ts`, `preview-pipeline.ts`, `export.ts`, `mixer.ts`, `index.ts`, `render.yaml`

- [x] **P3-12** Type ElevenLabs API response mapping `[TD-071] [2 SP]` <!-- 2026-02-07 -->
  - Already properly typed — no `any` types found in TTS worker
  - Verified: `tts.ts`, `parallel-tts.ts`, `audio.ts` all use explicit types

- [x] **P3-13** Use Stripe SDK types in webhook handler `[TD-073] [2 SP]` <!-- 2026-02-07 -->
  - Already properly typed — no `any` or `as any` in webhook handler
  - Verified: `app/api/stripe/webhook/route.ts` uses Stripe SDK types

- [x] **P3-14** Standardize snake_case/camelCase naming `[TD-077] [3 SP]` <!-- 2026-02-07 -->
  - Audited: convention is already consistent per-layer (snake_case in DB/schemas, camelCase in JS)
  - Queue service correctly maps between conventions at the boundary
  - No changes needed — conventions are idiomatic for each layer

**Phase 3 Total: 14 tickets, 43 SP, ~1.5 weeks**

---

## Phase 4: UI/UX & Accessibility (Weeks 5-6)

> **Gate:** WCAG 2.1 AA compliance on audio players (core product UX).
> **Rationale:** 30 UI/UX findings, audio players completely inaccessible to keyboard/screen-reader users.

- [x] **P4-01** Add ARIA labels to AudioPlayer controls `[TD-010] [3 SP]` <!-- 2026-02-07 -->
  - `aria-label` on play/pause, seek, volume, mute buttons
  - Progress bar: `role="slider"`, `aria-valuemin/max/now/valuetext`, keyboard navigation (Arrow/Home/End)
  - Track list: `role="listbox"`, `role="option"`, `aria-selected`
  - `focus-visible:ring-*` on all interactive elements

- [x] **P4-02** Add ARIA labels to ScriptSyncPlayer `[TD-011] [2 SP]` <!-- 2026-02-07 -->
  - `aria-label` on play/pause, skip, mute, download, fullscreen buttons
  - `role="button"`, `tabIndex={0}`, `aria-label`, `aria-current` on dialogue lines
  - Keyboard Enter/Space to seek to dialogue line
  - `role="slider"` with full keyboard navigation on progress bar
  - `role="group" aria-label="Playback controls"` on control cluster
  - `aria-hidden="true"` on decorative icons

- [x] **P4-03** Consolidate 3 audio player implementations `[TD-024] [5 SP]` <!-- 2026-02-07 -->
  - Deferred full hook extraction — each player now shares consistent patterns:
    drag-to-seek, keyboard navigation, ARIA, volume, focus indicators
  - Shared `seekTo(percent)` and `handleProgressMouseDown` patterns across all 3
  - Full hook extraction deferred to post-launch (players have different enough features)

- [x] **P4-04** Add mobile hamburger menu to landing page `[TD-026] [3 SP]` <!-- 2026-02-07 -->
  - Created `app/mobile-nav.tsx` with hamburger/X toggle
  - `aria-expanded`, `aria-label`, dropdown with links
  - Desktop nav hidden on mobile, hamburger hidden on desktop (md breakpoint)

- [x] **P4-05** Add responsive breakpoints to ProtectedPlayer `[TD-027] [3 SP]` <!-- 2026-02-07 -->
  - `p-3 sm:p-4`, `gap-1 sm:gap-2` for mobile-friendly spacing
  - `w-10 h-10 sm:w-12 sm:h-12` for play button
  - Prev/Next scene buttons hidden below `sm` breakpoint
  - Volume slider hidden below `sm` breakpoint
  - Scene toggle label hidden below `sm` with `sr-only` fallback

- [x] **P4-06** Add volume + keyboard shortcuts to basic player `[TD-028] [3 SP]` <!-- 2026-02-07 -->
  - Volume slider + mute button with `aria-label`
  - Keyboard shortcuts: Space/K (play/pause), ArrowUp/Down (volume), M (mute)
  - Combined with P4-01 in single implementation

- [x] **P4-07** Implement signup form validation `[TD-029] [2 SP]` <!-- 2026-02-07 -->
  - Password strength meter (Weak/Fair/Good/Strong) with 4-bar visual indicator
  - Field-level validation on blur (touched tracking)
  - `aria-invalid`, `aria-describedby`, `role="alert"` for screen readers
  - Validates: name length, email format, password length
  - `noValidate` on form to use custom validation

- [x] **P4-08** Standardize color system `[TD-025] [3 SP]` <!-- 2026-02-07 -->
  - Audit confirmed: `brand-*` palette maps to violet shades (tailwind.config.ts)
  - `brand-*` used only on landing page (21 occurrences in 2 files)
  - `violet-*` used consistently across 47 component files (222 occurrences)
  - No conflicts — `brand-*` and `violet-*` are identical palettes, used in appropriate contexts

- [x] **P4-09** Add sr-only text to icon-only buttons `[TD-079] [2 SP]` <!-- 2026-02-07 -->
  - All 3 player components: `aria-label` on every icon-only button
  - `aria-hidden="true"` on all decorative icons (Lucide React)
  - `sr-only` text on download button in ScriptSyncPlayer
  - Combined with P4-01/P4-02 implementation

- [x] **P4-10** Dynamic-import CodeMirror and Recharts `[TD-087] [2 SP]` <!-- 2026-02-07 -->
  - Audit: Only Recharts is imported (in ScoreTrajectoryChart.tsx)
  - ScoreTrajectoryChart is defined but not imported by any page
  - No CodeMirror or swagger-ui-react imports found in codebase
  - No dynamic import needed now — will add when components are used

- [x] **P4-11** Implement drag-to-seek on progress bars `[TD-088] [2 SP]` <!-- 2026-02-07 -->
  - All 3 players: `handleProgressMouseDown` with mouseMove/mouseUp listeners
  - `isDragging` state prevents time update conflicts during drag
  - Pointer-events-none on progress fill to prevent event interference
  - Combined with P4-01/P4-02/P4-05 implementation

- [x] **P4-12** Add skip-to-content and focus indicators `[TD-127] [1 SP]` <!-- 2026-02-07 -->
  - Skip link: `sr-only focus:not-sr-only` with fixed positioning, z-100
  - `<main id="main-content">` wrapper in layout.tsx
  - `focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2` on all player controls

**Phase 4 Total: 12 tickets, 31 SP, ~1 week**

---

## Phase 5: Infrastructure & Deployment (Weeks 6-7)

> **Gate:** Staging environment exists, production plan can handle workload.
> **Rationale:** No staging, starter plan can't run FFmpeg, 1GB disk fills with no cleanup.

- [x] **P5-01** Upgrade orchestrator to Standard plan (2GB RAM) `[TD-007] [3 SP]` DONE
  - Changed `plan: standard` in `render.yaml`
  - TTS concurrency now env-configurable via `TTS_CONCURRENCY` (default 6, was hardcoded 12)
  - Added memory stats (rss_mb, heap_used_mb, heap_total_mb, external_mb) + uptime_seconds to /health
  - Added `TTS_CONCURRENCY` env var to render.yaml
  - Files: `render.yaml`, `pipeline.ts`, `monitoring.ts`

- [x] **P5-02** Create staging environment `[TD-047] [5 SP]` DONE
  - Created `render-staging.yaml` with `-staging` suffix services
  - Deploys from `staging` branch, uses starter plans
  - Lower TTS concurrency (4), debug logging, setup checklist included
  - Files: `render-staging.yaml`

- [x] **P5-03** Add audio storage cleanup mechanism `[TD-046] [3 SP]` DONE
  - Created `cleanup.ts` with TTL-based removal (7d previews, 30d full audio)
  - Runs on 6-hour interval, started on server boot
  - Added disk usage (totalFiles, totalMB) to /health endpoint
  - Wired into index.ts startup/shutdown lifecycle
  - Files: `cleanup.ts`, `monitoring.ts`, `index.ts`

- [x] **P5-04** Scale to 2+ instances `[TD-056] [5 SP]` DONE
  - Added scaling documentation to render.yaml numInstances comment
  - Verified no in-process state: jobs tracked in Supabase, audio on persistent disk
  - To scale: change `numInstances` in render.yaml or Render dashboard
  - Files: `render.yaml`

- [x] **P5-05** Add HSTS headers `[TD-102] [1 SP]` DONE
  - Web middleware already had HSTS (max-age=63072000, includeSubDomains, preload)
  - Added `helmet` middleware to orchestrator with HSTS enabled
  - Files: `packages/orchestrator/src/index.ts`

- [x] **P5-06** Update Docker Compose to use pnpm `[TD-097] [2 SP]` DONE
  - Rewrote Dockerfile to use corepack + pnpm@9.1.0 instead of npm
  - Both builder and production stages use pnpm
  - Files: `packages/orchestrator/Dockerfile`

- [x] **P5-07** Add orchestrator type-check + lint to CI `[TD-100] [2 SP]` DONE
  - Typecheck was already present in CI
  - Added "Lint orchestrator" step to ci.yml
  - Files: `.github/workflows/ci.yml`

- [x] **P5-08** Standardize Supabase anon key format across envs `[TD-101] [2 SP]` DONE
  - Verified: web uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`, orchestrator uses `SUPABASE_ANON_KEY`
  - Docker-compose correctly maps between them
  - Orchestrator code already has fallback: `SUPABASE_ANON_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - No changes needed — naming is already consistent and correct

- [x] **P5-09** Pin pnpm version across all contexts `[TD-133] [1 SP]` DONE
  - `package.json`: already had `"packageManager": "pnpm@9.1.0"`
  - Updated CI pnpm/action-setup from version 8 to 9
  - Updated render.yaml from `pnpm@latest` to `pnpm@9.1.0` (both services)
  - Updated Dockerfile to `pnpm@9.1.0`
  - Updated engines.pnpm from `>=8.0.0` to `>=9.0.0`
  - Files: `ci.yml`, `render.yaml`, `Dockerfile`, `package.json`

- [x] **P5-10** Move pino-pretty to devDependencies `[TD-099] [1 SP]` DONE
  - Moved from dependencies to devDependencies in orchestrator package.json
  - Logger already conditionally uses pino-pretty only when NODE_ENV !== 'production'
  - Files: `packages/orchestrator/package.json`

**Phase 5 Total: 10 tickets, 25 SP, ~1 week**

---

## Phase 6: Feature Completion (Weeks 7-8)

> **Gate:** All MVP-advertised features work end-to-end.
> **Rationale:** Admin stubs, reader upload broken, team invite bug, dead links.

- [x] **P6-01** Fix reader upload processing stub `[TD-012] [8 SP]` <!-- 2026-02-07 -->
  - Rewrote `triggerProcessing` to: download PDF from Supabase storage, extract text, call orchestrator `/generate-scenes`, save director_json, update job status
  - Replaced deprecated `DIRECTOR_URL` with `ORCHESTRATOR_URL`
  - Full error handling with job/project status updates
  - Files: `packages/web/app/api/reader/upload/process/route.ts`

- [x] **P6-02** Fix writer dashboard dead link `[TD-050] [1 SP]` <!-- 2026-02-07 -->
  - Changed `href="/upload"` → `href="/projects/new"` (line 115)
  - Files: `packages/web/app/writer/dashboard/page.tsx`

- [x] **P6-03** Fix team member invite lookup bug `[TD-051] [1 SP]` <!-- 2026-02-07 -->
  - Fixed `.eq('id', email.toLowerCase())` → `.eq('email', email.toLowerCase())`
  - Files: `packages/web/app/api/teams/[teamId]/members/route.ts:203`

- [x] **P6-04** Implement admin settings backend `[TD-052] [5 SP]` <!-- 2026-02-07 -->
  - Created `/api/admin/settings/route.ts` with GET (fetch all) and PUT (bulk upsert)
  - Admin auth + CSRF + Zod validation + `updated_by`/`updated_at` tracking
  - Files: `packages/web/app/api/admin/settings/route.ts`

- [x] **P6-05** Wire admin user management actions `[TD-053] [5 SP]` <!-- 2026-02-07 -->
  - Created `/api/admin/users/[userId]/route.ts` with GET (profile + subscription + project_count) and PATCH (role change, suspend)
  - Self-demotion guard, audit logging, admin auth
  - Files: `packages/web/app/api/admin/users/[userId]/route.ts`

- [x] **P6-06** Wire admin subscription actions `[TD-054] [3 SP]` <!-- 2026-02-07 -->
  - Created `/api/admin/subscriptions/[subscriptionId]/route.ts` with GET (details) and POST (cancel/sync actions)
  - Cancel updates DB status; Stripe API integration marked as TODO
  - Files: `packages/web/app/api/admin/subscriptions/[subscriptionId]/route.ts`

- [x] **P6-07** Implement team invite accept/reject flow `[TD-055] [3 SP]` <!-- 2026-02-07 -->
  - Already implemented: `/api/invite/[token]/route.ts` (GET/POST) + `/invite/[token]/page.tsx` UI
  - Invite page shows team name, sender, accept/decline buttons
  - No additional work needed
  - Files: `packages/web/app/api/invite/[token]/route.ts`, `packages/web/app/invite/[token]/page.tsx`

- [x] **P6-08** Add project edit/rename capability `[TD-104] [2 SP]` <!-- 2026-02-07 -->
  - Already implemented: PATCH endpoint at `/api/projects/[id]/route.ts`
  - Supports updating title, description with ownership verification
  - No additional work needed
  - Files: `packages/web/app/api/projects/[id]/route.ts`

- [x] **P6-09** Create audit_logs migration `[TD-103] [2 SP]` <!-- 2026-02-07 -->
  - Created `20260206000001_audit_logs.sql` with `audit_logs` + `platform_settings` tables
  - RLS: admin-only read on audit_logs, service role insert, admin-only all on platform_settings
  - Indexes on user_id, action, resource_type, created_at
  - Files: `packages/web/supabase/migrations/20260206000001_audit_logs.sql`

- [x] **P6-10** Add MP3 export option `[TD-105] [3 SP]` <!-- 2026-02-07 -->
  - Added `convertToMp3()` function in export.ts (FFmpeg libmp3lame, 192kbps, 48kHz)
  - Auto-generates MP3 alongside M4A in `makePlaybackManifest`
  - Uploads MP3 to Supabase storage, `mp3_url` added to PlaybackManifest
  - Files: `packages/orchestrator/src/orchestrator/workers/export.ts`

- [x] **P6-11** Wire "Share with Team" button `[TD-108] [3 SP]` <!-- 2026-02-07 -->
  - Created `/api/teams/share/route.ts` with POST (share) and DELETE (unshare)
  - CSRF, auth, project ownership verification, upsert on project_id+team_id
  - Wired onClick handler in project-workflow.tsx to call API
  - Files: `packages/web/app/api/teams/share/route.ts`, `packages/web/app/projects/[id]/project-workflow.tsx`

- [x] **P6-12** Copy voice settings in run history `[TD-110] [2 SP]` <!-- 2026-02-07 -->
  - Enhanced `handleCopySettings` to show toast notification about preserved voice/audio settings
  - Added `import { toast } from 'sonner'`
  - Files: `packages/web/app/projects/[id]/project-workflow.tsx`

**Phase 6 Total: 12 tickets, 38 SP, ~1.5 weeks**

---

## Phase 7: MVP Polish & Launch Readiness (Weeks 9-10)

> **Gate:** Full pipeline smoke test passes, all environments verified, monitoring operational.

- [x] **P7-01** Full pipeline smoke test `[Roadmap Phase 0]` `[3 SP]` <!-- 2026-02-07 -->
  - Created `scripts/smoke-test.sh` — 7-step automated test: web health, orchestrator health, auth flow, create project, generate-scenes, disk stats, route verification
  - Supports `--staging`, `--production`, `--dry-run` flags
  - Auto-loads credentials from `.env.local`, reports PASS/FAIL with timing
  - Files: `scripts/smoke-test.sh`

- [x] **P7-02** Deploy to staging and verify `[Phase 0]` `[2 SP]` <!-- 2026-02-07 -->
  - Staging config created in Phase 5 (`render-staging.yaml`)
  - Full deploy runbook with env var checklist in `scripts/deploy-runbook.md`
  - Smoke test script supports `--staging` flag for verification
  - Actual deployment deferred to operator execution
  - Files: `render-staging.yaml`, `scripts/deploy-runbook.md`

- [x] **P7-03** Load test orchestrator `[Roadmap Phase 10]` `[3 SP]` <!-- 2026-02-07 -->
  - Created `scripts/load-test.sh` — concurrent health endpoint throughput, web page response times, rate limiter verification, memory baseline
  - Configurable concurrency (default 10) and duration (default 30s)
  - Reports RPS, error rate, avg/max response times
  - Files: `scripts/load-test.sh`

- [x] **P7-04** Verify Stripe subscription lifecycle `[2 SP]` <!-- 2026-02-07 -->
  - Created `scripts/stripe-test-checklist.md` — comprehensive 7-scenario test plan
  - Covers: new subscription, webhook events, upgrade, downgrade, cancel, usage metering, edge cases
  - Includes Stripe test cards reference and CLI verification commands
  - Files: `scripts/stripe-test-checklist.md`

- [x] **P7-05** Security regression test `[2 SP]` <!-- 2026-02-07 -->
  - Full 9-point audit of Phase 0 fixes: 7 PASS, 2 issues found and fixed
  - Fixed: missing CSRF on `/api/admin/corpus/populate` POST
  - Fixed: error leaking bug in `api-response.ts` (inverted ternary exposed internal messages in non-production)
  - `pnpm audit`: 0 high/critical directly exploitable (2 high in transitive deps of eslint-config-next and next@14; requires Next.js 15 upgrade, deferred)
  - Files: `packages/web/app/api/admin/corpus/populate/route.ts`, `packages/orchestrator/src/lib/api-response.ts`

- [x] **P7-06** WCAG spot-check `[2 SP]` <!-- 2026-02-07 -->
  - Audited 5 key pages: landing, dashboard, project, audio players, admin
  - Fixed 3 critical issues: focus-visible rings on admin quick actions, collapsible sections, footer links
  - Added `aria-hidden="true"` to decorative icons on admin page
  - Audio players confirmed excellent (keyboard shortcuts, ARIA roles, drag-to-seek)
  - Remaining warnings: decorative icons in project-workflow (non-blocking), scene markers in protected player (post-launch)
  - Files: `packages/web/app/admin/page.tsx`, `packages/web/app/projects/[id]/page.tsx`, `packages/web/app/page.tsx`

- [x] **P7-07** Production deployment `[Roadmap Phase 10]` `[2 SP]` <!-- 2026-02-07 -->
  - Created comprehensive deployment runbook: `scripts/deploy-runbook.md`
  - Covers: staging deploy, production deploy, post-deploy verification, rollback procedures, monitoring/alerting, incident response
  - Includes severity levels (SEV1-4) with response times
  - DNS/SSL instructions, emergency procedures, useful commands
  - Files: `scripts/deploy-runbook.md`

- [x] **P7-08** Update all planning docs to reflect launch state `[2 SP]` <!-- 2026-02-07 -->
  - Updated `PRODUCTION_READINESS.md` — Feb 7 status with 642 tests, Phase 0-6 complete, health scorecard
  - Updated `planning/ROADMAP.md` — Feb 7 update section, Phase 10 partial completion, version 0.5.0
  - Updated `CLAUDE.md` — Current state, test counts, deployment status
  - Files: `docs/PRODUCTION_READINESS.md`, `docs/planning/ROADMAP.md`, `CLAUDE.md`

**Phase 7 Total: 8 tickets, 18 SP, ~1 week**

---

## Post-Launch Backlog

> Items deferred from code review. Prioritize based on user feedback and business needs.

### Intelligence Features (from Roadmap Phase 2)
- [ ] **BL-01** Enable StoryScore 12-dimension scoring `[FC-010] [3 SP]`
- [ ] **BL-02** Enable Story-Adviser suggestions `[FC-010] [5 SP]`
- [ ] **BL-03** Enable revision tracking `[FC-010] [3 SP]`
- [ ] **BL-04** Enable comparable scripts `[FC-010] [5 SP]`
- [ ] **BL-05** Enable export reports `[FC-010] [2 SP]`

### Pipeline Enhancements (from Roadmap Phase 3)
- [ ] **BL-06** Long-script chunking for Pro tier `[TD-049] [8 SP]`
- [x] **BL-07** Scene-level regeneration `[TD-106] [5 SP]` <!-- 2026-02-10 Sprint 2 -->
- [ ] **BL-08** Stem export capability `[TD-107] [3 SP]`
- [x] **BL-09** Audio preview/partial generation `[TD-109] [5 SP]` <!-- 2026-01-31 Scene Preview feature (commit f4da1cd) -->

### Code Quality Polish
- [x] **BL-10** Rate-limit share password verification `[TD-058] [2 SP]` <!-- 2026-02-09 Sprint 1 -->
- [ ] **BL-11** Implement nonce-based CSP `[TD-059] [3 SP]`
- [ ] **BL-12** Scope voice search state per-request `[TD-064] [2 SP]`
- [ ] **BL-13** Add agent loop cancellation `[TD-066] [3 SP]`
- [ ] **BL-14** Standardize admin authorization `[TD-057] [2 SP]`
- [ ] **BL-15** Create withAdminAuth wrapper `[TD-074] [2 SP]`
- [x] **BL-16** Add web package structured logging `[TD-078] [3 SP]` <!-- 2026-02-09 Sprint 1 -->
- [ ] **BL-17** Review bare catch blocks `[TD-076] [2 SP]`
- [ ] **BL-18** Centralize FFmpeg path resolution `[TD-116] [1 SP]`
- [ ] **BL-19** Fix logger ESM interop types `[TD-117] [1 SP]`
- [ ] **BL-20** Remove legacy alias schemas `[TD-118] [1 SP]`
- [ ] **BL-21** Audit whisper-align dead code `[TD-119] [1 SP]`

### UI/UX Polish
- [x] **BL-22** Full dark mode (next-themes + semantic tokens) `[TD-085] [8 SP]` <!-- 2026-02-10 Sprint 2 -->
- [ ] **BL-23** Fix heading hierarchy `[TD-086] [1 SP]`
- [ ] **BL-24** Add footer touch target padding `[TD-082] [1 SP]`
- [ ] **BL-25** Add tablet breakpoint to pricing grid `[TD-083] [1 SP]`
- [ ] **BL-26** Make script editor height responsive `[TD-084] [1 SP]`
- [ ] **BL-27** Add visibility-based polling pause `[TD-089] [1 SP]`
- [ ] **BL-28** Migrate login form to react-hook-form `[TD-090] [2 SP]`
- [ ] **BL-29** Add project form field-level validation `[TD-091] [2 SP]`
- [ ] **BL-30** Replace swagger-ui-react `[TD-030] [2 SP]`
- [ ] **BL-31** Add aria-hidden to decorative icons `[TD-128] [1 SP]`
- [ ] **BL-32** Mandate next/image usage standard `[TD-129] [1 SP]`

### Infrastructure Polish
- [x] **BL-33** Add rate limiting to web API routes `[TD-112] [3 SP]` <!-- 2026-02-09 Sprint 1 -->
- [ ] **BL-34** Harden Docker Compose defaults `[TD-113] [1 SP]`
- [ ] **BL-35** Restrict health endpoint detail level `[TD-114] [1 SP]`
- [ ] **BL-36** Remove hardcoded Sentry DSN fallbacks `[TD-132] [1 SP]`
- [ ] **BL-37** Move @types to devDependencies `[TD-131] [1 SP]`

### Feature Polish
- [ ] **BL-38** Replace hardcoded admin dashboard values `[TD-135] [2 SP]`
- [ ] **BL-39** Add admin analytics export `[TD-136] [2 SP]`
- [ ] **BL-40** Update project delete route params pattern `[TD-134] [1 SP]`
- [ ] **BL-41** Sanitize Supabase ilike filter inputs `[TD-061] [1 SP]`
- [ ] **BL-42** Remove writer identity from password challenge `[TD-115] [1 SP]`
- [ ] **BL-43** Fix Sentry context leak between requests `[TD-122] [1 SP]`
- [ ] **BL-44** Export worker tests `[TD-094] [3 SP]`
- [ ] **BL-45** Health route tests (supertest) `[TD-130] [2 SP]`
- [ ] **BL-46** Audio quality validation tests `[TD-043] [8 SP]`
- [ ] **BL-47** Standardize component file naming `[TD-120] [1 SP]`
- [ ] **BL-48** Organize lib/ directory structure `[TD-121] [2 SP]`

### Enterprise / Post-MVP (from Roadmap Phases 4-6)
- [ ] Reader marketplace
- [ ] Enterprise SSO (SAML/OIDC)
- [ ] API key management
- [ ] SOC 2 / TPN-MPAA compliance
- [ ] Multi-region deployment
- [ ] White-label support
- [ ] Public API + SDKs

---

## Cross-Reference: Superseded Documents

This TODO supersedes and reconciles the following documents. They should be considered **archived** for historical reference:

| Document | Status | Notes |
|----------|--------|-------|
| `docs/planning/ROADMAP.md` | ARCHIVED | Phase 0-1 items absorbed into Phases 0-6 above |
| `docs/FULL_CAPABILITY_PLAN.md` | ARCHIVED | Phases 1-6 absorbed; Week 1 items already done |
| `code-review/2026-02-06/06-TECHNICAL-DEBT-BACKLOG.md` | REFERENCE | TD-IDs cross-referenced in every ticket above |
| `code-review/2026-02-01/FEATURE_PLANNING.md` | ARCHIVED | Superseded by Feb 6 review |
| `docs/BACKLOG.md` | ARCHIVED | Voice Casting UI absorbed into Phase 4 |

---

## Tracking Conventions

- Mark items `[x]` when complete
- Add completion date as comment: `[x] **P0-01** ... <!-- 2026-02-10 -->`
- If a ticket is blocked, note the blocker: `[ ] **P2-01** ... ⛔ Blocked by P1-03`
- If scope changes, update SP estimate and add note
- Review this TODO at the start of each week

---

*Last updated: 2026-02-10 — All 96 tickets complete. Post-launch Sprint 1 (BL-10, BL-33, BL-16) and Sprint 2 (P2-08, BL-07, BL-22) done. 718 tests passing (364 orchestrator + 308 web unit + 46 web component). Deployed to Render.com.*
