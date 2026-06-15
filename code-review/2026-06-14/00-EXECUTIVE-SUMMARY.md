# Executive Summary — 2026-06-14

## Health Scorecard

| Area | Score | Δ | Notes |
|------|-------|---|-------|
| TypeScript | 10/10 | = | 0 errors both packages |
| Security | 7/10 | -1 | New HIGH (DT-32-H-1) — sub-account list info leak |
| Test Coverage | 9/10 | +1 | 2,224 tests (+238) all green |
| UX/Info Design | 6/10 | -1 | All 4 prior UX items unchanged; +2 new (UX-H-01, UX-H-02); +1 confirm site |
| Data Integrity | 9/10 | +2 | DT-31-H-1 RESOLVED + LLM cost-log + project_assignments live |
| Code Quality | 8/10 | = | 14 `any` casts in app code; 1 real TODO (blocked on Ryan) |
| Observability | 9/10 | +1 | H1 + manifest endpoint shipped |
| Deployment | 9/10 | = | SW auto-bump, buildFilter, Doppler→Render sync stable |
| **Overall** | **8/10** | **-** | **Strong infrastructure footing; one real security miss + UX hygiene slipping** |

## Headline Findings

### NEW HIGH — DT-32-H-1: sub-account project list info leak

`packages/web/lib/services/projects.ts:44` returns every team-shared project (incl. `scriptText`) to sub-accounts who lack a `ProjectAssignment` row. PR #177 patched per-project reads (`withProjectAuth`) but missed the dashboard list query. **Contradicts the stated isolation guarantee.** ~15 LoC fix + regression test. P0 if friendly cohort includes sub-account testers; P1 otherwise.

### NEW UX-H-01 — `toLocaleString()` × 5 sites (1 SSR hydration risk)

Billing page renders `tierConfig.scriptsPerMonth.toLocaleString()` in SSR without locale — potential hydration warning. Bundle into a single `fmtInt()` helper rollout.

### CARRYOVER — UX-G-01 actually got worse

7 `window.confirm` sites now (was 6); `app/dashboard/dashboard-tabs.tsx:61` is new. iOS standalone PWA silently returns `true` from `window.confirm()` → every site is a silent destructive action on the most marketing-relevant install path. Extract `<ConfirmDialog>` from `team/page.tsx:507` and sweep.

## Delta Since 2026-06-09

### Resolved
- [x] **DT-31-H-1** — pipeline FK + UUID conversion (migration 0040, deleted 6 actual prod orphans)
- [x] **DT-32-M-1** — activity_logs index (same migration)
- [x] **PLAY-TOCTOU** — atomic UPDATE shipped (verified `play/route.ts:58-65`)
- [x] **PR #196 verification** — llm_call_log table + 3 indexes live
- [x] 41 PRs / 143 commits including H1-H8 hardening, apex 525 resolution, voice catalog restoration (137 voices), whisper-local in prod, SW auto-bump

### New This Session
- 1 HIGH security finding (DT-32-H-1)
- 2 P1 UX findings (UX-H-01 hydration risk, UX-H-02 ScriptSyncPlayer clip)
- 2 LOW data findings (DT-32-L-1 llm_call_log FK, DT-32-L-2 compound index)

### Still Open (Carryover, ranked)
- [ ] UX-G-01 — window.confirm × 7 sites (grew from 6) — P1
- [ ] UX-H-01 — toLocaleString × 5 sites (grew from 4) — P1
- [ ] DT-30-M-1 — subscriptions.upsert in 3 routes — HIGH (re-graded; reporting now affected)
- [ ] CONTENT-LOG-RETENTION — 90-day cron — MED
- [ ] UX-E-10, UX-G-03 — A11y + scroll polish — P2
- [ ] TS-CLEANUP-01 — directorJson:any × 3 — P2
- [ ] DEBT-01, POST-02 — blocked on Ryan

## Priority Actions

### Sprint Now (~4 SP code + GTM time)

| Priority | Item | SP | Owner |
|----------|------|----|-------|
| P0 | DT-32-H-1 — Patch `listProjects` for sub-account isolation + test | 2 | Claude |
| P1 | DT-30-M-1 — `subscriptions.upsert` × 3 routes | 2 | Claude |
| P0 (ext) | PR #282 worker split — Saturday | — | Peter |
| P0 (ext) | Stripe live walkthrough | — | Chris |
| P0 (ext) | UAT batch + #207 verification | — | Chris |

### Sprint A — Post-launch (~11 SP)

UX bundle (UX-G-01 + UX-H-01 + UX-H-02 + UX-E-10 + UX-G-03) ~5.5 SP, then CONTENT-LOG-RETENTION + DT-32-L-1 + safeUpdate audit + TS-CLEANUP-01 ~5.5 SP.

## Recommendation

1. **Ship DT-32-H-1 before flipping the cohort flag if any cohort tester is a sub-account.** This is the only finding that meets that bar. Everything else can wait.
2. **Bundle the UX sprint as one PR** — the UX agent's recommendation is sound: `<ConfirmDialog>` + `fmtInt()` together. Closes 2 carryover items + 1 NEW with shared scaffolding.
3. **Schedule a `safeUpdate` audit** when the next backend refactor PR lands — framework is correct, adoption isn't.
4. **The UX hygiene slip is a leading indicator.** Three review cycles in a row, the UX items have carried over. Velocity went to hardening (correct call), but a 2 SP bundle in any upcoming sprint would close 4 items at once.

Overall: a strong infrastructure quarter with one real security miss and one UX-quality drift. Both fixable in <8 SP.
