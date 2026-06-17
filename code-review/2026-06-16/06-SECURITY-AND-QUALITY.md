# Security & Quality — 2026-06-16

## Headline

No NEW security findings this window. One CARRYOVER HIGH (DT-32-H-1) is partially closed by #289 but worth verifying once the in-review PRs land. One known security gap (#219 enterprise CSRF / Clerk-hosted signup) has a fix sitting in PR #295.

## Auth & access control

### [CARRYOVER — PARTIAL] DT-32-H-1: sub-account project isolation

**Source:** prior 2026-06-09 review carried into 2026-06-14.
**Closed by:** #289 — `listProjects` userId scoping + atomic tier provisioning.
**Status:** PR merged. Data-tier agent notes the leak path in `listProjects` is closed at the query level. Tests added (`projects-service-list.test.ts`, 12 cases).
**Residual concern:** other entry points (job list, billing dashboard joins) need a one-pass audit to confirm the same scoping applies. Logged as **CARRYOVER for next review** — not a re-open, just verification.

### [CARRYOVER] DT-30-M-1: tier-route subscription desync

**Status:** unchanged. Tier provisioning routes update `profiles.subscriptionTier` directly; `subscriptions` row is created lazily on first Stripe webhook. Cost rollups now join through `subscriptions` (#291 retention cron uses this) → more user-visible if desync happens.
**SP:** 3
**Disposition:** Sprint A — upsert in tier routes.

### [CARRYOVER] PLAY-TOCTOU: playback authz race

**Status:** unchanged from prior review.
**Disposition:** Sprint A.

### [CARRYOVER] CONTENT-LOG-RETENTION: content_access_log retention

**Status:** retention cron #291 covers `llm_call_log` but not `content_access_log`.
**Disposition:** Sprint A — extend cron config.

## Input validation

### [NEW — clean] Audio-tuning routes

`/api/settings/audio-tuning` GET/PATCH + `/preview`:
- Zod-validated request bodies (range checks on narrationSpeed 0.85-1.20, gain offsets -8 to +8 dB).
- User-scoped via Clerk `auth()` in every handler.
- Preview route gated by `SERVICE_SECRET_KEY` for orchestrator callback (503 if missing — verified in test).
- Rate-limit 'strict' on preview to prevent ElevenLabs cost amplification.
- No raw SQL; all DB access through Prisma.

No findings.

## Headers & web security

### [CARRYOVER] CSP form-action gap

**PR #295 in review.** Without this merge, the Clerk-hosted enterprise signup form fails CSP. Tracked as #219.
**SP:** 1
**Disposition:** Peter review → merge.

## Sensitive logging

- env.ts boot banner: prints booleans / model IDs only, no secret values. **Clean.**
- llm-call-log: stores prompt + response. The 2026-06-09 review hardened redaction; spot-check still passes (Anthropic/OpenAI message arrays go through redact helper before insert).
- Audio-tuning preview: posts user audio output URL through `SERVICE_SECRET_KEY` channel; no PII surface.

## XSS / injection

- No `dangerouslySetInnerHTML` introduced this window.
- No custom HTML escape functions (CLAUDE.md rule respected — use `xss` library only).
- No raw template interpolation into HTML.

## Dependencies

`pnpm audit` not re-run this window. Recommend rerunning before launch GTM gate.

## Sprint A security carryovers (unchanged)

| ID | SP | Title |
|----|----|-------|
| DT-30-M-1 | 3 | subscriptions upsert in tier provisioning routes |
| PLAY-TOCTOU | 2 | playback authz race fix |
| CONTENT-LOG-RETENTION | 1 | extend retention cron to content_access_log |
| VERIFY-DT-32-H-1 | 1 | audit remaining entry points for sub-account isolation pattern |

Total: 7 SP.
