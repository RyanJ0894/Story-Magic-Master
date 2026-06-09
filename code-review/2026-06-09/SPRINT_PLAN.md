# Sprint Plan — 2026-06-09 → 2026-06-23

Unified plan merging UX + data-tier + code-review findings + cost-opt arc residuals.

## Sprint A — Data + UX Hardening (after PRs #192–#198 land)

Total ~12.5 SP. Ideally a single 2–3 day sprint after the Peter review queue clears.

### Critical Path

| Order | ID | Title | SP | Source |
|-------|----|----|----|----|
| 1 | DT-31-H-1 | Pipeline tables FK + UUID type fix (migration 0038) | 3 | Data-tier |
| 2 | UX-G-01 | Shared `<ConfirmDialog>` + 6-site `window.confirm` refactor | 2 | UX |
| 3 | PLAY-TOCTOU | Atomic `$executeRaw` play-count guard | 2 | Carryover |
| 4 | CONTENT-LOG-RETENTION | Nightly `content_access_log` cleanup cron | 2 | Carryover |
| 5 | DT-30-M-1 | `subscriptions.upsert` in admin/tier, upgrade, referral/upgrade | 2 | Carryover |
| 6 | TS-CLEANUP-01 | 3 `directorJson: any` + 1 `existingScore: any` → shared types | 1 | TS report |
| 7 | UX-G-02 | `toLocaleString('en-US', { maximumFractionDigits: 0 })` (4 sites) | 0.5 | UX |
| 8 | UX-E-10 | Drop zone `tabIndex={0}` + onClick to file picker | 1 | UX carryover |

### Optional / Polish

| ID | Title | SP |
|----|-------|----|
| UX-G-03 | `ScriptImprovementWizard` → `<ScrollArea>` for visible scroll indicator | 1 |
| DT-30-L-2 | admin/users search add email field | 0.5 |
| DT-31-L-2 | Migration 0035 explicit `USING ... AT TIME ZONE 'UTC'` | 0.5 |

### Recommended PR breakdown

| PR | Items | SP |
|----|-------|----|
| PR S-1 | DT-31-H-1 (pipeline FK migration alone — high risk; ship in isolation) | 3 |
| PR S-2 | UX-G-01 + UX-G-02 + UX-G-03 (UI polish batch) | 3.5 |
| PR S-3 | PLAY-TOCTOU + CONTENT-LOG-RETENTION + DT-30-M-1 (server-side hardening) | 6 |
| PR S-4 | TS-CLEANUP-01 + DT-30-L-2 + UX-E-10 + DT-31-L-2 (mop-up) | 3 |

## Sprint B — After Ryan responds to #174 scoping email

| ID | Title | SP |
|----|-------|----|
| #174-1 | Backend: `/api/master/notifications` paginated feed query | 3 |
| #174-2 | Producer wiring: emit `Alert` rows from job completion + team events + Stripe webhooks | 3 |
| #174-3 | Frontend: `<NotificationFeed />` + bell icon + 30s polling | 3 |

Total ~9 SP. Awaiting scope clarification from Ryan email sent 2026-06-09 (Resend id `e6971723-1d2c-4f34-8cf6-f44cb2c5f20a`).

## Sprint E — External / Blocked

| ID | Title | Blocker |
|----|-------|---------|
| DEBT-01 | Female-teen voice IDs | Ryan |
| POST-02 | Corpus ingestion via `/admin/corpus` | Ryan |
| #174 scope | Notification feed event types + UI | Ryan email response |
| PR #176 | Silent track warnings (heavy conflicts) | Author hand-merge |

## Pre-conditions to start Sprint A

- [ ] Peter approves + merges PRs #192–#198 (cost-opt arc tail)
- [ ] Peter approves + merges PRs #169/#170/#171/#173/#177 (carryover queue)
- [ ] #176 either closed or hand-merged
- [ ] Render env has `OPENROUTER_API_KEY` set in Doppler (relief valve activates only on PR #194 merge)

## Effort summary

| Sprint | Total SP | Calendar |
|--------|---------|----------|
| Sprint A (data + UX) | 12.5 | 2–3 days |
| Sprint B (#174 feed) | 9 | 1 week |
| Sprint E (external) | – | – |
