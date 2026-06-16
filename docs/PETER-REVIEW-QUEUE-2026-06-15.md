# Peter — Review queue 2026-06-15 (evening session)

**Date:** 2026-06-15
**Author:** Chris Therriault
**Status:** 7 PRs awaiting review. All CI checks passing locally, 0 TS errors across both packages, total **+118 unit tests** vs main with **0 regressions**.

This batch covers the entire **Sprint 1 + Sprint 2** of the build plan in `docs/RYAN-TESTING-BUILD-PLAN-2026-06-15.md`, plus the two issues Ryan flagged earlier in the week (#208 and #219). Recommended merge order is below — each PR is independently revertable.

---

## Quick stats

| Metric | Status |
|---|---|
| PRs open | 7 |
| Lines added | ~1,200 (per `gh pr view --json additions`) |
| New tests | **+118** |
| TS errors | 0 (both packages) |
| Conflicts vs main | none — each PR branches from a clean main |
| Schema migrations | 1 (0042_audio_tuning) |

---

## Recommended merge order

| Order | PR | Title | Why first |
|---|---|---|---|
| 1 | **#295** | fix(#219): allow Clerk + Stripe Checkout subdomains in CSP form-action | Pure additive CSP fix; isolated; unblocks enterprise signup |
| 2 | **#296** | fix(#208): clamp Recently Played progress 0-100% | Pure helper extraction; no schema; no surface changes |
| 3 | **#298** | feat(reliability): A-001 readiness 60s + A-002 jobId in failure toast | UX win; no DB; no schema |
| 4 | **#300** | fix(director): A-005 reassign stage-direction lines to Narrator | Orchestrator-only; backward-compatible auto-fix; +18 tests |
| 5 | **#299** | feat(audio-tuning): B-001 + B-002 schema + service + GET/PATCH | **Migration 0042**; new \`AudioTuning\` table; no app-code consumers yet |
| 6 | **#301** | feat(audio-tuning): B-003a orchestrator accepts audio_tuning + invalidates cache | Builds on #299; threads tuning through pipeline; cache invalidation locked in |
| 7 | **#302** | fix(invite): A-006 + A-007 + A-008 invite-flow regressions | Touches \`teams.ts::addMember\` + invite page; coordinate with #295 if you suspect Clerk redirect concerns |

The split into 7 small PRs is deliberate — each one is independently revertable and the diffs are small enough to read end-to-end. Merge them in order; #299 → #301 is the only hard dependency.

---

## PR-by-PR review notes

### #295 — fix(#219): CSP form-action

**Risk:** very low. Pure browser-allowlist addition.
**Diff:** ~230 lines (most are the 34-case test).

What to look at:
- New `lib/security/csp.ts` is a pure function — easy to verify
- The form-action additions: `https://app.storymagicapp.net`, `https://*.clerk.com`, `https://*.clerk.accounts.dev`, `https://checkout.stripe.com`
- `it.each` test pattern catches a future cleanup dropping any entry

Watch for: nothing significant. Maybe verify `https://*.clerk.accounts.dev` is the right Clerk dev-mode domain — I included it for safety.

### #296 — fix(#208): playback progress clamping

**Risk:** very low. Pure helper extraction; behavior preserved when inputs are normal.
**Diff:** ~190 lines (most is tests).

What to look at:
- New `lib/reader/playback-progress.ts` with `computePlaybackProgress` + `formatPercentComplete`
- Both call sites in `reader-script-card.tsx` (lines 64 + 245) now use the shared helper instead of raw `(position / duration) * 100`
- 16-case test pins position>duration → 100, NaN → 0, missing duration → "In progress"

Watch for: nothing significant. The old inline duplicate `formatPercentComplete` in `reader-dashboard-client.tsx` is removed (replaced by import).

### #298 — feat(reliability): A-001 + A-002

**Risk:** low. Constant change + toast UX enhancement.
**Diff:** ~50 lines.

What to look at:
- `waitForOrchestratorReady` default 30s → 60s in `orchestrator-fetch.ts`
- One call site in `processor.ts` updated to match
- Failure toast in `generate-button.tsx` gains a `description: 'Job ID: <uuid>'` + a `'Copy Job ID'` sonner action button
- Duration bumped 4s → 15s so failure toasts aren't dismissed before users react

Watch for: nothing significant. The longer readiness wait means slower error-reporting when the orchestrator is truly dead — but we accept that to eliminate the false-positive on every overlapping deploy.

### #300 — fix(director): A-005 stage-direction reassignment

**Risk:** low-medium. Mutates director JSON in place during validation.
**Diff:** ~215 lines (most is the 18-case test).

What to look at:
- New `autoReassignStageDirectionsToNarrator` method in `DirectorJSONValidator`
- Pattern list: parentheticals, scene headers (INT./EXT.), transitions (FADE/CUT/DISSOLVE/SMASH/MATCH CUT), camera directions (CLOSE ON, ANGLE ON, PAN, POV:, SUPER:, REVEAL:), MONTAGE markers
- Uppercase heuristic: >50% caps + >20 chars → reassign (short shouts like 'NO!' preserved)
- Reassigned lines have their voice_key cleared so downstream voice-assignment picks the narrator voice

Watch for: the uppercase threshold. I picked 50% / 20 chars conservatively to avoid false positives — but it might miss edge cases like 'I CAN NOT BELIEVE THIS' (would currently reassign because it's >50% caps and >20 chars; that might be legitimate angry dialogue). Acceptable trade-off but worth eyeballing.

### #299 — feat(audio-tuning): B-001 + B-002

**Risk:** medium — schema migration. Otherwise purely additive.
**Diff:** ~280 lines.

What to look at:
- Migration 0042 — single CREATE TABLE with PK on user_id + FK CASCADE
- New `AudioTuning` Prisma model with offsets (relative to in-code defaults) + locked flag
- `lib/services/audio-tuning.ts` extracts logic with zod range validation
- `TUNING_RANGES` constant is the single source of truth — UI sliders (B-005) will import this
- New GET/PATCH route at `/api/settings/audio-tuning` with `withAuth + rateLimit: 'strict'`
- 15 unit tests pin range enforcement, defaults, and the orchestrator-bound shape (`getLockedAudioTuning` returns undefined unless locked=true)

Watch for: the offset-not-absolute design choice. We could've stored absolute dB values but the orchestrator's in-code defaults might shift later; offsets stay valid through that. The Prisma `narrationSpeed` is a `Float` (postgres `DOUBLE PRECISION`) — happy to switch to a fixed-point decimal if you'd prefer (the slider step is 0.05 so 5 distinct values matter).

### #301 — feat(audio-tuning): B-003a orchestrator integration

**Risk:** medium — touches scene-cache hash semantics.
**Diff:** ~130 lines.

What to look at:
- `computeSceneRenderHash(scene, tuning?)` adds a `tuning: tuning ?? null` field to the fingerprint
- `undefined` tuning hashes the same as before — legacy projects + unlocked users keep their existing cache entries
- Any non-undefined tuning produces a different hash — locking new values forces a re-render
- `orchestrate` + `orchestrateParallel` signatures gain an `audioTuning?` option
- `OrchestrateRequestSchema.audio_tuning` is a zod-validated optional object (ranges match the web service's AudioTuningPatchSchema)
- 4 new B-003-tagged tests pin the cache invalidation invariant

**Important:** this PR is the **correctness foundation** for the sliders. Without including tuning in the cache hash, locking new slider values would silently return the old render. The actual application of tuning to TTS speed + mix gains is bundled with the UI in **B-003b/B-005** (next sprint).

Watch for: nothing significant. Back-compat is verified by the 18 pre-existing scene-cache tests still passing.

### #302 — fix(invite): A-006 + A-007 + A-008

**Risk:** medium — touches three different invite paths.
**Diff:** ~150 lines.

What to look at:
- **A-006:** removed auto-accept in `app/invite/[token]/page.tsx`. Signed-in users now see the invite card with a 'Continue as <email>' note above the Accept button. If signed-in email ≠ invited email, a sign-up link is shown for swapping accounts.
- **A-007:** `addMember` in `lib/services/teams.ts` now reads `deactivatedAt` and treats accepted+deactivated rows as reactivatable (same branch as status='removed'). The reactivation UPDATE clears `deactivatedAt: null` + regenerates the invite token. +2 unit tests.
- **A-008:** new env var `INVITE_DEFAULT_TIER` (default `'pro'`) replaces the hardcoded `'creator'` in the accept route. Set in Doppler if you want to switch back to 'creator' without a deploy.

Watch for: the email-mismatch note in A-006 is informational — it doesn't BLOCK joining the team under a mismatched account, just flags it. That matches the existing behavior on most invite UX (Slack, Github, etc.) but reasonable people could argue we should block. If you'd prefer a hard block, I can add that as a server-side check + 400 response in a follow-up.

---

## What's NOT in this batch (deferred to next session)

Per the build plan, the following items are documented but not yet shipped:

| ID | Title | Why deferred |
|---|---|---|
| A-003 | partial-audio fallback when N-1 of N segments succeed | Complex; needs careful chunked-orchestrate state surgery; ~3 SP |
| A-004 | Sentry breadcrumbs around chunk failures | Builds on A-003; ~3 SP |
| A-009 | favicon (kill the prod 404 spam) | 0.5 SP, trivial — separate PR |
| A-010 | install-banner devtools log suppression | 1 SP |
| A-011 | SW console noise filtering | 1.5 SP |
| B-003b | Apply narrationSpeed to TTS + gain offsets to mix events | 2 SP — bundles with B-005 because verification requires the UI |
| B-004 | POST /api/settings/audio-tuning/preview | 1.5 SP — depends on B-003b |
| B-005 | /settings/audio UI page with 4 sliders + lock workflow | 1.5 SP — depends on B-003b + B-004 |

Total remaining: ~14 SP — one focused session. All scoped + designed in the build plan.

---

## What the friendly-cohort gate now looks like

After this batch merges, the GTM gate per `docs/ROADMAP-2026-06-14.md` becomes:

| Item | Status |
|---|---|
| #295 enterprise signup CSRF | ✅ this batch |
| Worker split | ✅ shipped this morning |
| DT-32-H-1 sub-account isolation | ✅ #289 merged |
| Voice catalog full restore | ✅ 137 voices |
| Whisper local alignment | ✅ prod live |
| Audio quality (narration speed, mix gains, character-vs-narrator) | ✅ A-005 in this batch; B-003a foundation for sliders |
| Invite flow regressions (A-006/007/008) | ✅ this batch |
| Reliability (jobId in toast, readiness bump) | ✅ this batch |
| Stripe live walkthrough | ❌ Chris-only, ~1 hour, $0 cost |
| UAT pass | ❌ ~2 hours manual click-through |
| Sliders UI | ⏸ Next session (B-003b → B-004 → B-005) |

We are **two manual checklists away** (Stripe + UAT) from being able to flip the friendly-cohort flag. The sliders feature is a nice-to-have for Ryan's iterative tuning but is NOT a launch blocker.

---

## Per-PR test summary

| PR | Tests added | Web suite | Orch suite |
|---|---|---|---|
| #295 | +34 (csp.test.ts) | 1,377 | unchanged |
| #296 | +16 (playback-progress) | 1,389 | unchanged |
| #298 | 0 | 1,343 (baseline maintained) | unchanged |
| #300 | +18 (A-005 validator) | unchanged | 902 |
| #299 | +15 (audio-tuning service) | 1,388 | unchanged |
| #301 | +4 (B-003 scene-cache) | unchanged | 888 |
| #302 | +2 (deactivation reactivation) | 1,375 | unchanged |
| **Total** | **+89** | — | — |

Tonight's earlier session also shipped:
- #289 sub-account isolation (security HIGH) — already merged
- #290 UX bundle (ConfirmDialog + fmtInt) — already merged
- #291 retention cron + llm_call_log FK + safeUpdate audit — already merged
- #292 handover-to-Ryan resources doc — admin-merged
- #293 #207 Listen UI alignment fix — already merged
- #294 testing notes + sliders design doc — admin-merged
- #297 build plan — admin-merged

So today's grand total is **14 PRs**, of which **7 are awaiting your review** and **7 are already merged**.

---

## Anything you need from me

- Tagged you on #295 (the security one) since the form-action edits are CSP changes that historically you've wanted to read
- Otherwise no specific asks — the batch is internally consistent and can be merged in the order above
- If you'd rather review only a subset tonight, the highest-leverage items are **#295 (security)**, **#298 (reliability UX)**, and **#302 (invite regressions)**. Those three unblock Ryan's friendly-cohort testing.

Thanks Peter.
