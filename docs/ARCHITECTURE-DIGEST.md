# Story Magic — Architecture Digest for Reviewers

**Audience:** outside contractors and code-reviewers (human or AI) doing a fresh pass.
**Read time:** ~5 minutes. **Goal:** save you from re-discovering decisions we already made, and from reading deprecated prototypes as current behavior.

If you have 30 seconds: read the boxed sections below labeled **MUST-KNOW**.

---

## 0. Where the code is (MUST-KNOW)

```
~/dev2/clients/RyanJae/story-magic/         ← THIS IS THE PRODUCTION REPO
├── packages/
│   ├── orchestrator/      ← TypeScript audio pipeline (Express, port 22002)
│   ├── web/               ← Next.js 14 frontend (port 22000)
│   └── shared/            ← Prisma schema + generated client
└── docker-compose.yml

~/dev2/clients/RyanJae/Archive-DONOTUSE/    ← Deprecated, do not read
├── Director/              ← Python FastAPI prototype (replaced Feb 2026)
└── Orchestrator/          ← Node.js prototype (replaced Feb 2026)
```

> **MUST-KNOW:** Anything under `Archive-DONOTUSE/` is a prototype from before the TypeScript consolidation. It does NOT match current production behavior. If a static-review tool indexed it, the findings about FFmpeg, queueing, retry logic, etc. are reading the wrong code.

---

## 1. Long-script handling (MUST-KNOW — most common static-review miss)

A 100-page script is **chunked at the web layer before the orchestrator ever sees it**:

- `packages/web/lib/generation/chunk-script.ts` line 17: `SCENES_PER_CHUNK = 14`
- A 100-scene script becomes 7 chunks of 14. Each chunk is a separate `/orchestrate` call to the orchestrator with its own scene cache, its own TTS budget, its own concurrency.

This means:
- **No single FFmpeg invocation sees more than 14 scenes.** Argv/filtergraph overflow at "~100 scenes" is impossible on the production code path.
- **Stitching uses the FFmpeg concat demuxer**, not argv. See `packages/orchestrator/src/orchestrator/shared/concat-stems.ts:32` — scene paths go into a temp filelist (`concat-<ts>.txt`) referenced by `-f concat -safe 0 -i <file>`. ARG_MAX is irrelevant.
- **Per-chunk timeout from web → orchestrator is 20 minutes**, not 30s. See `packages/web/lib/orchestrator-fetch.ts::orchestratorGenerate` (line 326-ish). The 30s default lives on `orchestratorPost`, used for non-generation endpoints — easy to misread.
- Final assembly across chunks goes through `/stitch-segments` route — same demuxer pattern.

---

## 2. Resume on failure / re-billing (MUST-KNOW)

We have a scene-level idempotency cache. **A retry never re-bills already-generated scenes.**

- DB table: `scene_renders` (Prisma migration 0036). Key: `(project_id, scene_id, content_hash)`.
- Hash inputs (`packages/orchestrator/src/lib/scene-cache.ts::computeSceneRenderHash`): dialogue text + voice_key + emotion + music/ambience/SFX cues + mix params + audio tuning.
- Hit path: `pipeline.ts::process` checks cache → returns the existing scene WAV path → skips TTS, alignment, cues, and mix for that scene.
- Disable knob: `SCENE_CACHE_DISABLED=true`.

So: chunk 5 fails mid-script, retry the job → chunks 1-4 are cached hits, ElevenLabs is NOT recharged for them, only chunk 5+ run live.

---

## 3. Job lifecycle

```
POST /api/generate (web)
  ↓
Job row written, pushed to BullMQ-style queue
  ↓
worker picks up (packages/web/lib/queue/worker.ts)
  ↓
processGenerationJob (packages/web/lib/generation/processor.ts)
  ↓ for each chunk of 14 scenes:
     orchestratorGenerate('/orchestrate', { ... })  ← 20-min timeout per call
       ↓
       orchestrator pipeline.ts::process
         ↓
         scene-cache lookup → TTS → align → cues → mix → write WAV
     each chunk writes a segment audio URL back to Job row
       ↓
     web client polls /api/jobs/<id> every 2s — sees firstAudioUrl appear,
     segmentUrls grow as more chunks complete (progressive playback)
  ↓
After last chunk: orchestrate POST /stitch-segments to concatenate the segment WAVs
  ↓
Job status → completed, final audio URL written
```

> **MUST-KNOW:** This is a background queue worker, NOT a long-held HTTP request from the browser. The queue has lock renewal every ~15 min (see `queue/worker.ts:33-34`). Long jobs are normal here, not a failure mode.

---

## 4. Progressive playback ("the user starts listening before generation finishes")

Currently surfaced via:
- `Job.firstAudioUrl` (string) — written as soon as chunk 1's WAV is ready.
- `Job.segments` (JSON) — array of `{ index, status, audioUrl }` grows as chunks complete.
- Frontend hook `onFirstAudioReady` and `onSegmentsUpdate` in `packages/web/app/projects/[id]/generate-button.tsx`.

**Open gap as of 2026-06-21:** Ryan's 6/21 list item Y says we're "utilizing only half the method" — chunks technically work, but the user-visible playback experience isn't "press play within 60s, audio streams while later chunks generate behind." This is a UX gap, not an architectural one. See the open todo for "progressive-playback shipping" in the consolidated roadmap.

---

## 5. Voice catalog

- `packages/orchestrator/knowledge_bases/eleven_labs_voices_current.json`
- Auto-syncs on boot from ElevenLabs API (PR #281). The file is a snapshot for cold-start performance; live API is source of truth.
- Pre-flight voice validator (PR #338) probes every voice in a directorJson BEFORE the chunk's TTS call. Returns 422 if any voice is unavailable; PR #343 surfaces that 422 to the user as an actionable "re-run director" message.
- Catalog audit script: `packages/orchestrator/scripts/audit-voices.ts --apply`.

---

## 6. Observability

- Every request has a correlation ID (PR #341). `requestId=sm_...` appears in every log line in the chain. One grep finds the whole job lifecycle.
- Per-job timeline in DB: `job_logs` table.
- Sentry breadcrumbs on chunk boundaries (A-004).

---

## 7. Auth + tenancy

- Clerk for user identity. Not Supabase (Supabase is storage-only).
- Multi-tenancy via:
  - `Team` → `TeamMember` → `TeamShare(projectId)` for team-scoped access
  - `ProjectAssignment(projectId, userId)` for explicit per-user grants
  - Canonical access check: `packages/web/lib/api/middleware.ts::withProjectAuth`
- Project visibility (Peter's 6/19 question, Ryan-confirmed):
  1. TeamMember + TeamShare → sub-account sees project
  2. ProjectAssignment → sub-account sees project (even without team share)
  3. Master-feed: regardless of share, master sees a notification feed of meaningful events (project created, audio generated, reactions, notes) from any sub-account. Producers in `packages/web/lib/notifications/producers.ts`.

---

## 8. Things that look like bugs but aren't

| Looks like | Actually |
|---|---|
| `orchestratorPost` has a 30s timeout | `orchestratorGenerate` (the one actually used for `/orchestrate`) has 20-min timeout |
| Single ffmpeg command across all scenes | Each chunk has its own ffmpeg invocation; final assembly is a demuxer not argv |
| No retry resume | `scene_renders` cache prevents TTS re-billing on retry |
| Generation is one blocking request | It's a BullMQ-style background job with lock renewal |
| Director/ and Orchestrator/ root dirs are current | Deprecated since Feb 2026, archived 2026-06-20 |

---

## 9. When you DO find a real issue

Open a GitHub issue with a file:line reference. We're capping launch scope at items that prevent a paying customer from generating audio for their own script. Architectural improvements that don't gate launch become post-v1 tickets.

If you're running an end-to-end test and want correlation IDs to grep, every API request returns `X-Request-Id` and every log line is JSON with `requestId` mixed in. One ID, one grep, whole chain.

---

## 10. Quick verification commands

```bash
# Confirm chunk size:
grep -n "SCENES_PER_CHUNK" packages/web/lib/generation/chunk-script.ts

# Confirm orchestrator timeout actually used:
grep -n "1_200_000\|timeoutMs" packages/web/lib/orchestrator-fetch.ts

# Confirm scene cache is wired:
grep -n "findCachedSceneRender\|recordSceneRender" packages/orchestrator/src/orchestrator/pipeline.ts

# Confirm queue-worker lock renewal:
grep -n "lockDuration\|renew" packages/web/lib/queue/worker.ts

# Confirm where mix happens (NOT in one big argv):
sed -n '30,50p' packages/orchestrator/src/orchestrator/shared/concat-stems.ts
```

If any of those return nothing or contradict what's claimed above, you're reading old code — re-check your branch with `git log --oneline -5` and `git status`.

---

*Last updated 2026-06-20 by Chris. Living doc — edit as architecture evolves.*
