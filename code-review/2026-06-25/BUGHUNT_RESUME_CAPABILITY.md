# Bug-hunt: resume audio generation after chunk failure

## What's already in place (good news)

| Layer | Mechanism | Survives a chunk failure? |
|-------|-----------|---------------------------|
| Director JSON | `projects.directorJson` JSON column. Reuse path at `processor.ts:247–256` — "no LLM re-runs". | ✅ Yes — this is the "reuse the AI parsing" Ryan turned on. |
| Scene renders | `scene_renders` table (`(project_id, scene_id) → (content_hash, scene_path)`). Upserted at `pipeline.ts:316–321` after each successful scene. | ✅ Yes — persisted in Postgres. |
| Scene WAV files | `/var/data/audio/<projectId>/scene-<sceneId>.wav`. `render.yaml` mounts a **5 GB persistent disk** for `story-magic-orchestrator`. | ✅ Yes — disk survives restarts. |
| Per-scene cache hit | `findCachedSceneRender` at `scene-cache.ts:131–170` checks hash + `fs.existsSync` before returning. | ✅ Yes — the verification is sound. |
| Chunk-level status | `jobs.segments` JSON column. Each entry has `status: pending \| processing \| complete \| failed`. Written via `safeUpdate` at processor.ts:459–466. | ✅ Yes — survives crash. |

**So on paper the system already does scene-level resume.** When the same chunk is replayed, every scene inside that chunk that previously completed hits the cache and the orchestrator skips TTS+alignment+cue+timeline+mix entirely.

## What's actually broken (the user's complaint)

Look at the web-side loop, `processor.ts:451`:

```ts
for (const chunk of chunks) { ... }
```

There is **no mechanism to start the loop at chunk N**. Every "retry generation" creates a new job and walks the entire chunk array from index 0. Specific consequences:

1. **Round-trip waste.** Chunks 0–5 still hit `/orchestrate` over HTTP even though every scene inside hits the cache. Each round-trip is ~50–200 ms of orchestrator work plus serialization. For a 50-scene script across 7 chunks, that's roughly 2 unnecessary minutes of clock time per retry.

2. **Rate-limit consumption.** The orchestrator's `/orchestrate` route is rate-limited to **3 per minute** (visible in the user's log: `x-ratelimit-limit: 3`). Replaying 7 chunks immediately consumes 7 tokens; the second retry hits 429 instantly. **This is the actual mechanism behind the 19:23 cascade Ryan saw.** It wasn't ElevenLabs; it was Story Magic's own `/orchestrate` rate limit chewing through the budget on a forced restart.

3. **Per-chunk final concat is re-run.** Each chunk's `episode-N.m4a` is rebuilt (FFmpeg concatenation) even when all scenes are cached — wasted FFmpeg cycles.

4. **No UI surface.** There is no `Resume` button anywhere. The only path is "regenerate audio," which creates a fresh job and restarts at chunk 0. `grep -rn "Resume\|resume" packages/web/components/` returns nothing relevant to generation.

5. **No completion marker.** The `jobs.segments` JSON has per-chunk status, but processor.ts on a fresh job initializes the array from scratch (`segmentStatuses[i] = { status: 'pending' }`). The historical "this chunk already completed" signal is thrown away.

## Recommendation: **Option B — `resumeFromChunk` parameter + UI button**

Slightly more code than Option A but cleaner contract, easier to test, and avoids the cross-job inference of "which prior job's state do I read." 

### Changes (3 files, no migration)

1. **`packages/web/lib/generation/processor.ts`** (~15 LOC)
   - Add `resumeFromChunk?: number` to `processProjectAudioGeneration` options.
   - When set: skip-chunk-loop iterations where `chunk.index < resumeFromChunk`. Initialize their `segmentStatuses` entry to `'complete'` (with `audioUrl` left null — the final stitch will read prior chunks' `episode-N.m4a` files from the persistent disk).
   - When the final stitch runs, look for `episode-0.m4a`…`episode-N.m4a` on disk before regenerating. The orchestrator's stitching code already keys on these filenames; verify they survive across job IDs (they should — the file path uses `projectId`, not `jobId`).

2. **New endpoint `packages/web/app/api/projects/[id]/resume-generation/route.ts`** (~40 LOC)
   - Looks up the most recent failed job for the project.
   - Finds the highest `chunk.index` where `segments[index].status === 'complete'`. Call it `lastDone`.
   - Enqueues a new job with `resumeFromChunk = lastDone + 1`.
   - Returns the new job ID.

3. **UI: `packages/web/components/...` — add a "Resume Generation" button** next to the existing "Regenerate" button. Visible only when the most recent job for the project failed and has at least one complete segment. Clicks call the new endpoint.

### Why not Option A (auto-resume on retry)
Implicit behavior is hard to debug. If a future change to chunk numbering breaks the inference, a silent corrupt retry is worse than starting over. Explicit `resumeFromChunk` is observable in logs and trivially testable.

### Why not Option C (job lifecycle PARTIAL state)
Significant model surface for a feature that the data already supports. Save for when a second use case demands it.

## Side issue worth tracking

Voices returning HTTP 500 with `server_degraded` are getting **permanently deactivated** in the catalog and the user has to re-run director to pick replacements. The user's exact ask: "we really shouldn't be disabling voices when we get 'server degraded' messages, since those are likely throttling issues." That's a separate bug — file as its own item, fix is to distinguish transient 5xx + body-detection of throttle markers from permanent deactivation. The pre-flight check at chunk 1 then becomes a no-op for transient errors and `resumeFromChunk` works as designed.
