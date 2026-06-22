# Security & Quality — 2026-06-22

## Multi-tenancy posture

The canonical access check lives at `packages/web/lib/api/middleware.ts::withProjectAuth` with three valid access paths:
1. Project owner (`project.userId === userId`)
2. TeamMember + TeamShare on the project + ProjectAssignment
3. ScriptShare recipient

**Verified by data-tier audit:** all routes that read/write project data now go through `withProjectAuth` or mirror the same 3-path check inline. PR #345 closed the comments-route divergence that had been the lone gap.

## Producer-side security

`emitProjectCreated` and `emitScriptUploaded` (new 2026-06-21) use `resolveMastersForActor` which:
- Skips silently if actor isn't a TeamMember (no leak to non-team-members)
- Skips when actor IS the team owner (self-action filter)
- Iterates all of actor's active teams (multi-team actors get correctly fanned out, no leak to inactive memberships)

## Secrets handling

- Doppler is the source of truth for all secrets (95 in `story-magic/dev`, matching prod for external APIs)
- `render-dev.yaml` declares env *shape* only with `sync: false`; values flow via Doppler integration (`bedc5b00-…`)
- DOPPLER_TOKEN now scoped `dp.st.dev.*` — can ONLY pull dev secrets, never prod
- Doppler service tokens have `redeploy_service: true` so secret rotation auto-redeploys
- Prod Stripe + Clerk keys explicitly NOT copied to dev (would risk real charges / cross-env auth)

## Rate-limit posture

- `/api/jobs/[id]/position` raised to `'loose'` tier (60/min) — PR #354. Client-side 429 backoff added.
- Other authenticated routes stay on `'normal'` tier (20/min)
- `'strict'` (5/min) reserved for sensitive writes
- Render Key Value `story-magic-redis-dev` backs the rate limiter on dev (same TCP-RESP posture as prod's `story-magic-redis`)

## Observability

- Per-request correlation IDs (PR #341) — every TTS chain log line carries `requestId=sm_…`
- ElevenLabs request-id captured in structured logs for support ticket cross-reference
- Sentry breadcrumbs per chunk + partial-audio captureMessage (A-003/A-004)
- Service-key + Clerk auth + ElevenLabs xi-api-key all redacted in pino redact config (PR #340)

## Input validation

- Every `withAuth` route uses Zod schemas (`parseBody`)
- `DirectorJSONSchema` validates on the orchestrator `/orchestrate` entry boundary
- Pre-flight voice validator (PR #338) probes every voice ID against ElevenLabs before TTS spend

## CSP / browser security

- PR #295 (merged) tightened CSP form-action whitelist
- No `dangerouslySetInnerHTML` introduced this weekend
- The `xss` library used for any HTML sanitization (per project rule)

## Carryover security items

**None.** No outstanding security findings.

## Outstanding posture risks (non-engineering)

1. Stripe live walkthrough — Chris ~1h (CHRIS-OWNED)
2. UAT click-through — Chris ~2h (CHRIS-OWNED)
3. Doppler dev secret rotation cadence — not yet automated. Acceptable for current scale.
