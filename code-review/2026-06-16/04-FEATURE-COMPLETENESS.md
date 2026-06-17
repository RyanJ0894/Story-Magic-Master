# Feature Completeness — 2026-06-16

## Completed in this window (2026-06-14 → 2026-06-16)

| Feature | Files / PRs | Notes |
|---------|-------------|-------|
| Worker split (DB pool rebalance) | #282 — render.yaml split web/orch/worker; DATABASE_CONNECTION_LIMIT=6 each | Structural fix for Errors 1 & 4 |
| Sub-account project isolation | #289 — `listProjects` userId scoping + atomic tier provisioning | Closes DT-32-H-1 prior carryover (partial — full close pending verification) |
| Shared ConfirmDialog + fmtInt | #290 — replaces 6 `window.confirm` sites + currency helper | Closes UX-G-01 (P1 from prior round) |
| Retention cron + llm_call_log FK + safeUpdate audit | #291 — adds cron service, FK to llm_call_log.project_id, audit wrapper | Closes DT-32-L-1 |
| Listen UI uses real whisper alignment | #293 — replaces char-count estimate | Closes #207 |
| Audio-tuning end-to-end | #299 + #301 + #309 + #310 + #308 — schema + service + GET/PATCH API + orchestrator wiring + sliders UI + discoverability link | Closes B-001 through B-005 — Ryan's three audio-quality observations |
| Cosmetic + reliability cleanup | #296 + #298 + #304 — Recently Played clamp + readiness 60s + jobId toast + favicon + install-prompt fix | Closes Errors 2/3, observation #208, install-prompt spam |
| Testing-plan doc | #311 + #312 + #313 | Coordinates Ryan retest + Peter review queue |

## Wiring gaps (Phase 4.5 audit)

| Pattern | Hits | Notes |
|---------|------|-------|
| Hardcoded `const mockX = [...]` arrays in non-test components | 0 | None found |
| `?? mockY` or `|| mockZ` fallbacks | 0 | None found |
| `max-h-[Npx]` on DB-sourced lists | 0 | None found |
| `toLocaleString()` bare on currency/number values | 0 | All currency rendering goes through `fmtInt()` / proper Intl options now (#290) |

The wiring-gap class of bug is genuinely absent in current code. The defensive helpers landed in #290 closed the last `toLocaleString()` risk; the audio-tuning surface (the largest new component this window) has no mock fallbacks.

## Still incomplete — in Peter's review queue

| PR | Feature | Closes |
|----|---------|--------|
| #295 | CSP form-action whitelist for *.clerk.com + checkout.stripe.com | #219 enterprise CSRF |
| #300 | autoReassignStageDirectionsToNarrator in director-validator | A-005 |
| #302 | Invite confirmation + reactivation + Pro default tier | A-006/007/008 |
| #307 | Partial-audio fallback + Sentry chunk breadcrumbs | A-003/004 |

## Blocked (external)

| Feature | Blocked by |
|---------|-----------|
| Stripe live walkthrough | Chris (1h scheduled) |
| Full UAT click-through | Ryan + Chris (~2h) |
| Voice ID for "female teen" preset | Ryan to pick from catalog (T-01 in tech-debt doc) |

## No new feature gaps introduced

All NEW code shipped in this window is feature-complete: schema → service → API → UI → tests landed together. No half-wired components.
