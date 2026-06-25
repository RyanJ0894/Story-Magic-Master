# Delta Review — 2026-06-25

Walks every item from `code-review/2026-06-22/TODO_2026-06-22.md`. Status: RESOLVED / CARRYOVER / SUPERSEDED.

## Sprint Now (06-22 row)

| Item | Status | Evidence |
|------|--------|----------|
| PR #357 — tuning +3 dB volumes + narrator 1.1 | RESOLVED | merged before 06-22 → 06-25 window opened |
| PR #361 — progressive playback FIRST_CHUNK_SCENES=2 | RESOLVED | `FIRST_CHUNK_SCENES=2` referenced in processor-chunking tests; merged |
| PR #337 — ElevenLabs progressive shape fallback | UNKNOWN | not in commit history since 06-22 — may have been admin-merged or superseded by Peter's #336; mark **CARRYOVER**, verify next cycle |

## Sprint A — post-GTM polish (06-22 row)

| Item | Status | Evidence |
|------|--------|----------|
| UX-I-02 — Slider thumb aria-label | **RESOLVED** | `AudioTuningPanel.tsx:409` forwards aria-label with full context |
| UX-I-03 — Reset preserves Lock | **RESOLVED** | `AudioTuningPanel.tsx:96–113` calls `PATCH { locked: false }` first |
| UX-I-04 — `<source key>` on audio preview | **RESOLVED** | `AudioTuningPanel.tsx:324` uses `<source key={previewUrl}>` |
| UX-I-05 — Install-prompt dismiss TTL | **CARRYOVER** | no changes detected |

## Sprint B — data tier (06-22 row)

| Item | Status | Evidence |
|------|--------|----------|
| DT-30-M-2 — Subscription row in seed | **RESOLVED** | `seed.ts:33–44` creates both Profile + Subscription |
| DT-33-L-2 — Doc note: `prisma db push` vs migrations | **CARRYOVER** | no `docs/` addition detected |
| DT-34-L-1 — Revisit team-comments pagination | **CARRYOVER** | no team-comments perf complaints filed |

## Launch gate (06-22 row)

| Item | Status |
|------|--------|
| Stripe live walkthrough | **CARRYOVER** (Chris) |
| UAT click-through | **CARRYOVER** (Chris) |
| `pnpm audit` rerun before GTM | **CARRYOVER** (Chris) |
| T-01 — voice-ID placeholder | **CARRYOVER** — BLOCKED on Ryan, still present at `hybrid-voice-search.ts:38` |

## Verification gates (06-22 row)

| Item | Status |
|------|--------|
| Ryan retests ANSWERS-5-Page-Sample on dev | **CARRYOVER** — superseded by RYAN_HANDOFF_2026-06-25 (4 tasks including the 77-page script + cache validation) |
| Inoculation-suite blocks remain (`describe.skip` count == 0) | **VERIFIED** — full test suite 2710/2710 with no skips |
| `/api/health` returns `status: healthy` for all 6 checks | **CARRYOVER** — no on-demand check this cycle |

## New items added this cycle (resolved inline)

| New | Status | Closed by |
|-----|--------|-----------|
| UX-D-01 — Date locale in run-selector | **FIXED THIS SESSION** | inline edit |
| UX-D-02 — Progress-bar color token | **DEFERRED** | 0.5 SP, P2 backlog |
| DT-35-H-1 — CreditTransaction.jobId FK | **FIXED THIS SESSION** | migration 0045 |
| DT-36-M-1 — ContentAccessLog onDelete | **FIXED THIS SESSION** | migration 0045 |

## Net movement

- **6 items resolved** (4 prior carryovers + 2 newly identified and fixed inline)
- **2 items added to TODO** (UX-D-02 + UX-I-05 stays)
- **6 carryovers preserved** (Chris launch tasks + 3 low data-tier + #337 unknown)
