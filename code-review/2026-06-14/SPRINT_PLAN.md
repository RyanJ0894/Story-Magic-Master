# Sprint Plan — 2026-06-14

Unified plan merging code review + UX agent + data-tier agent.

## Sprint Now — Pre-launch security + GTM (~8 SP)

**Gate: ship before flipping the friendly-cohort flag.**

| ID | SP | Title | Owner | Why |
|----|----|-------|-------|----|
| DT-32-H-1 | 2 | Patch `listProjects` to honor `projectAssignments` for sub-accounts + regression test | Claude | Closes PR #177 isolation gap — only meaningful if cohort includes sub-accounts |
| DT-30-M-1 | 2 | `subscriptions.upsert` in admin/tier, referral/upgrade, admin/subscriptions/[id] | Claude | `llm_call_log` cost rollups desync without it |
| PR #282 | — | Execute worker-split runbook | Peter (queued) | Closes /api/jobs hang root cause |
| GTM-1 | — | Stripe live-mode walkthrough (Chris + real card) | Chris | Per `STRIPE-LIVE-WALKTHROUGH-2026-06-13.md` |
| GTM-2 | — | UAT batch (20 cases from 2026-06-09 baseline) | Anyone | Gate: ≤ 2 FAILs |
| GTM-4 | — | #207 Listen UI drift verification | Chris | May auto-resolve from whisper-local |

If sub-account participation in the cohort is **NOT** confirmed: DT-32-H-1 can drop to Sprint A.

## Sprint A — UX hygiene + data-tier polish (~13 SP, post-launch)

| ID | SP | Title | Source | Notes |
|----|----|-------|--------|-------|
| UX-G-01 | 2 | Extract `<ConfirmDialog>` from `team/page.tsx:507` + replace `window.confirm` at 7 sites | UX agent | Highest-impact UX item; iOS PWA silently returns `true` from confirm() |
| UX-H-01 | 1 | `fmtInt()` helper + replace 5 `toLocaleString()` sites | UX agent | Hydration risk on billing page |
| UX-H-02 | 1 | `ScriptSyncPlayer` ScrollArea + expand affordance | UX agent | 90-page screenplay clipped at 3% |
| UX-E-10 | 1 | Drop zone keyboard + click-to-open | UX agent CARRYOVER | A11y |
| UX-G-03 | 0.5 | Wizard suggestion list ScrollArea | UX agent CARRYOVER | |
| TS-CLEANUP-01 | 1 | `directorJson: any` → shared `DirectorJSON` type at 3 sites | Carryover | Bundle with project-workflow PR |
| CONTENT-LOG-RETENTION | 1 | 90-day cleanup cron in `orchestrator/src/lib/cleanup.ts` | Carryover | Cheap; index already exists |
| DT-32-L-1 | 1 | `llm_call_log.project_id` TEXT → UUID + ON DELETE SET NULL | New | Mirrors 0040 pattern |
| safeUpdate audit | 2 | Sweep `prisma.{job,project}.update` sites; apply safeUpdate where target may legitimately be deleted | New | Audit-only; per-finding fix budget |
| DT-31-M-2 | 0.5 | Verify `scene-cache.ts` upsert WHERE includes `content_hash` | Carryover | Verify-only likely |

**Bundle suggestion (per UX agent):** UX-G-01 + UX-H-01 in one PR titled "Shared `<ConfirmDialog>` + `fmtInt()` helper" — both extract-and-replace patterns, closes two carryovers together. ~3 SP.

## Sprint B — Storage + notifications + post-launch (~12 SP)

| ID | SP | Title |
|----|----|-------|
| #205 | 8+ | Storage layer refactor/redesign — architectural |
| #174 verify-merge | 1 | If PRs #199/#200/#201 not yet merged, drive through review |
| #208 | 1 | Reader % wrong — cosmetic |
| #207 | 2 | Listen UI sync — if not auto-resolved by whisper-local |
| Feature roadmap competitive features (see `FEATURE-ROADMAP-*`) | — | Next round of product planning |

## Sprint E — External / Blocked

- [ ] **External — Ryan:** 3 dup-pair voice labels + 8 ambiguous-gender voices (emails sent: Resend `a62bd1f6-…` + `6497e112-…`)
- [ ] **External — Ryan:** Female teen voice IDs (DEBT-01 — `hybrid-voice-search.ts:38`)
- [ ] **External — Ryan:** Corpus ingestion (POST-02 — needs AI keys)
- [ ] **External — Peter:** Saturday morning PR #282 execution
- [ ] **External — Stripe:** Live-mode test cards + refund window
- [ ] **External — #219:** Enterprise CSRF — only if cohort needs it

## Carryover Watch List (not yet actionable)

- [ ] **LOW** DT-27-2 — Invite-accept TOCTOU (`$transaction` + P2002 catch)
- [ ] **LOW** DT-27-4 — `ensureProfile` email backfill overwrite check
- [ ] **LOW** DT-27-5 — Migration 0027 non-partial index recreation
- [ ] **LOW** DT-29-4 — ImpactStory `viewCount` dedup (Redis SETNX)
- [ ] **LOW** DT-29-5 — Generated schema mirror drift CI check
- [ ] **LOW** DT-31-L-1 — Cross-ref PRICING table model strings vs `llm-call-log.ts`
- [ ] **LOW** DT-31-L-2 — Migration 0035 explicit `USING ... AT TIME ZONE 'UTC'` (Render TZ is already UTC; portability only)
- [ ] **LOW** DT-32-L-2 — `project_assignments (team_id, user_id)` compound index (gated on whether admin UI hits that query)
- [ ] **LOW** DT-30-L-2 — admin/users search add email field

## Sprint Sizing

| Bucket | SP | Notes |
|--------|----|----|
| Sprint Now | 4 (code) + GTM time | Security + cohort gate |
| Sprint A | ~13 | UX hygiene + data polish |
| Sprint B | ~12 | Storage + notifications + post-launch |
| External / Blocked | — | Wait state |

## Next Combined Review Anchor

This file + `TODO_2026-06-14.md` are the inputs for the next `/code-review-full` run.
