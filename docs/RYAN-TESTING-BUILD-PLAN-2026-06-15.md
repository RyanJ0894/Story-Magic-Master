# Build Plan — Ryan's 2026-06-15 Testing Items

**Date:** 2026-06-15
**Author:** Chris Therriault
**Status:** Active build plan. Source notes: `docs/RYAN-TESTING-NOTES-AND-SLIDERS-2026-06-15.md`.

This doc breaks down everything in Ryan's 2026-06-15 testing notes into shippable PRs with concrete file edits, sequencing, estimates, owners, and verification steps. Two halves:

- **Part A** — reliability + UX + team-feature regressions (12 fixes)
- **Part B** — the audio-tuning sliders feature (7.5 SP across 5 PRs)

Total estimate: **~28 SP across 17 PRs**, spread over **4 working sessions**.

---

## How to read this

Each row in the tables is a self-contained PR. The table shows:

- **ID** — short tag used in commit messages and branch names
- **Title** — proposed PR title
- **Files touched** — concrete paths so reviewers know the blast radius before opening it
- **Effort (SP)** — story points; 1 SP = ~1 focused hour
- **Owner** — who is best placed to ship
- **Depends on** — upstream PRs that need to land first

Sequenced "Now → Soon → Later" so dependencies resolve top-to-bottom.

---

## Part A — Reliability + UX + Team Features

### A.1 Audio generation reliability (4 PRs, 8 SP)

| ID | Title | Files | SP | Owner | Depends on |
|---|---|---|---|---|---|
| **A-001** | feat(orchestrator): bump waitForOrchestratorReady from 30s → 60s + friendlier copy | `packages/web/lib/orchestrator-fetch.ts` (constants + retry message); `packages/web/lib/generation/processor.ts` (catch path message) | 1 | Claude | — |
| **A-002** | feat(jobs): surface jobId in failure toasts | `packages/web/lib/generation/processor.ts` (errorMessage formatting), `packages/web/components/project/generate-button.tsx` (toast renderer); tests | 1 | Claude | — |
| **A-003** | fix(orchestrator): partial-audio fallback when N-1 of N segments succeed | `packages/web/lib/generation/processor.ts` chunked-orchestrate path — emit a `completed_with_failures` job status instead of throwing when ≥1 chunk succeeded | 3 | Claude | A-002 (so the partial-failure toast can show which chunks failed) |
| **A-004** | chore(observability): Sentry breadcrumbs around chunk failures | `packages/web/lib/generation/processor.ts`; one new sentry-tagged transaction per chunk so we can see WHICH chunk failed in a 15-page run | 3 | Claude | — |

Verification (once these ship):
- A-001 fixes Ryan's Error 3 directly. Pickable smoke test: deploy → click Generate during a rolling deploy → see "retrying" instead of error.
- A-002 + A-003 give Ryan partial audio + a jobId when his Error 1 / Error 4 cases recur. He can paste the jobId into a ticket and we get a real trace.
- A-004 makes Sentry usable for diagnosing the 5-of-6 chunk failure pattern Error 4 implies.

### A.2 Audio generation quality (covered by Part B sliders + 1 separate fix)

| ID | Title | Files | SP | Owner | Depends on |
|---|---|---|---|---|---|
| **A-005** | fix(director): character voices must never read non-dialogue text | `packages/orchestrator/src/director/agents/director-agent.ts` (system prompt tightening); `packages/orchestrator/src/director/validation/director-validator.ts` (post-hoc invariant: every dialogue entry must come from a screenplay DIALOGUE block, NOT an ACTION/PARENTHETICAL block); tests on a few synthetic scripts where a parenthetical was dropped into action lines | 3 | Claude | — |

Q1 (narration speed) and Q3 (mix gains) are covered by Part B below.

### A.3 Team features (3 PRs, 7 SP)

| ID | Title | Files | SP | Owner | Depends on |
|---|---|---|---|---|---|
| **A-006** | fix(invite): accept route preserves account-setup flow when no Clerk session exists | `packages/web/app/api/invites/accept/route.ts` (route handler); `packages/web/app/invites/[token]/page.tsx` (UI); add `redirect_url=/invites/[token]/finalize` so Clerk sign-up loops back through the accept after password set | 3 | Claude | — |
| **A-007** | fix(invite): re-invite on deactivated email no longer silently no-ops | `packages/web/app/api/teams/[teamId]/members/route.ts` POST handler — when an existing TeamMember row is found, if `deactivatedAt IS NOT NULL` then reactivate + re-send email; only no-op when `acceptedAt IS NOT NULL` (truly already accepted); test the deactivate→reinvite roundtrip | 2 | Claude | — |
| **A-008** | feat(invite): default sub-account tier configurable; default Pro for invite flow | Add `INVITE_DEFAULT_TIER` env (default `pro`); apply in `packages/web/app/api/invites/accept/route.ts` when minting the new profile + subscription via `provisionTier` (already shipped in PR #289); test that an invite-spawned profile lands on Pro with 15 scripts/mo | 2 | Claude | A-006 (needs the corrected flow), depends on `provisionTier` from #289 (already merged) |

Verification:
- A-006: invite an email Ryan hasn't seen → invite link arrives → click → Clerk sign-up form → password set → redirect to dashboard with profile created AND team accept row present
- A-007: invite Ryan@collabworld.net → accept → deactivate → re-invite → email actually arrives
- A-008: invite-spawned profile has `subscriptionTier = 'pro'`, `generationsLimit = 15`

### A.4 Cleanup (3 PRs, 3 SP)

| ID | Title | Files | SP | Owner | Depends on |
|---|---|---|---|---|---|
| **A-009** | chore(static): add a favicon to kill the prod 404 spam | `packages/web/public/favicon.ico` (new file copied from the existing logo asset); verify `<link rel="icon">` in `app/layout.tsx` references `/favicon.ico` (probably already does) | 0.5 | Claude | — |
| **A-010** | chore(pwa): suppress the install-banner devtools log spam | `packages/web/components/pwa/InstallPrompt.tsx` (or wherever beforeinstallprompt is intercepted) — only call preventDefault once per session OR ignore in dev | 1 | Claude | — |
| **A-011** | fix(sw): respect "Update on reload" devtools setting without spamming the console | `packages/web/public/sw.js` — keep auto-bump behavior but make registration silent in non-error paths | 1.5 | Claude | — |

These are entirely cosmetic but they hide important console output Ryan would otherwise see. Ship one of them per session as filler.

### A.5 Part A summary

**Total: 11 PRs, 21 SP** (8 reliability + 3 quality + 7 team + 3 cleanup).

Critical path (must ship before sliders are useful):
- A-001 (readiness bump) — single biggest improvement to Ryan's "5-6 min then error" experience
- A-002 (jobId in toast) — unblocks reliable triage of remaining failures
- A-005 (character-only-dialogue) — improves the audio quality before sliders matter

The remaining items can ship in parallel with Part B.

---

## Part B — Audio Tuning Sliders

A live in-app surface where Ryan can adjust narration speed + music/ambience/SFX gains, generate a 30s test sample, iterate, then explicitly **Lock** his preferred defaults to apply to every future generation.

Broken into 5 sequential PRs of 1–2 SP each.

### B.1 PRs

| ID | Title | Files | SP | Owner | Depends on |
|---|---|---|---|---|---|
| **B-001** | feat(db): AudioTuning Prisma model + migration 0042 | `packages/shared/prisma/schema.prisma` (new `AudioTuning` model, see below); `packages/shared/prisma/migrations/0042_audio_tuning/migration.sql`; regen Prisma client; no app-code changes yet | 1 | Claude | — |
| **B-002** | feat(api): GET/PATCH /api/settings/audio-tuning | `packages/web/app/api/settings/audio-tuning/route.ts` (new); `packages/web/lib/services/audio-tuning.ts` (new — helper with zod-validated ranges + clamping); `packages/web/tests/unit/api/audio-tuning-route.test.ts` | 1.5 | Claude | B-001 |
| **B-003** | feat(orchestrator): pipeline accepts AudioTuning overrides | `packages/orchestrator/src/orchestrator/pipeline.ts` (accept `audioTuning?: AudioTuning`); `packages/orchestrator/src/orchestrator/workers/tts.ts` (apply narrationSpeed to voice_settings); `packages/orchestrator/src/orchestrator/workers/timeline.ts` (apply gain offsets to dialogue/music/ambience/sfx events); `packages/orchestrator/src/lib/scene-cache.ts::computeSceneRenderHash` (include tuning in hash); tests | 2 | Claude | B-002 |
| **B-004** | feat(api): POST /api/settings/audio-tuning/preview | `packages/web/app/api/settings/audio-tuning/preview/route.ts` (new) — picks user's most recent project, takes the requested overrides, calls orchestrator with `chunk_index: 0` for a 30s scene-1 render, returns the audio URL; tests | 1.5 | Claude | B-003 |
| **B-005** | feat(ui): Audio Tuning settings page (`/settings/audio`) | `packages/web/app/settings/audio/page.tsx` (new server component); `packages/web/components/settings/AudioTuningPanel.tsx` (new client component with 4 sliders + preview player + lock button); `packages/web/tests/unit/components/audio-tuning-panel.test.tsx`; also extend `lib/generation/processor.ts` to read locked tuning + pass it to orchestrator | 1.5 | Claude | B-004 |

**Total: 5 PRs, 7.5 SP** — exactly matches the original estimate from the design doc.

### B.2 Concrete schema

`packages/shared/prisma/schema.prisma` addition (verbatim from the design doc):

```prisma
model AudioTuning {
  userId          String  @id @map("user_id")
  musicGainOffsetDb     Int     @default(0) @map("music_gain_offset_db")
  ambienceGainOffsetDb  Int     @default(0) @map("ambience_gain_offset_db")
  sfxGainOffsetDb       Int     @default(0) @map("sfx_gain_offset_db")
  narrationSpeed  Float   @default(1.0) @map("narration_speed")
  locked          Boolean @default(false)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz
  user            Profile @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("audio_tuning")
}
```

Add to `Profile`: `audioTuning AudioTuning?` (back-relation).

### B.3 Validation ranges (zod schema in B-002)

```typescript
import { z } from 'zod';

export const AudioTuningPatchSchema = z.object({
  musicGainOffsetDb:    z.number().int().min(-8).max(8).optional(),
  ambienceGainOffsetDb: z.number().int().min(-8).max(8).optional(),
  sfxGainOffsetDb:      z.number().int().min(-8).max(8).optional(),
  narrationSpeed:       z.number().min(0.85).max(1.20).optional(),
  locked:               z.boolean().optional(),
});
```

Ranges per the design doc; pinned safely within the orchestrator's mix headroom (target -16 LUFS, true peak -1.5 dB).

### B.4 Pipeline integration (B-003 detail)

In `packages/orchestrator/src/orchestrator/workers/tts.ts`, before the ElevenLabs call:

```typescript
const speed = audioTuning?.narrationSpeed ?? 1.0;
const voiceSettings = {
  stability: 0.6,                 // existing default
  similarity_boost: 0.8,           // existing default
  speed: speed,                    // new — was unset before
};
```

In `packages/orchestrator/src/orchestrator/workers/timeline.ts`, when emitting events:

```typescript
const musicGain    = (DEFAULT_MUSIC_GAIN_DB)    + (audioTuning?.musicGainOffsetDb ?? 0);
const ambienceGain = (DEFAULT_AMBIENCE_GAIN_DB) + (audioTuning?.ambienceGainOffsetDb ?? 0);
const sfxGain      = (DEFAULT_SFX_GAIN_DB)      + (audioTuning?.sfxGainOffsetDb ?? 0);
```

In `packages/orchestrator/src/lib/scene-cache.ts::computeSceneRenderHash`:

```typescript
const hashInput = {
  // ... existing inputs ...
  tuning: audioTuning ? {
    musicGainOffsetDb: audioTuning.musicGainOffsetDb,
    ambienceGainOffsetDb: audioTuning.ambienceGainOffsetDb,
    sfxGainOffsetDb: audioTuning.sfxGainOffsetDb,
    narrationSpeed: audioTuning.narrationSpeed,
  } : null,
};
```

That's the **critical part** — without including the tuning in the hash, Ryan locks in new values and the next generation silently returns a cached render from the old tuning. The whole feature breaks invisibly.

### B.5 UI — `/settings/audio` page (B-005 detail)

Three components:

1. `app/settings/audio/page.tsx` — server component, loads the user's current `AudioTuning` row (or null), passes to client component
2. `components/settings/AudioTuningPanel.tsx` — the client component below
3. `components/settings/SliderRow.tsx` — reusable row for a single slider with label + absolute-value display + offset display

The four-slider panel:

```tsx
<AudioTuningPanel initial={tuning}>
  <SliderRow
    label="Narration speed"
    minLabel="Slower (0.85)"
    maxLabel="Faster (1.20)"
    min={0.85} max={1.20} step={0.05}
    value={narrationSpeed}
    onChange={setNarrationSpeed}
    formatValue={(v) => `${v.toFixed(2)}x`}
  />
  <SliderRow
    label="Background music volume"
    minLabel="Quieter (-8 dB)"
    maxLabel="Louder (+8 dB)"
    min={-8} max={8} step={1}
    value={musicGainOffset}
    onChange={setMusicGainOffset}
    formatValue={(v) => `${v >= 0 ? '+' : ''}${v} dB (default -12 dB → ${-12 + v})`}
  />
  {/* ...ambience, SFX rows... */}

  <div className="flex gap-2">
    <Button variant="outline" onClick={reset}>Reset to defaults</Button>
    <Button onClick={generatePreview} disabled={previewing}>
      {previewing ? 'Generating…' : 'Generate test sample (30s)'}
    </Button>
  </div>

  {previewUrl && <AudioPreview url={previewUrl} />}

  <ConfirmDialog
    open={lockConfirmOpen}
    title="Lock these settings?"
    description="Every future generation on your account will use these values. You can unlock and adjust at any time."
    confirmLabel="Lock settings"
    variant="default"
    onConfirm={lock}
    onCancel={() => setLockConfirmOpen(false)}
  />
</AudioTuningPanel>
```

Uses the `<ConfirmDialog>` already shipped in PR #290. Uses the existing `<Slider>` from Radix.

### B.6 Processor integration (the final step in B-005)

`packages/web/lib/generation/processor.ts` change is small — before calling the orchestrator:

```typescript
const tuning = await prisma.audioTuning.findUnique({
  where: { userId },
});
const audioTuning = tuning?.locked ? {
  musicGainOffsetDb: tuning.musicGainOffsetDb,
  ambienceGainOffsetDb: tuning.ambienceGainOffsetDb,
  sfxGainOffsetDb: tuning.sfxGainOffsetDb,
  narrationSpeed: tuning.narrationSpeed,
} : undefined;

// ...later when calling orchestrator:
const response = await orchestratorGenerate('/orchestrate', {
  ...,
  audio_tuning: audioTuning,  // new
});
```

If `locked = false`, `audioTuning` is undefined and the orchestrator uses defaults. Zero risk of an unlocked Ryan-mid-tuning state silently affecting production cohort generations.

### B.7 Verification (post-B-005 merge)

Manual smoke test:
1. Visit `/settings/audio` as Ryan
2. Move "Background music volume" to +3 dB
3. Click "Generate test sample" → wait ~60s → audio plays
4. Confirm subjectively that music is louder
5. Adjust other sliders, generate another sample
6. Click "Lock these settings" → confirm dialog → confirms
7. Go back to a normal project → click Generate Now
8. After generation completes, listen and confirm the locked values are applied
9. Return to `/settings/audio` → values still loaded; unlock works

Automated:
- B-002: unit tests pin the PATCH route's zod validation (out-of-range rejected with 400)
- B-003: orchestrator tests pin that gain offsets propagate through to mix events; scene-cache hash changes when tuning changes
- B-004: route test pins that the preview returns a single audio URL within 60s
- B-005: component test pins that the lock button POSTs `{ locked: true }` to the PATCH route

### B.8 Open question to confirm with Ryan before shipping

The sliders persist **per-user**, not per-project. So locking values affects every future generation, not just one. This matches the design doc's stated intent ("once the settings are as he wants them"). If Ryan needs **per-project** tuning later (different vibe for different scripts), that's a v2 — add `projectId String?` to `AudioTuning` and the UI gains a project selector. Not blocking v1.

---

## Sequencing

### Sprint 1 (next 1–2 sessions, ~10 SP)

The "make testing easier" sprint. Land these before Ryan does another batch.

- A-001 (readiness 60s)
- A-002 (jobId in toast)
- B-001 (AudioTuning model + migration)
- B-002 (settings API)
- A-009 (favicon — easy filler)

### Sprint 2 (~10 SP)

The "quality + reliability" sprint.

- A-003 (partial-audio fallback)
- A-005 (character-only-dialogue)
- A-006 (invite flow regression)
- A-007 (re-invite on deactivated email)
- B-003 (pipeline + cache integration)

### Sprint 3 (~8 SP)

The "ship sliders + close out" sprint.

- B-004 (preview route)
- B-005 (UI page + processor integration)
- A-008 (invite default tier)
- A-010 / A-011 (console noise filtering)

### Sprint 4 (post-sliders verification, ~2 SP)

- Verify with Ryan that the sliders meet his expectations
- Tune the default ranges if needed
- A-004 (Sentry breadcrumbs around chunks — based on what Ryan saw in Sprints 1-3 about which errors recur)

---

## Risk + rollback

Each PR is independently revertable. Specific notes:

- **A-001** changes a timing constant. Risk: increased orchestrator-down resilience but slower error reporting when orch is truly dead. Rollback: revert the constant.
- **A-006 / A-007** touch the invite flow. Risk: regression. Rollback: revert; the email send path is idempotent so worst case a duplicate email goes out.
- **B-003** changes the cache hash. Risk: existing `scene_renders` cache entries become stale and every project re-renders once. Cost: ~$0.04/min × N pending projects (≈$5 worst case for the friendly cohort). Acceptable.
- **B-005** is purely additive — no existing surface changes behavior when no tuning row exists.

---

## Tracking

This doc is the canonical build plan. Each PR's commit body should reference the ID from the tables above (e.g., `feat(invite): A-006 preserve account-setup flow…`). When all 17 PRs ship, replace this doc with a single-page status link.
