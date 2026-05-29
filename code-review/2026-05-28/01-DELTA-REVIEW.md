# Delta Review — 2026-05-28

Prior review: `code-review/2026-05-27/`

## Prior TODO Items — Status

| ID | Item | Status | Evidence |
|----|------|--------|---------|
| DATA-01 | `addMember` reactivate removed row instead of 500 | ✅ RESOLVED | commit `616fbb6` — fix(teams): reactivate removed member on re-invite |
| DATA-02 | Index `profiles.email` (Prisma + migration) | ✅ RESOLVED | commit `536d58b` — PR #67, migration 0028 |
| TEST-02 | Export + test failover chain / OpenRouter tier | ✅ RESOLVED | commit `297c17e` — fix(llm): parse multi-segment model ids; PR #66 |
| UX-P2-01 | Invite sign-up CTA for signed-out users | ✅ RESOLVED | `invite/[token]/page.tsx:198` — sign-up link with `redirect_url` |
| DATA-03 | Transaction around invite-accept new-member branch | ✅ RESOLVED | `app/api/invite/[token]/route.ts:196` — `prisma.$transaction` |
| DEBT-02 | Remove `[Audio]`/`[Invite]` diagnostic console.logs | ✅ RESOLVED | This session — 5 console.logs removed from generate-button.tsx + invite/page.tsx |
| UX-D-01 | Gate "Generation Log" panel behind NODE_ENV | ✅ RESOLVED (prior session) | Done in 2026-05-27 review |
| TEST-01 | Add `ensure-profile.test.ts` | ✅ RESOLVED (prior session) | Done in 2026-05-27 review |
| UX-P2-02 | Scroll container on team member lists | ⚠️ CARRYOVER | No `overflow-y-auto` / `max-h` on member list in `enterprise/team/page.tsx` |
| CARRYOVER-2 | Remove dead `writerCode` prop (`share-modal.tsx:48`) | ✅ SUPERSEDED | `writerCode` is a live DB field used across reader/writer dashboards and admin — not dead |
| DEBT-01 | Female-teen voice IDs for `hybrid-voice-search.ts` | ⚠️ CARRYOVER | External — awaiting Ryan's voice IDs |
| POST-02 | Corpus ingestion at `/admin/corpus` | ⚠️ CARRYOVER | External — awaiting Ryan's AI key enrollment |

## New This Session

### Code Changes (merged to main since 2026-05-27)
- `fix(sentry)` — DSN-gated Sentry enable (PR #60)
- `review(2026-05-27)` — delta fixes: teams reactivate, Sentry, LLM failover (PR #61)
- `fix(teams)` — reactivate removed member on re-invite (PR #64)
- `docs` — requirements/roadmap/UAT v3.2.0 (PR #65)
- `fix(llm)` — OpenRouter multi-segment model id parsing (PR #66)
- `perf(db)` — profiles.email index (PR #67)
- `fix(tts)` — ElevenLabs output_format query param; audio.test.ts (+17 tests) (PR #69)
- `feat(cleanup)` — stems TTL 2-day expiration; cleanup.ts (PR #69)
- `fix(orchestrator)` — static audio + missing DB tables + auth warning (PR #70)

### Fixes Applied This Session
- 5 diagnostic console.logs removed (generate-button.tsx + invite/page.tsx) — DEBT-02 RESOLVED
- `toLocaleString()` → `toLocaleString('en-US', { maximumFractionDigits: 0 })` on 2 MRR displays (admin pages)
- `json-repair.test.ts` — 21 tests for LLM JSON parsing/repair logic
- `cleanup.test.ts` — 7 tests for cleanup TTL and disk usage functions

## Test Delta
| | Count | Delta |
|--|-------|-------|
| Orchestrator | 597 | +39 (audio:+17, json-repair:+21, cleanup:+7, llm-failover:+87 from PR #66 base — already counted, net new this session: +28) |
| Web | 1,128 | +0 (stable) |
| **Total** | **1,725** | **+28** |
