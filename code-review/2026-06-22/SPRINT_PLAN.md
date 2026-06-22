# Sprint Plan — 2026-06-22

Unified plan combining all three review parts. Sorted by priority + dependency.

## Sprint Now (engineering hand-off)

Nothing blocking. Open PRs Peter has yet to merge:

| PR | Title | Risk | Owner |
|---|---|---|---|
| #357 | tuning +3 dB volumes + narrator 1.1 | low | Peter to merge |
| #361 | progressive playback FIRST_CHUNK_SCENES=2 | low | Peter to merge |
| #337 | ElevenLabs progressive shape fallback | conflict | Peter to rebase + decide whether still needed post-#338 |

## Sprint A (post-GTM polish — 2 SP)

All UX polish carryovers from 2026-06-16 that didn't block launch.

| ID | SP | Title | File | P |
|---|----|-------|------|---|
| UX-I-02 | 0.5 | Slider aria-label | `components/audio-tuning/Slider.tsx` | P2 |
| UX-I-03 | 0.5 | Reset preserves Lock | `AudioTuningPanel.tsx` | P2 |
| UX-I-04 | 0.5 | `<source key>` on preview | `preview-button.tsx` | P2 |
| UX-I-05 | 0.5 | Install-prompt dismiss TTL | `components/install-prompt.tsx` | P2 |

## Sprint B (data tier — 1 MEDIUM + 2 LOW from agent audit)

| ID | Sev | Title | Fix |
|---|---|---|---|
| DT-30-M-2 | MEDIUM | Seed profile missing subscription row | Add `subscription` insert next to `profile` insert in seed migration |
| DT-33-L-2 | LOW | Partial unique index not in Prisma schema | Document: "use migrations not db push" |
| DT-34-L-1 | LOW | Potential N+1 in team-comments route | Revisit if perf complaint; pagination already gates |

## Launch gate (Chris, non-engineering — ~3h total)

| Item | Owner | Time | Status |
|---|---|---|---|
| Stripe live walkthrough | Chris | ~1h | TODO |
| UAT click-through | Chris | ~2h | TODO |
| `pnpm audit` rerun before main GTM | Chris | ~5 min | TODO |
| Send EOD recap to Ryan with retest URL + cleared cache notice | Chris | ~10 min | DONE (overnight) |

## Outside the sprint window

| Item | Reason |
|---|---|
| T-01 voice-ID placeholder | BLOCKED on Ryan picking canonical voice IDs from 137-voice catalog |
| #337 ElevenLabs shape fallback merge | Peter decision — was largely superseded by #338 pre-flight + #343 422 surfacing |

## Capacity summary

- **Sprint Now**: 0 SP for Chris (Peter merges, Chris monitors)
- **Sprint A**: 2 SP (all UX polish, post-GTM)
- **Sprint B**: 1 SP (seed-row fix) + 0 SP (doc-only)
- **Launch gate**: ~3h non-engineering

Total engineering work to GTM: **2 SP** (Sprint A polish, can ship post-launch with no blocker).
