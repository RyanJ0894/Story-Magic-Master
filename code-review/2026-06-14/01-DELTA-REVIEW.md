# Delta Review — 2026-06-14 (vs 2026-06-09)

143 commits / 41 PRs since the prior review. Hardening sprint H1-H8, apex 525 incident, voice catalog restoration, whisper.cpp install chain, SW cache automation, Sentry runtime cleanup.

## Carryover Status

| Prior ID | Status | Evidence |
|----------|--------|----------|
| DT-31-H-1 (pipeline FK + UUID) | ✅ RESOLVED | Migration 0040 (`pipeline_table_fks_and_activity_index`) — converted 6 affected tables to UUID + FK with CASCADE. Found & deleted 6 actual orphan rows in prod.timelines as part of step 1. |
| PLAY-TOCTOU (atomic guard) | ✅ RESOLVED | `app/api/shares/access/[code]/play/route.ts:58-65` now uses atomic `UPDATE … WHERE play_count < max_plays` with 0-rows check. |
| UX-G-01 (`window.confirm` × 6) | ❌ CARRYOVER — WORSE | UX agent found 7 sites now (added `dashboard-tabs.tsx:61`). No shared `ConfirmDialog` was extracted despite team-page inline pattern existing. |
| UX-G-02 (`toLocaleString` × 4) | ❌ CARRYOVER — EXPANDED to 5 sites | New UX-H-01 supersedes; bundles billing/request-limits/impact wizard. |
| UX-E-10 (drop zone keyboard) | ❌ CARRYOVER | `upload-client.tsx:238` unchanged. |
| UX-G-03 (wizard scroll) | ❌ CARRYOVER | `ScriptImprovementWizard.tsx:287` unchanged. |
| CONTENT-LOG-RETENTION | ❌ CARRYOVER | No cleanup logic found in `orchestrator/src/lib/cleanup.ts` or `packages/cron/src`. |
| DT-30-M-1 (subscription upsert) | ❌ CARRYOVER | 3 sites still using ternary `update or create` pattern: `admin/tier/route.ts:57,66`, `referral/upgrade/route.ts:75,84`, `admin/subscriptions/[id]/route.ts:79,158`. |
| TS-CLEANUP-01 (`directorJson: any`) | ⚠️ PARTIAL | `processor.ts` still has 2 `any` casts (lines 163, 167). `project-workflow.tsx` + `improvement-wizard-button.tsx` still 1 each. Unchanged count. |
| DT-30-L-2 (admin/users search email) | ❓ NOT VERIFIED | Skipped — low priority. |
| DT-31-L-2 (migration 0035 USING UTC) | N/A — historical, won't change | Won't fix. |
| DEBT-01 (female teen voice IDs) | ❌ BLOCKED — Ryan | `hybrid-voice-search.ts:38` still has TODO PLACEHOLDER. Awaiting Ryan email reply. |
| POST-02 (corpus ingestion) | ❌ BLOCKED — Ryan | Same as prior round. |
| #174-1/2/3 (notification feed) | ⚠️ IN FLIGHT | PRs #199 (backend), #200 (producers), #201 (frontend) opened — `MEMORY.md` says scope locked + tests written. Verify via PR queue (currently 1 open PR per `gh pr list`; the 3 may have merged). |

## New This Session (NEW findings)

Captured in per-doc reports:
- 02-TYPESCRIPT-ERRORS: 0 errors both packages
- 03-TECH-DEBT: ~14 real `any` casts in app code; 20 console.log mostly intentional
- 04-FEATURE-COMPLETENESS: 0 wiring gaps (`?? mock` pattern absent); safeUpdate framework underused (only 2 sites)
- 07-UX-INFO-DESIGN: UX-H-01 (`fmtInt` helper, 5 sites), UX-H-02 (ScriptSyncPlayer max-h clip)
- 08-DATA-TIERS: see report

## Sprints Shipped Since 2026-06-09

| Sprint | Shipped | Highlights |
|--------|---------|-----------|
| Hardening H1-H8 | All 8 ✅ | Handler timing, boot seeds, env SoT lint, safeUpdate framework, dep audit, fixture corpus, graceful shutdown, manifest endpoint |
| Apex 525 incident | ✅ | DNS apex repointed CF→Render; chain cert reissued; buildFilter docs-only skip |
| Voice catalog restoration | ✅ | Doppler key rotated to grant account; catalog rebuilt at 137 voices; sync-on-boot live; gender inference; DB-level voice_id unique constraint verified in schema.prisma:1351 |
| Whisper.cpp install chain | ✅ | Static link, R2 mirror, ephemeral path, JSON error logs; prod `/health.alignment.primary = whisper-local` |
| Sentry runtime cleanup | ✅ | TimeAgo hydration (#272/#274), /api/jobs hang defensive timeout (#273), INVALID_KEY false-positive narrowing (#269), Listen flow dead-end (#271/#275) |
| SW cache automation | ✅ | `inject-sw-version.mjs` build-time SHA injection; closes the stale-SW class Chris hit Friday |
| Notification feed (#174) | ✅ PRs opened | 3 PRs per MEMORY; backend + producers + frontend |

Net: the 8 critical hardening items shipped, but **UX hygiene work slipped** — none of the UX carryovers progressed. CONTENT-LOG-RETENTION and DT-30-M-1 also unchanged.
