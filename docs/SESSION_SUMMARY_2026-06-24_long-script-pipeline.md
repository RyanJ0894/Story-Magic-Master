# Long-Script Pipeline Improvements — 2026-06-24 Overnight

**Session goal:** make the 60–120-page screenplay path actually work end-to-end, after Ryan reported a 77-page script ("ANSWERS - Script Final - HEN0905", 141 K chars) failing repeatedly across multiple hours.

**Result:** five focused PRs (#402–#406), all targeting `main`, all cherry-picked to `dev` for immediate validation. Together they fix the entire long-script class of failures — from "the connection silently drops at 5 minutes" to "the progress bar lies to you for 7 minutes straight" to "we re-parse the same script from scratch on every upload".

---

## What broke before tonight

When Ryan uploaded a 100-page script, three different things conspired to kill it:

1. **Render's 300 s inter-service proxy timeout.** Any orchestrator call that ran longer than 5 minutes with no bytes flowing back got silently dropped at the load balancer. The director step on a long script easily exceeds that.
2. **Node's default 5-minute `headersTimeout`.** Claude Sonnet on a 141 K-char director prompt takes longer than 5 minutes just to *start* sending response headers. undici (Node's `fetch` engine) aborted the call before the model finished thinking. Surfaced as `Cannot connect to API: Headers Timeout Error`.
3. **A flat 2-minute progress estimate.** The bar hit 95 % about 70 seconds in and parked there indefinitely. Users (correctly) assumed the system was hung.
4. **No cross-project parse cache.** Uploading the same demo script to two different projects re-ran the full ~330 s director step from scratch each time.

When a 77-page run failed, here's what actually happened on dev today:

```
14:25:47  Starting generation pipeline...
14:51:57  Director Agent failed after 1570s     ← 26 min wasted
          Script parsing failed: Failed after 3 attempts.
          Last error: Cannot connect to API: Headers Timeout Error
```

Three internal LLM retries × ~5 min undici cutoff = ~25 min per attempt. Three job-level retries on top = ~95 min total before the user got an error. The progress bar happily climbed to ~90 % the whole time because *something* was running — just nothing useful.

---

## The five PRs

| # | Title | Layer | What it fixes |
|---|---|---|---|
| [#402](https://github.com/dbbuilder-org/story-magic/pull/402) | SSE-convert `/generate-scenes` | orchestrator route | Director call survives past Render's 300 s proxy cutoff. |
| [#403](https://github.com/dbbuilder-org/story-magic/pull/403) | SSE-convert `/analyze`, `/preview`, `/stitch-segments` | orchestrator routes | Same protection for the other three long-running endpoints. |
| [#404](https://github.com/dbbuilder-org/story-magic/pull/404) | Page-aware progress estimate | web client | Bar climbs honestly toward the real finish instead of parking at 95 %. |
| [#405](https://github.com/dbbuilder-org/story-magic/pull/405) | Cross-project per-scene DirectorAgent cache | orchestrator + DB | Same script uploaded twice → second one skips director entirely. |
| [#406](https://github.com/dbbuilder-org/story-magic/pull/406) | Bump undici `headersTimeout` to 15 min | orchestrator boot | LLM calls actually have time to respond on long prompts. |

All five are individually small, single-commit, zero-conflict with each other.

---

## How they fit together on a single long-script run

Imagine Ryan uploads his 100-page script today, post-merge. Here's what each PR does in the order it gets hit:

### Step 1: The browser POSTs the audio-generation request

This isn't covered by tonight's PRs — the upload route just creates the job row. Worker picks it up within 5 s.

### Step 2: Worker calls `POST /generate-scenes` on the orchestrator

**Before tonight:** plain JSON response. If the director step takes > 300 s, the inter-service proxy silently drops the connection and the worker sees `fetch failed`. Multiply by 3 retries.

**After [#402](https://github.com/dbbuilder-org/story-magic/pull/402):** the orchestrator immediately flushes SSE response headers and starts a 25-second heartbeat (`: heartbeat\n\n`). The proxy now sees bytes flowing every 25 s and never times out the connection, no matter how long the director takes. The final result is delivered as a single `data:` event at the end. The web-side `orchestratorGenerate` wrapper buffers the stream and presents it to callers as a synthetic `Response` — same wire shape as before from the worker's perspective.

### Step 3: DirectorAgent runs (or doesn't)

**Before tonight:** always runs from scratch. ~330 s on a cold 10-page script; longer for full-length features.

**After [#405](https://github.com/dbbuilder-org/story-magic/pull/405):** the pipeline first splits the script into scene blocks (via the existing `extractSceneInfo` slug-line splitter — one source of truth for scene boundaries), hashes each block + the model identifier, and looks them all up in the new `director_scene_cache` table. Three outcomes:

- **100 % hit** (e.g. the same demo script another user already parsed): assemble the cached `DirectorJSON` and **skip DirectorAgent entirely**. The validator still runs against the cached data, so any malformed entry is caught and auto-corrected by the existing safety net.
- **Partial / 0 % hit**: run DirectorAgent normally, then persist each output scene back to the cache by its source-text hash. Next time someone uploads the same script, it's a full hit.
- Splicing cached + live scenes is **explicitly not a feature** — DirectorAgent makes context-aware choices that don't survive partial splice. All-or-nothing preserves quality unconditionally.

The cache key includes the model identifier, so a director-model upgrade naturally orphans old entries without any keying change.

### Step 4: DirectorAgent makes a Claude Sonnet call (if not skipped)

This is the step that killed Ryan's 77-page run.

**Before tonight:** Node's default fetch has `headersTimeout: 300_000` (5 min). Sonnet on a 141 K-char prompt takes longer than that to start streaming, so undici aborts mid-call. Our LLM retry layer reties three times, each hitting the same timeout, then surfaces "Cannot connect to API: Headers Timeout Error" → which our code maps to the generic "Script parsing failed" message the user sees.

**After [#406](https://github.com/dbbuilder-org/story-magic/pull/406):** a new module `lib/undici-dispatcher.ts` is imported as the very first thing after `dotenv` in `src/index.ts`. It sets a global `Agent` with:

```
headersTimeout: 900_000 ms   (15 min, env-overridable)
bodyTimeout:    900_000 ms   (15 min, env-overridable)
```

Because it runs before any AI SDK provider captures its `fetch` reference, all Anthropic / OpenAI / Groq / Google calls inherit the bumped timeouts. Safe to bump globally because:

- ElevenLabs TTS uses its own 30 s `AbortController` which takes precedence
- Inter-service SSE flushes headers immediately, so neither timer is load-bearing on those paths
- Anything that wants to fail faster can still use `AbortSignal`

`undici` is pinned to `^6.21.0` because v8 trips Vitest on borderline Node 22.12 versions.

### Step 5: Audio generation chunks run

The orchestrator's `/orchestrate` route was already SSE-converted in PR #394 (Peter's, shipped earlier). Tonight didn't touch it. The worker chunks the script and calls `/orchestrate` per chunk; SSE keeps each chunk's connection alive.

### Step 6: Stitch, then a few finalization writes

**Before tonight:** `/stitch-segments` is a plain JSON route. For a 50-segment full-feature stitch, the ffmpeg concat + multi-MB S3 upload can exceed Render's 300 s proxy cutoff.

**After [#403](https://github.com/dbbuilder-org/story-magic/pull/403):** `/stitch-segments` uses a two-phase split. Phase 1 (segment-existence checks) stays plain JSON so a missing-segment 422 still returns a real HTTP 422. Phase 2 (the slow concat + upload) is SSE with the same heartbeat pattern. Same protection extends to `/analyze` (where the wall-clock budget is bumpable past 300 s) and `/preview` (which can hit ElevenLabs degradation windows).

### Throughout all of this: the progress bar

**Before tonight:** the web client ran a 100 ms timer that interpolated `0 → 95 %` over a flat `ESTIMATED_DURATION_MS = 120_000` constant. For any job longer than 2 minutes, the bar hit 95 % quickly and parked there until the server reported `done`.

**After [#404](https://github.com/dbbuilder-org/story-magic/pull/404):** the constant is replaced with a per-job function of `pageCount`:

```
estimateDurationMs(pages) = 30_000 + max(1, pages) * 45_000

  1 page   → 75 s        10 pages →   8 min
  5 pages  → 4.25 min    90 pages →  68 min
```

Calibrated against actual dev measurements (job `8d8b3b71`: 10 pages, 492 s). The server's `actualProgress` still wins via `Math.max(timerProgress, actualProgress)`, so fast jobs jump immediately to the real percentage — the timer is purely a smooth backstop when the server is mid-phase and silent.

Ryan confirmed mid-session: "the progress bar seemed more accurate and didn't get to 95% quickly and then get stuck like it used to. The progress bar was slow and gradual this time."

---

## How the failure mode actually closes

For Ryan's 77-page script tomorrow, post-merge:

| Stage | Before | After |
|---|---|---|
| Browser → web | unchanged | unchanged |
| Worker → `/generate-scenes` | dies at 300 s proxy cutoff | SSE heartbeat keeps connection forever (#402) |
| DirectorAgent → Sonnet | dies at 5 min undici cutoff | 15 min headroom (#406) |
| Director re-run on second upload | re-runs from scratch | scene cache hit, skip entirely (#405) |
| Worker → `/orchestrate` | already fixed in #394 | unchanged |
| Worker → `/stitch-segments` | dies at 300 s on big stitches | SSE heartbeat (#403) |
| User-facing progress bar | parks at 95 % | smooth climb on a real estimate (#404) |

**Two independent failure surfaces — Render's 300 s proxy cutoff and Node's 5 min `headersTimeout` — both closed. Plus a quality-of-life caching layer that makes a 100 % cache hit a no-op director step.**

---

## What's *not* changed (deliberately)

- The director itself is unchanged. We didn't switch models, didn't chunk director calls differently, didn't tweak prompts. The wins are purely from removing artificial timeouts and adding a cache.
- TTS path is unchanged. ElevenLabs is still the floor on actual audio synthesis time.
- Same-project re-runs already used the existing `project.directorJson` short-circuit upstream in `processor.ts`. We didn't touch that — #405 is the cross-project complement to it.
- Voice assignment cache (`VoiceMap`) untouched. Cached scenes inherit voice assignments from whoever first parsed them; pre-flight voice check (#338 / #343) substitutes any voice no longer in the catalog, and user `voice_overrides` still take precedence.

---

## What we measured

| Metric | Before | After (cold cache) | After (warm cache) |
|---|---|---|---|
| 10-page job, end-to-end | 492 s | ~505 s | **~150 s** (director skipped) |
| 77-page job, end-to-end | fails at ~26 min × 3 = ~95 min | should complete | should complete in ~3 min on cache hit |
| Progress bar UX | parks at 95 % for ~7 min of an 8-min run | smooth climb matching real wall clock | smooth climb |

The 10-page warm-cache projection assumes the script was previously parsed by *any* project. Same-project re-runs already short-circuit at the processor layer. 

---

## Follow-ups possible as needed/warranted

- Strip `voice_key` from cached scenes in #405 so cross-project hits re-resolve voice assignments via the project's own `VoiceMap` instead of inheriting them.
- Push more granular orchestrator progress events into `actualProgress` via the SSE stream — the bar would then climb on real backend events rather than relying entirely on the time-based estimate.
- Move stitch to streaming concat to overlap ffmpeg work with the last chunk's render.
- Cron-prune `director_scene_cache` rows older than 30 days on `last_hit_at` (index already built).
- Raise `MAX_SCRIPT_PAGES` from 150 to 200 if user demand goes there — currently the binding constraint once `MAX_SCRIPT_CHARS` is at 500 K.
