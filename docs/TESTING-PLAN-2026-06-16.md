# Testing Plan — 2026-06-16

**Audience:** Ryan (primary tester), Peter (PR review)
**Author:** Chris Therriault
**Status:** Active — covers everything shipped or queued since 2026-06-15 morning.

---

## TL;DR for Ryan

Three things changed since your last testing batch:

1. **Audio-tuning sliders are live in production now.** Go to **Settings → Audio Tuning** (or hit `/settings/audio` directly). Move the four sliders, click "Generate test sample" to hear the result on a 30-second slice of your most recent project, then "Lock these settings" to apply them to every future generation. Full walkthrough in §3 below.
2. **The 4 audio-generation errors you saw on 2026-06-15 are probably gone, but I'd like you to re-test to confirm.** Three were architectural problems that the worker split shipped this morning closes structurally; the fourth had its diagnostic improved. Details in §1.
3. **All the quality + invite-flow regressions you reported are sitting in PR review.** Once Peter approves them, I'll merge and ping you to re-test that batch separately. List in §4.

---

## 1. Re-test the 4 audio-generation errors

Of the four failure signatures you captured on 2026-06-15, three should be structurally fixed by changes that landed today. Please **try to reproduce each one in production** and report back.

| Error | Probable cause | What's changed | Test approach |
|---|---|---|---|
| **Error 1** `fetch failed` (5–6 min in) | Connection-pool starvation — the embedded worker was sharing 8 connections with HTTP handlers. Long-running generation jobs would starve the polling endpoint. | **Worker split shipped this morning.** Dedicated `story-magic-worker` service with its own DB pool. Web + orch + worker each capped at 6 connections (18/22 cap). | Upload a 3–5 page script and click Generate. The fetch-failed signature should no longer recur. If it does, the new failure-toast (sitting in PR #298) will include a jobId you can paste into a ticket. |
| **Error 2** `Script parsing failed. Please try again or contact support.` | Director-agent failure — either a zod schema rejection on the LLM response, or an Anthropic rate-limit. | Diagnostic only — the underlying validation is unchanged this round. PR #298 (in review) makes the failure toast carry a jobId so we can trace the next occurrence in Sentry. | If you hit this again, copy the Job ID from the toast (once PR #298 lands) and paste it into a Slack/email reply. We'll trace the exact failure cause. |
| **Error 3** `orchestrator did not become ready within 30000ms (probed 8x)` | Render orchestrator was mid-deploy when you clicked Generate. The 30-second probe window doesn't cover Render's full cold-boot (45–55s with whisper-model setup). | **PR #298 (in review)** bumps the readiness probe from 30s → 60s. Once merged, this exact signature stops appearing on deploy-window clicks. | After PR #298 merges, try generating right after a fresh deploy (any commit will trigger one). The 30s error should be gone. If a job lands during a deploy now, it just waits longer instead of failing. |
| **Error 4** `Audio generation failed: no audio was produced.` (15-page script) | Cascading from Error 1 — all chunks of a chunked job hit the same connection-pool starvation. | Worker split fixes the underlying cascade. PR #307 (in review) also adds **Sentry breadcrumbs per chunk** so we can see WHICH chunk(s) failed if it ever does recur, plus an explicit "partial audio" path so generation completes with N-1 of N segments rather than hard-failing. | Generate a 15-page script. Should complete cleanly. If a single chunk fails after PR #307 merges, you'll get the audio for the other chunks + a `partial audio` notice in the project. |

**Test order for §1:** start with Error 1 (3-page script) → if green, jump to Error 4 (15-page script). Don't burn budget trying to reproduce Error 2/3 — they need the in-review PRs to surface the diagnostic info.

---

## 2. Quality items — sliders live now

Three of your quality observations from 2026-06-15 are addressed:

| Observation | Where the fix lives | How to test |
|---|---|---|
| **"narration delivery is consistently a slower pace than desired. We should adjust Narration tempo to be slightly faster"** | **`/settings/audio` — Narration speed slider** | See walkthrough in §3. Move slider to ~1.10x, generate a test sample, decide if it's right. |
| **"Background Ambience, SFX, and background music: Volumes are slightly lower than desired. All volumes should be turned up slightly."** | **`/settings/audio` — Background music / Ambience / SFX sliders** | Try +2 to +4 dB on each, generate a test sample, decide. |
| **"character voices are voicing lines or parts of descriptions rather than just voicing dialogue"** | **PR #300 (in review).** Director-agent post-validator catches lines that look like stage direction (parentheticals, scene headers, FADE/CUT TO, CLOSE ON, all-caps action) and reassigns them to the Narrator voice. | Once PR #300 merges, regenerate one of the scripts where you observed this and check whether the offending lines now narrate instead of being voiced by a character. |

---

## 3. `/settings/audio` walkthrough

**Path to the page:** click your avatar → **Settings** → click the **Audio Tuning** card → "Open audio tuning". Or hit `https://app.storymagicapp.net/settings/audio` directly.

### The four sliders

| Slider | Range | Default | What it does |
|---|---|---|---|
| Narration speed | 0.85x – 1.20x | 1.00x | Multiplier passed to ElevenLabs for **narrator lines only**. Character voices keep their natural pacing. |
| Background music volume | -8 dB to +8 dB offset | 0 (=in-code -12 dB) | Added to the music event gain at mix time. +3 dB = noticeably louder; -3 dB = noticeably quieter. |
| Ambience volume | -8 dB to +8 dB offset | 0 (=in-code -18 dB) | Same — ambience tracks (room tone, environment beds). |
| Sound-effect volume | -8 dB to +8 dB offset | 0 (=in-code -6 dB) | Same — discrete SFX hits. |

Each slider shows both the offset AND the resulting absolute dB (e.g., `+2 dB (default -12 dB → -10)`).

### The workflow

```
1. Move sliders to where you want them
2. Click "Generate test sample (30s)" — this runs scene 1 of
   your most recent generated project through the orchestrator
   with the slider values. Takes ~30-90 seconds depending on
   ElevenLabs.
3. Audio autoplays inline. Listen.
4. Tweak sliders, repeat #2-3 as much as you want — adjustments
   DO NOT affect real generations until you Lock.
5. When happy → "Lock these settings"
6. Every future Generate Now uses your locked values.
```

### Unlocking

The same page has an Unlock button when locked. Unlocking reverts to the in-code defaults for future generations; your slider positions persist.

### What's not tunable in v1

Per the design doc, we deferred to v2:
- Per-character voice stability / similarity boost
- Per-scene crossfade duration
- Target loudness LUFS

If any of those become a friction point, let me know.

### Scene-cache caveat (important)

The system caches scene renders so re-generating a script with the same content is cheap (~50ms scene cache hit instead of full TTS+mix). **When you change locked tuning values, the next generation invalidates the cache for affected projects** — that one project's first generation after a tuning change will take the full ~3 min, not the cached path. Expected. Subsequent generations on the same project at the same tuning are fast again.

---

## 4. Earlier fixes shipped this morning (already in production)

These don't need re-testing on their own — they came up during the worker-split + Listen-UI work. Calling them out so you know what's running:

| Item | What it does | Impact on your batch |
|---|---|---|
| **Worker split** (this morning) | `story-magic-worker` runs the queue out-of-process. Web service no longer shares its DB pool with long jobs. | Closes the root cause behind your Error 1 / Error 4. |
| **Listen UI alignment** (PR #293) | Listen page now reads whisper alignment from the `alignments` table and overlays absolute line timings on the player. | Highlighted text should track the audio without drift on a 5-15 page script — you can verify on any of your existing generated projects. |
| **Migration 0042** (`audio_tuning` table) | Required for the sliders feature. Already applied. | Transparent — no test impact. |

---

## 5. In-review fixes (Peter has 7 PRs)

These haven't merged yet. They will collectively re-fix the team-feature regressions and add several reliability/UX improvements. Once Peter clears them, I'll ping you.

| PR | What you'll notice | Likely test fit |
|---|---|---|
| **#295** Enterprise CSP | The CSRF error you saw on /enterprise/dashboard signup stops appearing | Try signing up a brand-new account via the enterprise flow. |
| **#296** Reader % clamping | "Recently Played" no longer shows nonsense percentages (>100%, NaN) | Visual check on your reader dashboard. |
| **#298** Readiness 60s + jobId in toast | Failure toasts show a copyable Job ID; Error 3 (readiness timeout) stops firing on deploy clicks | Generate something while a deploy is happening. |
| **#300** Character voices to Narrator | Stage directions read by Narrator instead of a character voice | Regenerate the script where you saw this. |
| **#302** Invite-flow regressions (A-006/007/008) | (a) Invite accept no longer auto-redirects to dashboard — shows the team confirmation card. (b) Re-inviting a deactivated email actually sends. (c) Sub-accounts default to **Pro tier (15 scripts/mo)**, was Creator (5). | Run the full invite cycle once. Try ryan@collabworld.net again. |
| **#304** Favicon + install-prompt spam | DevTools console no longer floods with "Banner not shown" warnings or favicon 404s | Open DevTools and watch the console while navigating around. |
| **#307** Partial-audio + Sentry chunk breadcrumbs | A 15-page script where one chunk fails returns the other chunks' audio + a "partial audio" notice, instead of failing outright | Generate a 15-page script. Compare behavior to your 2026-06-15 Error 4 test. |

---

## 6. Suggested test order

If you have ~90 minutes, here's the highest-signal order:

1. **`/settings/audio` exploration (15 min)** — set narration to ~1.10x, music +3 dB, ambience +3 dB, SFX +2 dB. Generate test sample. Iterate until subjectively right. Don't lock yet.
2. **3-page script generation (5 min)** — vanilla Generate Now. Verify no Error 1 recurrence.
3. **Listen flow check (5 min)** — open the resulting project in the Listen view. Verify the script highlight tracks audio.
4. **15-page script generation (10 min)** — vanilla Generate Now. Verify no Error 4 recurrence. Listen flow check again.
5. **Lock your /settings/audio preferences** — once you've confirmed the slider values you want.
6. **Re-generate one of the same scripts with locked tuning** — confirm the audio reflects your preferences end-to-end.
7. **Capture anything that doesn't behave as expected** — paste the Job ID from any failure toast into a reply.

---

## 7. Peter — PR review plan

Recommended review order. Each is independently revertable; all CI green; 0 TypeScript errors; full per-PR notes in `docs/PETER-REVIEW-QUEUE-2026-06-15.md`. The audio-tuning chain has already merged; this list is what remains.

### Sprint 1 (low-risk, can merge fast in any order)

| # | PR | Why first | Risk |
|---|---|---|---|
| 1 | **#295** | Pure additive CSP fix; isolated; unblocks Ryan's enterprise signup test | Very low |
| 2 | **#296** | Pure helper extraction; no schema; cosmetic | Very low |
| 3 | **#298** | UX win on every failure path; bumps a readiness constant; no DB | Low |
| 4 | **#304** | Cosmetic console-noise cleanup + favicon link | Very low |

### Sprint 2 (medium-risk, read more carefully)

| # | PR | What to look at | Risk |
|---|---|---|---|
| 5 | **#300** | Director validator's new `autoReassignStageDirectionsToNarrator`. Uppercase heuristic threshold (>50% caps + >20 chars) — could in theory miss-classify legit angry dialogue like "I CAN NOT BELIEVE THIS". Acceptable trade-off but worth eyeballing the 18 unit cases. | Low-med |
| 6 | **#302** | Three coordinated invite fixes: (a) the no-auto-accept branch in `app/invite/[token]/page.tsx`, (b) the `deactivatedAt`-aware reactivation in `teams.ts::addMember`, (c) the `INVITE_DEFAULT_TIER=pro` env-overrideable default in the accept route. The email-mismatch note in (a) is informational — not blocking — argue with me if you'd rather it hard-block. | Medium |
| 7 | **#307** | Partial-audio detection + Sentry breadcrumbs. The captureMessage is tagged `pipeline.partial_audio` so it's easy to filter. No behavior change for the happy path. | Low-med |

### Notes for Peter

- **Tag me** if anything is ambiguous. Faster to clarify than to leave unresolved.
- **None of these need orchestrator-side coordination.** All seven are web-only.
- **CI is green on every PR** per `gh pr checks`. The only ones with new tests are #295 (+34), #296 (+16), #298 (0), #300 (+18), #302 (+2), #304 (0), #307 (0 — observability-only).
- **#298 + #302 + #307 are the most testable** end-to-end against Ryan's batch. The others are infrastructure-shaped and verifiable via the test suite alone.

If we land all 7 today, the entire 2026-06-15 testing reactive cycle is closed code-wise. Ryan's next pass would then surface only new findings, not residue from this batch.

---

## 8. After the dust settles

Once both halves (Ryan's testing + Peter's reviews) land, the friendly-cohort GTM gate becomes:

- ✅ Worker split (already done)
- ✅ Audio quality controls (sliders live, character-voice fix in #300)
- ✅ Invite flow regressions (in #302)
- ✅ Reliability improvements (worker pool, A-001/002/003/004 in flight)
- ❌ **Stripe live walkthrough** (Chris — ~1 hour, $0 cost, follow `docs/STRIPE-LIVE-WALKTHROUGH-2026-06-13.md`)
- ❌ **UAT pass** (~2 hours manual click-through of `docs/UAT-2026-06-09.md`)

Two manual checklists. Then we open the door.

— Chris
