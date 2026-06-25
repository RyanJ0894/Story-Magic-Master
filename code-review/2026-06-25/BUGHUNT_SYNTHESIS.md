# Bug hunt — 2026-06-25 — synthesis

> Job: `3a9db72b` (Ryan's 50-scene script, evening of 2026-06-25)
> Source forks:
> - [BUGHUNT_VOICE_DEACTIVATION.md](BUGHUNT_VOICE_DEACTIVATION.md)
> - [BUGHUNT_INTERNAL_RATE_LIMIT.md](BUGHUNT_INTERNAL_RATE_LIMIT.md)
> - [BUGHUNT_RESUME_CAPABILITY.md](BUGHUNT_RESUME_CAPABILITY.md)
> - [BUGHUNT_DIRECTOR_RERUN_UX.md](BUGHUNT_DIRECTOR_RERUN_UX.md)
> - [BUGHUNT_V3_MIGRATION.md](BUGHUNT_V3_MIGRATION.md)

## What actually happened in Ryan's job

1. **Pre-flight voice probe** at start of `/orchestrate` hit ElevenLabs with one voice (`GKENfjE5T9SchZnnzOcf`).
2. ElevenLabs returned a transient 500.
3. The voice was **classified as `server_degraded`** at `voice-validator.ts:98–102`.
4. `voice-validator.ts:204` lists `server_degraded` in `deactivateReasons` alongside `revoked` and `not_found` → voice was **permanently flipped to `isActive=false`**.
5. The partial-protection guard at `voice-validator.ts:187–198` (skips deactivation if >50% of probed voices fail with 5xx) didn't trigger — Ryan's job probed 3 voices, only 1 failed → 33% under threshold.
6. Pre-flight check then returned the error message that surfaces in the user's log: *"these voices have been deactivated… re-running the director step will pick replacements"* — but there is no UI or API route that does that without a full re-parse.
7. Ryan retried with "reuse AI parsing." That bypassed the parse but still ran `/orchestrate` from chunk 0. The cached `directorJson` still pointed at the now-deactivated voice ID, so pre-flight failed again.
8. Once pre-flight was eventually cleared, the orchestrator processed scenes 1–37 successfully (every scene cached via `scene_renders`).
9. At scenes 38–44 the job hit chunks 6 and 7 sequentially within seconds. The orchestrator's own `strictRateLimitMiddleware` (3 req / 60 s, scoped to web's single Render egress IP) returned 429.
10. `orchestratorFetch` retried twice with hardcoded 2 s backoff — ignoring the `Retry-After: 60` header — then gave up.
11. The whole job failed. The 37 successfully-rendered scenes' audio files **DO still exist on disk** (per-scene `episode-N.m4a` on the persistent volume, keyed by projectId), but the next attempt restarts at chunk 0 because there's no `resumeFromChunk` parameter.

So three independent bugs fired in sequence; each fed into the next.

## Priority-ordered findings

| Sev | ID | Where | One-line | Fix size |
|-----|----|-------|----------|----------|
| 🔴 **BLOCKER** | V-1 | `packages/orchestrator/src/lib/voice-validator.ts:204` | `'server_degraded'` is in `deactivateReasons` — a single 5xx permanently kills a voice | **1-line revert** |
| 🔴 **BLOCKER** | R-1 | `packages/orchestrator/src/middleware/rate-limit.ts:330` (applied to `/orchestrate`, `/generate-scenes`, `/stitch-segments`, `/preview` via `index.ts:132–136`) | `strictRateLimitMiddleware` is global per-IP; `serviceAuthMiddleware` doesn't set `req.user`, so every internal call falls through to `req.ip` = web's single Render egress IP → every user shares one 3/min bucket | **2-line bypass for `x-service-key`** |
| 🟠 **HIGH** | R-2 | `packages/web/lib/orchestrator-fetch.ts:104–179` | Hardcoded 2 retries with 1 s/2 s backoff; ignores `Retry-After: 60` header | **~10-line rewrite of retry block** |
| 🟠 **HIGH** | RES-1 | `packages/web/lib/generation/processor.ts:451` | Chunk loop always starts at 0; no `resumeFromChunk` param. Per-scene audio IS persisted on disk + `scene_renders` cache; only the orchestration entry point is missing the resume contract | **~3 files, no migration** |
| 🟠 **HIGH** | DR-1 | No `/director/reassign-voices` route exists | Error message tells user to "re-run director" but the only path is a full `/generate-scenes` re-parse. Auto-substitute on pre-flight failure is feasible — `voiceCatalogEntry` has gender/age/labels and `DirectorAgent` accepts `cachedVoiceMap` | **Phase 1: auto-substitute in pre-flight (~50 LOC). Phase 2: UI button + new route (~150 LOC)** |
| 🟡 **MEDIUM** | V-2 | `packages/orchestrator/scripts/audit-voices.ts:78` | Only filters deactivated, never re-activates. Ryan currently has voices stranded in `isActive=false` from past 5xx events; needs a one-time sweep | **Add `--reactivate` flag** |
| 🟡 **MEDIUM** | V-3 | `voice-validator.ts:26` | Probe model is hardcoded `eleven_turbo_v2_5` — if production model changes, the probe validates against a different model than the one we render with | **De-hardcode (step 1 of v3 migration)** |
| 🟢 **LOW** | V-4 | Whole flow | The "Re-running the director step will pick replacements" error message is partly gaslighting — it describes a recovery that has no UI affordance | **Update the message after DR-1 lands** |
| 🟢 **OPP** | v3 | `lib/audio.ts:182` + `lib/voice-validator.ts:26` | Per Jonathan's email: drop-in `model_id` swap, cloned voices are model-agnostic. Expressive markup is half-built (`applyEmotionTag()` + `EMOTION_TAG_MAP` already gated by `ELEVENLABS_EXPRESSION_TAGS=true`). Real risk: whisper.cpp can't transcribe `[laughs]` non-speech → timing drift in `timeline.ts` | **~10 SP total (env swap + per-project opt-in + expanded tag map + alignment mitigation)** |

## The two one-line fixes that would have saved Ryan's job tonight

```diff
# packages/orchestrator/src/lib/voice-validator.ts:204
- const deactivateReasons = ['revoked', 'not_found', 'server_degraded'];
+ const deactivateReasons = ['revoked', 'not_found'];
```

```diff
# packages/orchestrator/src/middleware/rate-limit.ts:330 (top of strictRateLimitMiddleware)
+ if (req.headers['x-service-key'] === process.env.SERVICE_SECRET_KEY) return next();
```

Those two alone would have let chunks 6–7 retry cleanly AND not have left the catalog with a permanently-broken voice.

## Recommended PR sequencing

### PR A — "stop the bleeding" (ship tonight if possible)
- V-1: remove `server_degraded` from `deactivateReasons`
- R-1: bypass `strictRateLimitMiddleware` for `x-service-key`-authenticated calls (orchestrate + generate-scenes + stitch + preview + analyze)
- R-2: `orchestratorFetch` honors `Retry-After`, bumps retries to 4
- V-2: `--reactivate` sweep in `audit-voices.ts` (run once after deploy to revive Ryan's stranded voices)
- Test: invert the existing `voice-validator.test.ts:113` test to assert "does NOT deactivate on 500"
- Test: add a `serviceAuthMiddleware` bypass test for the rate limit
- ~50 LOC, ~1 hour

### PR B — auto-substitute (DR-1 Phase 1)
- Pre-flight failure → look up replacements from `voiceCatalogEntry` matching gender/age/labels of the broken voice
- Rewrite `directorJSON.scenes[*].dialogue[*].voice_id` in place, persist
- Continue without going back to director
- Updated error message: "Voices auto-replaced from catalog: A → B, C → D"
- ~3 hours

### PR C — resume (RES-1)
- Add `resumeFromChunk: number` to `/orchestrate` request body
- Chunk loop in `processor.ts:451` honors it; defaults to 0
- Web: detect failed jobs with `progress.completedChunks` populated, surface a "Resume from chunk N" button
- ~4 hours, no migration

### PR D — re-pick voices UI (DR-1 Phase 2)
- New `POST /director/reassign-voices` route — takes existing directorJson + updated catalog, runs only `VoiceAssignmentAgent` (~$0.05 vs full re-parse)
- "Re-pick voices" button on project page
- ~3 hours

### Future — v3 migration
- Separate effort, not part of stability fix
- See `BUGHUNT_V3_MIGRATION.md` for the 10-SP plan
- Worth waiting for PR A+B+C to harden first; v3 alignment risk needs its own UAT pass

## Ryan-facing summary (for the email reply)

Three independent bugs ganged up on tonight's job:

1. A single transient 500 from ElevenLabs permanently flagged one of your voices as unavailable (one-line fix).
2. Our own orchestrator's rate limit was set far too tight and applied to internal traffic — chunks 6–7 of any longer job hit it (one-line fix).
3. When a job dies mid-way, the per-scene audio survives on disk but the next attempt restarts from scene 1 (small refactor).

We have all the pieces to fix #1 and #2 in a single small PR tonight. Resume capability lands as a second PR. After those, the "re-run director" suggestion in error messages will become a real button instead of a dead end. Separately, the v3 model migration Jonathan described is genuinely a drop-in `model_id` swap on our side — about 10 story points of work to do cleanly, but no urgency this week.

The good news from your test: your "reuse AI parsing" path is working as designed. The scene-level cache (PR #191) saved 37 scenes worth of TTS cost on the failed attempt. The pieces for a resume button are mostly already shipped — it's the chunk-loop entry point that's missing.
