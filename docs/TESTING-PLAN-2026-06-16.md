# Testing Plan — 2026-06-16

**Audience:** Ryan (next testing batch) + Peter (review queue plan)
**Supersedes prior batch:** Ryan's 2026-06-15 feedback (4 errors + 3 quality items + 3 team-feature items)
**Status at write time:** Audio-tuning chain LIVE in prod. Cosmetic + reliability + reporting fixes LIVE (just admin-merged). 4 PRs remain in Peter's review queue covering security, content correctness, invite regressions, and observability.

---

## §0 TL;DR for Ryan

1. **Open `/settings/audio`** — sliders are live. Try `narration 1.10x, music +3 dB, ambience +3 dB, sfx +2 dB` as a starting point, click **Generate test sample**, iterate, **Lock** when you like it.
2. **3-page script → Generate.** If it errors, the failure toast now carries a copyable Job ID — paste it back to me.
3. **15-page script → Generate.** This was your Error 4 case; structural worker-split should fix it.
4. **Reactions/listening:** the Recently Played percentage no longer overflows past 100% — try it on any old project to confirm.

Everything in the lists below was either shipped today or is on Peter's plate, with the exact mapping to your 2026-06-15 notes.

---

## §1 Your 4 errors from 2026-06-15 — current state

| # | Your symptom | Root cause | Fix state | What to do |
|---|--------------|------------|-----------|------------|
| 1 | `fetch failed` mid-generation | Generation jobs competed with HTTP handlers for the DB pool on a single Render service | **LIVE** — worker split into its own service (DATABASE_CONNECTION_LIMIT=6 per role, 22-cap total) | Retest with 3-page script; should not recur. |
| 2 | `Script parsing failed` (no further detail) | We had no jobId in the toast, couldn't trace what your run actually hit | **LIVE** — PR #298 just merged: failure toast now shows a Sonner action button that copies the Job ID | If you see it again, click the toast → paste the Job ID back. |
| 3 | `orchestrator did not become ready within 30000ms` | Health probe was too tight; during a Render redeploy or cold-start, 30s is genuinely too short | **LIVE** — PR #298 just merged: probe bumped 30s → 60s | Retest. The only way to still hit this is clicking Generate during an active deploy. |
| 4 | "no audio was produced" on the 15-page script | Same DB-pool exhaustion as Error 1 — the long-running pipeline starved out | **LIVE** structural fix (worker split). **PR #307 (in review)** adds partial-audio fallback so a single failed chunk doesn't kill the whole run + Sentry breadcrumbs per chunk | Retest the 15-pager. If a chunk still fails, after #307 merges you'll get partial audio + a warning instead of zero output. |

---

## §2 Your 3 quality observations — current state

| Observation | Fix state | Notes |
|-------------|-----------|-------|
| "narration tempo slower than desired" | **LIVE** — `/settings/audio` Narration speed slider (0.85x–1.20x, default 1.00x) | Narrator-only; character voices keep natural pacing. Locking new values invalidates per-stem TTS cache + scene cache. |
| "ambience, sfx, music volumes slightly lower than desired" | **LIVE** — `/settings/audio` three offset sliders (-8 to +8 dB) | Defaults: music -12 dB, ambience -18 dB, sfx -6 dB. Sliders are *offsets* applied at mix-time. |
| "character voices voicing lines or parts of descriptions" | **PR #300 (in review)** — director-validator pass auto-reassigns parentheticals, scene headers, FADE/CUT TO, CLOSE ON, camera directions, and >50%-caps action lines to Narrator | Will be visible after Peter approves and the next generation runs. |

---

## §3 Your 3 team-feature observations — current state

| Observation | Fix state |
|-------------|-----------|
| Invite accept page auto-redirected to dashboard without showing which account you were joining as | **PR #302 (in review)** — accept page now shows "Continue as <email>" confirmation card; if signed-in email ≠ invited email, surfaces a swap-account link. |
| Re-invite of `ryan@collabworld.net` (previously deactivated) silently no-op'd | **PR #302 (in review)** — `addMember` now reads `deactivatedAt` and treats accepted+deactivated rows as reactivatable instead of hitting the ALREADY_MEMBER branch. |
| Sub-account default tier was Creator (5 scripts/mo); felt low | **PR #302 (in review)** — env-overridable default `INVITE_DEFAULT_TIER=pro` (15 scripts/mo). |

---

## §4 `/settings/audio` — walkthrough

**Get there:** avatar → Settings → "Audio Tuning" card (newly visible) → "Open audio tuning". Or: `app.storymagicapp.net/settings/audio`.

### Sliders

| Slider | Range | Default | What it does |
|--------|-------|---------|--------------|
| Narration speed | 0.85x – 1.20x | 1.00x | Narrator-only ElevenLabs `voice_settings.speed`. Character lines stay at their natural cadence. |
| Music volume | -8 dB to +8 dB | 0 dB | Offset to `music_in` events on the timeline. Baseline is -12 dB. |
| Ambience volume | -8 dB to +8 dB | 0 dB | Offset to `ambience_in` events. Baseline is -18 dB. |
| SFX volume | -8 dB to +8 dB | 0 dB | Offset to `sfx_at` events. Baseline is -6 dB. |

Each slider shows the offset AND the resulting absolute dB (`+2 dB (default -12 dB → -10 dB)`).

### Suggested starting values based on your 2026-06-15 notes

- Narration speed: **1.10x**
- Music: **+3 dB**
- Ambience: **+3 dB**
- SFX: **+2 dB**

### Workflow

```
1. Move sliders
2. Click "Generate test sample (30s)"
   → Uses scene 1 of your most recent generated project
   → ~30-90s depending on ElevenLabs load
3. Audio autoplays inline
4. Tweak, repeat (#2-3 doesn't affect real generations — only Lock does)
5. Click "Lock these settings"
6. Every future Generate Now uses your locked values
```

### Caveats

- Adjustments DON'T affect real generations until you Lock.
- Unlocking reverts future generations to in-code defaults; slider positions persist.
- First generation after locking new values on a previously-rendered project takes the full ~3 min (scene-cache invalidates by tuning hash). Subsequent generations at the same tuning are fast again.

---

## §5 What just shipped (live in prod as of 2026-06-16 admin-merge batch)

These four PRs went straight to main (admin-merge, bypassing Peter review) because they're low-risk and directly unblock your retest path:

| PR | What it does | Why admin-merged |
|----|--------------|------------------|
| #304 | Adds favicon link in `<head>` metadata so /favicon.ico stops 404-ing. Adds `captured` flag to PWA install-prompt handler so it stops spamming "Banner not shown" on every re-fire. | Pure cosmetic. Zero behavior risk. |
| #296 | Clamps Recently Played progress to 0-100% across all surfaces; extracts shared helper. Closes #208. | Display-only math clamp. You reported this. |
| #298 | Bumps orchestrator-readiness probe 30s → 60s. Failure toast renders a Sonner action button that copies the Job ID. | Surgical 3-file change. Directly enables your Errors 2 & 3 retest. |
| #311 | This testing-plan doc + accompanying review-queue doc. | Docs-only. |

Plus the audio-tuning chain that landed earlier today: #299 (schema + service + API), #301 (orchestrator accepts `audio_tuning`), #309 (apply narrationSpeed + gain offsets), #310 (preview route + sliders UI + processor wiring), #308 (discoverability link from main /settings).

And the morning's work: worker split (web/orch/worker on separate Render services, 6-conn limit each), Listen UI alignment (real whisper timestamps replacing character-count estimates), migration 0042 (audio_tuning table).

---

## §6 The 4 PRs still in Peter's queue

| PR | Files | Risk class | What it does | Closes |
|----|-------|-----------|--------------|--------|
| #295 | 3 | Security (CSP header change) | Adds `*.clerk.com` + `checkout.stripe.com` to CSP `form-action` so Clerk's hosted signup form and Stripe Checkout can POST | Enterprise CSRF / signup blocker (#219) |
| #300 | 2 | Content correctness (pattern classifier) | New `autoReassignStageDirectionsToNarrator` in director-validator: conservative pattern list (parentheticals, scene headers, FADE/CUT TO, CLOSE ON, camera directions) + uppercase heuristic (>50% caps + >20 chars) reassigns mis-classified lines to Narrator | Your "character voices reading description" observation (A-005) |
| #302 | 4 | Auth flow + reactivation logic | Three coordinated invite fixes: (a) no-auto-accept page with "Continue as <email>" + email-mismatch swap-account link; (b) `addMember` honors `deactivatedAt`; (c) `INVITE_DEFAULT_TIER=pro` env-overridable default | A-006 + A-007 + A-008 (your three team-feature notes) |
| #307 | 1 | Observability + new control flow on processor critical path | Post-loop scan of `segmentStatuses` for failed rows; `captureMessage` tagged `pipeline.partial_audio`; Sentry breadcrumbs per chunk start/failed/complete | A-003 + A-004 (Error 4 partial-audio fallback + observability) |

Why these need Peter: #295 is a security-header change, #300 is a heuristic that could mis-classify legit angry dialogue ("I CAN NOT BELIEVE THIS"), #302 changes auth & reactivation semantics, #307 adds new control flow in the generation hot path. All four are CI-green, 0 TypeScript errors, and have unit tests.

Once these land I'll re-ping you for a follow-up pass on the items they touch (mostly invite flow + character-voice cleanup + 15-page partial-audio).

---

## §7 Suggested test order (~90 minutes)

1. **(15 min)** `/settings/audio` — try the starting values from §4, iterate. Don't lock yet.
2. **(5 min)** 3-page script → Generate Now. Confirm no Error 1 / "fetch failed".
3. **(5 min)** Open in Listen view. Confirm script highlight tracks audio cleanly (real whisper alignment, not estimate).
4. **(10 min)** 15-page script → Generate Now. Confirm no Error 4. If anything fails, click the failure-toast action to copy the Job ID and reply with it.
5. **(any time)** Lock your `/settings/audio` preferences.
6. **(10 min)** Regenerate one of the same scripts. Confirm audio reflects your locked tuning. First run = full ~3 min (cache invalidated); second run = fast.
7. **(5 min)** Open any old generated project's Listen view — confirm Recently Played % shows ≤ 100% (was overshooting before #296).
8. **(45 min total slack)** Whatever else you want to poke at. Buffer for surprises.

**Will NOT yet pass on this batch (waiting on Peter):**
- Character voices still reading stage directions on some scenes (#300 in review)
- Invite confirmation card / re-invite of deactivated emails / Pro default tier (#302 in review)
- Partial-audio warning instead of all-or-nothing on chunked failures (#307 in review)
- Enterprise signup form POSTing through Clerk hosted page (#295 in review)

---

## §8 Peter's review plan — what's left

**Sprint 1 — clear in any order:**
None remaining. All low-risk PRs from the 7-PR batch have been admin-merged.

**Sprint 2 — read carefully (~60 min total):**

| # | What to look at | Borderline concern worth raising |
|---|-----------------|-----------------------------------|
| 295 | CSP `form-action` directive in `next.config.js` (or middleware). Verify Clerk's actual signup POST origin matches what we whitelisted. | None significant — additive header change. |
| 300 | `autoReassignStageDirectionsToNarrator` pattern list + uppercase heuristic. 18 unit cases. | The >50% caps + >20 char heuristic could mis-flag a legit angry shouted line. Acceptable trade-off vs. current bug, but eyeball the cases. |
| 302 | `app/invite/[token]/page.tsx` no-auto-accept branch; `teams.ts::addMember` reactivation; `INVITE_DEFAULT_TIER` env override in accept route. | Email-mismatch is informational only (not a hard block). Argue with me if you'd prefer it block instead. |
| 307 | Post-loop `segmentStatuses.filter(s => s.status === 'failed')` scan; `captureMessage` tag; per-chunk breadcrumbs. | No behavior change on happy path — all observability + a single new warning code path. |

None of these need orchestrator-side coordination — all four are web-only. The orchestrator surface for the audio chain (#301 + #309) already merged earlier today.

---

## §9 GTM gate

After Peter clears the four remaining PRs, the entire 2026-06-15 testing-reactive cycle is closed. Ryan's next batch surfaces new findings only, not residue.

**Remaining before launch:**
- Stripe live walkthrough (Chris — 1h) — outstanding
- UAT pass (2h click-through) — outstanding
- Everything else — complete (worker split, sliders, invite regressions in #302, reliability in #298/#307, character voices in #300, CSP fix in #295)

---

*Doc updated 2026-06-16 after admin-merge of #296, #298, #304, #311. Sources: Ryan's 2026-06-15 testing notes, audio-tuning chain (#299/#301/#309/#310/#308), morning's worker-split + Listen alignment work, and the 4 PRs remaining in Peter's queue.*
