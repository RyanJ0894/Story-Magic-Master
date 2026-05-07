# Delta Review — 2026-05-06
Prior review: 2026-04-25

## Commits Since Last Review (3 commits)
| Commit | Description |
|--------|-------------|
| `33ffc75` | perf(tts): ElevenLabs optimisations — turbo model, PCM output, timeout, concurrency |
| `ba24d9a` | test(generate-scenes): fix processScript mock assertion for directorModel arg |
| `5048f55` | feat(billing): Advanced Analysis upgrade — Claude Opus 4.6 per-project add-on |

## Prior TODO Items Status

| Item | Status | Evidence |
|------|--------|----------|
| DNS: `app.storymagicapp.net` → CNAME | **OPEN (Ryan action)** | No commit; awaiting Ryan |
| Stripe account migration (Ryan) | **OPEN** | Pre-launch; no blocker yet |
| Clerk TOTP enable | **OPEN** | Ryan action |
| Enable Story Adviser FF | **OPEN** | Post-launch backlog |
| StoryScore corpus ingestion | **OPEN** | Post-launch backlog |
| ElevenLabs/Google/Anthropic grants | **OPEN** | Post-launch |
| Advanced Analysis upgrade add-on | **RESOLVED** — `5048f55` | Feature shipped |

## New Findings This Session
- [NEW] Webhook `advanced_analysis` idempotency gap — FIXED this session
- [NEW] Missing composite index on `(projectId, purchaseType, status)` — FIXED (schema + migration)
- [NEW] `stripePaymentIntentId` unique constraint missing — FIXED (schema + migration)
- [NEW] `ELEVENLABS_MODEL` + `DIRECTOR_MODEL_ADVANCED` not in `.env.example` — FIXED
- [NEW] 16 new tests for Advanced Analysis webhook + route — WRITTEN
- [NEW] UX: 4 P0 findings (upgrade copy clarity, banner persistence, share modal overload, admin collapsibility) — Documented, deferred Sprint A
- [NEW] admin-routes test suite failing (Prisma client missing) — FIXED (prisma generate)
