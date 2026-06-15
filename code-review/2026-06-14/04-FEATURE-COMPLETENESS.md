# Feature Completeness — 2026-06-14

## Completed This Session (verified shipped since 2026-06-09)

| Feature | Evidence | PRs |
|---------|----------|-----|
| Pipeline tables FK + UUID conversion | Migration 0040 | (closes DT-31-H-1) |
| activity_logs (user_id, created_at DESC) index | Migration 0040 | enables #200 producers |
| llm_call_log table + cost helper | Migration 0037 | #196 |
| Sub-account project assignment (per-project read) | Migration 0039 + `withProjectAuth` | #177 |
| Team member deactivation | Migration 0038 | (pairs with #200 producers) |
| Voice catalog 137 voices on grant account | Schema `voice_catalog_entries.voiceId @unique` (line 1351); sync-on-boot at orchestrator | #281, #283, #284 |
| Whisper.cpp local alignment | `/health.alignment.primary = whisper-local` in prod | #270, #278, #279, #280 |
| SW cache auto-bump per deploy | `scripts/inject-sw-version.mjs` + sw.js placeholder + 3 unit tests | #285 |
| Stripe self-serve enterprise checkout | (per memory + PR queue history) | #171 |
| Graceful shutdown | `lib/shutdown.ts` | #259 |
| Hardening H1-H8 framework | All 8 PRs merged | #250, #253–#259 |

## Wiring Gaps (Phase 4.5)

**Zero mock fallbacks found.** Grep for `?? mock` / `|| mock` / `const mock[A-Z]` in production code returned 0 hits. Either the team practices excellent placeholder discipline, or all such patterns have been swept. Either way: no findings here.

## Scale/Format Issues (Phase 4.5)

| File:Line | Pattern | Fix | SP | Owner |
|-----------|---------|-----|----|----|
| `app/billing/page.tsx:136` | SSR `.toLocaleString()` no locale — hydration risk on tier-card scriptsPerMonth | `fmtInt()` helper | 0.2 | UX-H-01 bundle |
| `lib/validation/request-limits.ts:62` | `.toLocaleString()` in error message | `fmtInt()` | 0.2 | UX-H-01 bundle |
| `components/impact/steps/StepWrite.tsx:117` | `.toLocaleString()` in word counter | `fmtInt()` | 0.2 | UX-H-01 bundle |
| `components/impact/steps/StepAttestation.tsx:81` | `.toLocaleString()` in copy | `fmtInt()` | 0.2 | UX-H-01 bundle |
| `app/projects/new/page.tsx:223` (CARRYOVER) | `wordCount.toLocaleString()` | `fmtInt()` | 0.2 | UX-H-01 bundle |
| `components/player/ScriptSyncPlayer.tsx:406` | `max-h-[400px]` clips 90-page script silently | `<ScrollArea>` + expand affordance | 1.0 | UX-H-02 |
| `components/wizard/ScriptImprovementWizard.tsx:287` (CARRYOVER) | `max-h-[400px]` clips suggestion list at 15+ items | `<ScrollArea>` | 0.5 | UX-G-03 |
| `components/reader/upload-client.tsx:238` (CARRYOVER) | Drop zone no keyboard click-to-open | `tabIndex` + `onClick` + `onKeyDown` | 1.0 | UX-E-10 |

Bundle as a single PR: "Shared `<ConfirmDialog>` + `fmtInt()` helper" + the 3 ScrollArea/UX items = ~5.5 SP, exactly the same scope the UX agent recommended.

## Still Incomplete

| Feature | Gap | SP | Sprint |
|---------|-----|----|--------|
| Shared `<ConfirmDialog>` extracted | Inline `<Dialog>` exists at `team/page.tsx:507` but never promoted; 7 `window.confirm` sites remain | 2 | UX-G-01 |
| `safeUpdate` broadened beyond 2 sites | `safe-write.ts` framework live, only `processor.ts` (2 calls) and one other file actually use it; recommend audit pass when next backend PR lands | 2 (audit) | Backlog |
| Notification feed (#174) frontend pollers | PRs #199/#200/#201 opened — verify whether they merged | — | Verify-only |
| Listen UI sync drift (#207) | Pending verification in GTM window; may auto-resolve from whisper-local | — | GTM-4 |
| Reader % wrong (#208) | Cosmetic carryover | 1 | Backlog |
| Storage layer refactor (#205) | Architectural; post-launch | ≥8 | Phase B |
| Enterprise CSRF on signup (#219) | Conditional GTM blocker | 3 | Pre-launch IF needed |
| Queue worker split | PR #282 open, Saturday execution per runbook | — | GTM-3 |

## Blocked (External)

| Feature | Blocked By |
|---------|-----------|
| DEBT-01: female teen voice IDs | Ryan email reply |
| POST-02: corpus ingestion at `/admin/corpus` | Ryan AI keys |
| Ambiguous-gender voices (~8 in catalog) | Ryan email reply |
| Stripe live-mode walkthrough | Chris + real card (per runbook) |
