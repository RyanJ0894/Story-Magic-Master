# Bug-hunt: "Re-run the director step" UX gap

## What "re-run director" actually means in this codebase

There is **no separate "re-run director" endpoint**. The pipeline runs end-to-end via the web's `lib/generation/processor.ts`, which calls the orchestrator's `/generate-scenes` for parsing + voice assign + scene construction, then `/orchestrate` for TTS + mix.

**The reuse-parsing flow the user just tested:** `processor.ts:231–256` checks `project.directorJson` in Postgres. If non-null with `scenes.length > 0`, it skips `/generate-scenes` entirely and goes straight to `/orchestrate`. That's why "things got a lot further." The cache key is **just `project_id`** — one slot per project, persisted as `Project.directorJson` JSONB.

**The actual problem:** when the pre-flight voice check fails (`orchestrate.ts:188–210`), the orchestrator returns 422 and tells the user to re-run director. But the only ways to re-run director are:

1. Wipe `Project.directorJson` and hit Generate → re-parses from scratch (expensive).
2. Manually craft an API call with `voice_overrides` → no UI for it.

Voice assignment is "free-riding" on the parse cache. The cached `directorJson` already contains the (now-broken) voice IDs in every scene's dialogue lines. Re-running just `/orchestrate` reads the same broken IDs → same 422.

## Is voice-only reassignment possible?

**Yes, the building block exists.** `DirectorAgent` accepts `cachedVoiceMap` to skip Pass 2 (`director-agent.ts:60`), and there's also `VoiceAssignmentAgent.assignFromSample` (Phase B #409) that picks voices from a sample of dialogue. Neither is exposed as an endpoint. There's no `/director/reassign-voices` route — `routes/` has only `analyze, generate-scenes, health, impact, internal-manifest, orchestrate, preview, stems, stitch-segments`.

The auto-deactivation in `voice-validator.ts:204` flips `voiceCatalogEntry.isActive = false` for `revoked / server_degraded / not_found` — so the next pre-flight will at least not deactivate them again, but the **cached directorJson still references those voice IDs**. The user is stuck.

## Voice-pool replacement at orchestrate time

Each dialogue line in directorJson has a `voice_key` and a resolved `voice_id`. The catalog (`voiceCatalogEntry`) has gender/age/labels for substitution. A swap is mechanically straightforward: iterate scenes, replace any broken `voice_id` with another active catalog entry matching the original characteristics, persist the updated directorJson. The pieces exist; no one wired them together for this failure mode.

## Recommendation: hybrid A + B

**Phase 1 (Option A — auto-substitute, ship immediately).** When pre-flight finds broken voices, AND the platform-incident guard is NOT tripped (so `abortedDeactivation === false`), the orchestrator should:

1. Pick replacement voice IDs from `voiceCatalogEntry` matching the original gender/age (a lightweight in-process selector — no LLM call).
2. Rewrite the broken IDs in `directorJSON.scenes[*].dialogue[*].voice_id` in place.
3. Persist the patched directorJson back to `Project.directorJson` (via a callback the web layer already owns).
4. Continue the run.

User sees nothing. Zero re-parse cost. This handles 95% of cases.

**Phase 2 (Option B — UI escape hatch).** For the 5% where auto-sub can't find a good match (e.g. very specific labels), expose a "Re-pick voices" button on the project page that calls a new `POST /director/reassign-voices` route. That route takes the existing directorJson + an updated catalog snapshot and runs only `VoiceAssignmentAgent` — no character extraction, no scene construction. ~$0.05 vs a full re-parse.

**Avoid Option C.** "Re-run director with cache" duplicates work already covered by Option A and still ties voice selection to the (expensive) full pass when only Pass 2 needs to run.

## Adjacent finding (out of scope)

`server_degraded` auto-deactivation is at `voice-validator.ts:204`. The user is right that **a single 500 from ElevenLabs probably shouldn't deactivate a voice forever** — the platform-incident guard catches *fleet-wide* outages but not isolated transient 500s. Worth adding a probationary state ("flaky, recheck next run") instead of binary active/inactive. Separate fix from the UX gap.
