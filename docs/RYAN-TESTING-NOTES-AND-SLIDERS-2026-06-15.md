# Ryan's Testing Notes + Audio-Tuning Sliders Design

**Date received from Ryan:** 2026-06-15
**Author of this writeup:** Chris Therriault (via Claude)
**Status:** Notes captured for triage. Sliders proposal awaiting Ryan's thumbs-up before implementation.

This document has two halves:

1. **Part A** — Ryan's testing notes (audio failures, quality observations, team-feature observations), structured so each finding maps to an engineering action with a status.
2. **Part B** — A proposed in-app **Audio Tuning** panel that lets Ryan adjust narration tempo, music gain, ambience gain, and SFX gain via sliders, generate a short test sample, iterate, and **lock in** his preferred defaults for the account.

The goal of Part B is to remove the back-and-forth of "open a ticket → wait for a deploy → re-test" for cosmetic audio adjustments. Once locked, the saved values flow into every future generation on Ryan's account.

---

## Part A — Testing notes (2026-06-15 batch)

### A.1 Audio generation reliability

Ryan ran ~10 short scripts (1–5 pages each) through audio generation. Mix of successful and failed runs. Four distinct error signatures:

| # | Error surface | Symptom | Stage where it fails | Likely backend cause | Eng action |
|---|---|---|---|---|---|
| 1 | `fetch failed` (5–6 min in) | Generic upstream fetch error mid-pipeline | Mid-pipeline (post-director, mid-orchestrate) | Transient network failure to ElevenLabs or OpenAI; OR connection-pool exhaustion if pre-worker-split run | Investigate Sentry for the exact failure window after worker split; add retry-with-backoff on ElevenLabs/OpenAI fetch |
| 2 | `Script parsing failed. Please try again or contact support` (5–6 min in) | Director agent failed silently after some retries | Director stage | Schema validation rejected (likely a `.min/.max/.length` on a zod schema sent to Anthropic — same bug class PR #197's guard was meant to catch) OR Anthropic rate-limit | Check Sentry for the affected jobId; if guard isn't catching new sites, extend it. Also: surface the underlying cause in the toast rather than the generic message. |
| 3 | `orchestrator did not become ready within 30000ms (probed 8x)` | Web worker couldn't reach orch | Pre-director (worker → orchestrator handshake) | Orchestrator was redeploying during the click. The 30s readiness probe is sometimes too short during Render rolling deploys. | Bump `waitForOrchestratorReady` from 30s → 60s; add a friendlier message "Orchestrator is restarting after a deploy. Retrying automatically…" |
| 4 | `Audio generation failed: no audio was produced` (15-page script, 5–6 min in) | All chunks failed | Late pipeline | At least one chunk's orchestrator call returned an error AND the partial-audio guard fired. Likely related to #1 (fetch failed cascading across all segments). | Same root-cause investigation as #1. Also: when N-1 segments succeed and 1 fails, surface partial audio instead of returning a hard error. |

**Cross-cutting observation about error toasts**

The four messages above are end-user copy. They don't include a `jobId` or a "Show details" button. Triage on our end is harder than it should be. Suggested follow-up: the failure toast carries a small `Job ID: 1a2b3c…` line that's copyable for Ryan to paste into a ticket.

**Console-output noise (not blockers, but worth filtering)**

Ryan's console pastes show a lot of `Banner not shown: beforeinstallpromptevent.preventDefault()` lines. That's the PWA install banner being suppressed because we call `preventDefault` and never `prompt()`. It's correct behavior (we don't want the install banner mid-generation), but the message is noisy in DevTools. Either (a) only call `preventDefault` once, or (b) ignore it as known-and-benign.

The repeated `Service Worker was updated because "Update on reload" was checked in the DevTools Application panel.` is Ryan's DevTools setting — not a code issue.

`/favicon.ico:1  Failed to load resource: 404` — Render's static serving doesn't have a favicon at the apex root. Trivially fixable: drop `packages/web/app/favicon.ico` (it's referenced in `app/layout.tsx`'s metadata).

---

### A.2 Audio generation quality

| # | Observation | Where to adjust | Eng action |
|---|---|---|---|
| Q1 | **Narration pacing is too slow.** Want it slightly faster. | Per-voice `voice_settings.speed` passed to ElevenLabs TTS; OR narrator-specific override | **Sliders proposal — Part B.** Specifically the **Narration speed** slider. |
| Q2 | **Character voices occasionally voice non-dialogue text** (parts of action lines / parenthetical descriptions). | Director-agent prompt + script parser | Tighten the director-agent prompt to reject any non-dialogue line for the dialogue payload; add a parser invariant test that any line emitted with a `character` field must be inside a SCREENPLAY DIALOGUE block, not an ACTION or PARENTHETICAL block. |
| Q3 | **Background music / ambience / SFX volumes too low.** Want each slightly louder. | `MusicInEvent.gain_db` (default -12), `AmbienceInEvent.gain_db` (default -18), `SfxAtEvent.gain_db` (default -6) | **Sliders proposal — Part B.** Three sliders. |

---

### A.3 Team features

| # | Observation | Status / next action |
|---|---|---|
| T1 | Team invite, when accepted, now takes the user directly to dashboard. Should first show **create account / set password**, then accept the invite. | Bug. Likely a regression in the `/sign-up?redirect_url=` handoff after the invite-accept route hands off to Clerk. Reproduce → file a focused fix issue. |
| T2 | Invite to **ryan@collabworld.net** is never delivered. The email was previously a team member, was deleted, and the new invite never arrives. | High-likelihood cause: the previous-membership row's `invited_email` index is still present and deactivated → the new-invite producer hits the "already invited" path and silently no-ops the email send. Investigate `removeMember` + `inviteMember` interaction. |
| T3 | For testing purposes, every sub-account spawned from a master-account invite needs to be on the **Pro plan with 15 scripts/month**, not the lower default. | Roll the sub-account default tier up to Pro for any invitee, OR a feature flag `INVITE_DEFAULT_TIER=pro`. Confirm with Ryan whether this is a permanent change or testing-only. |

---

### A.4 Triage priority

| Sprint | Items |
|---|---|
| **Now** (next session) | A.1 #3 (orchestrator readiness bump — 5 min change), A.1 surface jobId in toast, A.2 sliders (Part B below — proposal first) |
| **Next** | A.1 #1/#2/#4 root-cause investigation in Sentry, A.3 T1 (invite UX regression), A.3 T2 (silent no-op invite send) |
| **Later** | A.1 noise filtering (favicon, install-banner spam), A.3 T3 (sub-account default tier — pending confirmation) |

---

## Part B — Audio Tuning sliders

**Goal:** give Ryan an in-app surface to adjust narration speed and the three audio-mix gains without an engineering round-trip, test the result on a short sample, then **lock** his preferred values so every future generation uses them by default.

This becomes the canonical pattern for "knobs Ryan wants to tune himself."

### B.1 What's actually adjustable today

Confirmed in code while writing this doc:

| Knob | Code site | Current default | Sensible adjustment range |
|---|---|---|---|
| Narration speed | TTS request `voice_settings.speed` for the narrator voice in `packages/orchestrator/src/orchestrator/workers/tts.ts` | 1.00 | 0.85 – 1.20 (steps of 0.05) |
| Music gain | `MusicInEvent.gain_db` default in `packages/orchestrator/src/schemas/timeline.ts:63` | **-12 dB** | -20 to -6 (steps of 1 dB) |
| Ambience gain | `AmbienceInEvent.gain_db` in `schemas/timeline.ts:48` | **-18 dB** | -26 to -10 (steps of 1 dB) |
| SFX gain | `SfxAtEvent.gain_db` in `schemas/timeline.ts:78` | **-6 dB** | -14 to 0 (steps of 1 dB) |

Higher dB = louder. All three audio defaults sit at conservative LUFS-friendly levels per the broadcast standard in `CLAUDE.md`. Raising them slightly to match Ryan's preference is well within safe peak headroom (-1.5 dB true-peak limit at -16 LUFS integrated).

### B.2 Schema — where the values live

Add a JSON column on `Profile` (or a small new table; one row per user is the simplest shape):

```prisma
model AudioTuning {
  userId          String  @id @map("user_id")
  // dB offsets to add to the default gains. So 0 = baseline. +3 = Ryan's "slightly louder"
  // request without us having to remember what "baseline" was at the time he locked.
  musicGainOffsetDb     Int     @default(0) @map("music_gain_offset_db")
  ambienceGainOffsetDb  Int     @default(0) @map("ambience_gain_offset_db")
  sfxGainOffsetDb       Int     @default(0) @map("sfx_gain_offset_db")
  // Narration speed multiplier passed straight to ElevenLabs (1.0 = baseline)
  narrationSpeed  Float   @default(1.0) @map("narration_speed")
  // When true, future generations pick these up automatically.
  // When false (or row absent), generations use the in-code defaults.
  locked          Boolean @default(false)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz

  user            Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("audio_tuning")
}
```

Storing **offsets** (rather than absolute values) is intentional — it lets us tune the baseline gains later (e.g. for a different mix engine or a future loudness-norm change) without invalidating Ryan's saved preference.

### B.3 UI — `/settings/audio` page

A single Settings sub-page with four sliders, a "Generate test sample" button, a 30-second preview player, and a Save/Lock button. The shape Ryan asked for:

```
┌─ /settings/audio ───────────────────────────────────────┐
│                                                         │
│  Audio Tuning                          [   Locked  ]    │
│                                                         │
│  Narration speed                                        │
│  ━━━━━━━━━●━━━━━━━━━━   1.05x                          │
│  Slower (0.85)                          Faster (1.20)   │
│                                                         │
│  Background music volume                                │
│  ━━━━━━━━━━●━━━━━━━━━   +2 dB (default -12 dB → -10)   │
│  Quieter (-8)                            Louder (+8)    │
│                                                         │
│  Ambience volume                                        │
│  ━━━━━━━━●━━━━━━━━━━━   +3 dB (default -18 dB → -15)   │
│  Quieter (-8)                            Louder (+8)    │
│                                                         │
│  Sound-effect volume                                    │
│  ━━━━━━━●━━━━━━━━━━━━   +2 dB (default -6 dB → -4)     │
│  Quieter (-8)                            Louder (+8)    │
│                                                         │
│  [ Reset to defaults ]   [ Generate test sample (30s) ] │
│                                                         │
│  Last preview: [ 0:00 ━━━━●━━━━ 0:30 ] ▶                │
│                Built 22:14 — scene_001 of "Falling      │
│                Leaves"                                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [   Lock these settings    ]                    │    │
│  │ When locked, every future generation on this    │    │
│  │ account uses these values. You can unlock and   │    │
│  │ adjust at any time.                             │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

Notes on the UI choices:

- **Show both the offset and the resulting absolute value** in the label ("+2 dB (default -12 → -10)") so Ryan can think in either frame. Sound engineers think in absolute dB; product folks think in offsets.
- **Test sample is short and cheap** (one scene's worth, ~30 s) so iterations are 1–2 min each rather than 5–10 min.
- **"Lock these settings"** is the explicit commit step. Until locked, his adjustments are persisted but **not applied** to non-preview generations. This way Ryan can experiment without breaking the friendly cohort's audio mid-test.
- **"Reset to defaults"** is non-destructive — it just zeros the sliders; saved-and-locked state is unchanged until he locks again.

### B.4 Backend wiring

1. **Server action** to `PATCH /api/settings/audio-tuning` accepting `{ musicGainOffsetDb, ambienceGainOffsetDb, sfxGainOffsetDb, narrationSpeed, locked }`. Validates ranges with zod (clamped to the safe ranges in B.1).
2. **Server action** to `POST /api/settings/audio-tuning/preview` that:
   - Picks the user's most recent project (or a built-in canned scene if no project)
   - Renders **one scene** through the orchestrator with the requested overrides applied
   - Returns the resulting audio URL
3. **Pipeline integration** — `packages/orchestrator/src/orchestrator/pipeline.ts` accepts an optional `audioTuning` parameter. When present:
   - The narrator's `voice_settings.speed` is multiplied by `narrationSpeed`
   - The mix step adds `musicGainOffsetDb` / `ambienceGainOffsetDb` / `sfxGainOffsetDb` to each event's `gain_db` before passing to ffmpeg
4. **Web call site** — when starting a generation in `lib/generation/processor.ts`, fetch the user's `AudioTuning` row. If `locked = true`, pass to the orchestrator. Otherwise, send `undefined` and the orchestrator uses defaults.

### B.5 Idempotency / cache invalidation

The scene-render cache (`scene_renders` table) hashes inputs to know when to re-render. **Audio tuning values must be part of the hash inputs** so a tuning change invalidates the cache. Otherwise Ryan would lock in new values and his next generation would silently re-use the old mix.

`packages/orchestrator/src/lib/scene-cache.ts::computeSceneRenderHash` already accepts a `mix` object. Extend it to include `{ musicGainOffsetDb, ambienceGainOffsetDb, sfxGainOffsetDb, narrationSpeed }`. Existing rows stay valid because `null/undefined` offsets hash differently than `0`.

### B.6 Tests

| Test | What it pins |
|---|---|
| `audio-tuning.test.ts` (unit) | Clamping is correct: ranges enforce min/max; lock state transitions correctly. |
| `apply-audio-tuning.test.ts` (unit, orchestrator) | When tuning is supplied, the mix events emit gain values shifted by the offset; speed multiplier reaches the TTS call. |
| `scene-cache.test.ts` (extension) | Adding a tuning offset changes the hash; same tuning hashes the same. |
| Component test on the slider page | Slider movement updates the displayed absolute value; "Reset" zeros the sliders; "Lock" calls the PATCH endpoint with the right payload. |

### B.7 Estimate

| Surface | SP |
|---|---|
| Prisma migration + AudioTuning model | 0.5 |
| Backend: get/patch route + preview generation route | 2 |
| Orchestrator pipeline integration + cache-hash extension | 2 |
| UI page (sliders + preview player + lock button) | 2 |
| Tests | 1 |
| **Total** | **7.5 SP** |

Spread across one focused session. Ryan's tuning values + tests pass = mergeable.

### B.8 Future expansion (out of scope for v1)

Other knobs that could later become sliders without much extra work:

- **Per-character voice stability** (ElevenLabs stability/similarity controls)
- **Per-scene crossfade duration** (current 1.5s default)
- **Target loudness LUFS** (current -16 LUFS broadcast default — change only if Ryan needs streaming-platform-specific targets like Spotify's -14 LUFS)
- **Director's "energy" interpretation** — but this is a model-prompt knob, not a slider. Better surfaced as a `Genre` or `Tone` picker on the project itself.

---

## Where to find this doc

`docs/RYAN-TESTING-NOTES-AND-SLIDERS-2026-06-15.md`

Future testing rounds get their own dated successor. When the sliders ship, replace Part B with the actual UI screenshot and link to the live page.
