# Feature Completeness — 2026-05-19

## Completed This Session

| Feature | Gap Filled | Files Changed |
|---------|-----------|--------------|
| Audio URL resolution | `resolveAudioUrl()` utility applied to all 5 player locations | `lib/resolve-audio-url.ts` (new), `run-history.tsx`, `audio-player.tsx`, `run-comparison.tsx`, `screenplay-reader.tsx`, `ScriptSyncPlayer.tsx` |
| Team invite FK safety | `ensureProfile()` called before `teamMember.update` | `app/api/invite/[token]/route.ts`, `lib/ensure-profile.ts` (new) |
| Project Notes API (Sprint M) | Tests written for all 3 methods (GET/POST/DELETE) | `tests/unit/api/project-notes.test.ts` (new, 13 tests) |
| Reaction upsert atomicity | `prisma.$transaction` wrapping `deleteMany + create` | `app/api/projects/[id]/comments/route.ts` |

## Still Incomplete

| Feature | Gap | SP | Sprint |
|---------|-----|-----|--------|
| QR Code download in ShareModal | Button has no `onClick`; generates nothing | 3 | Sprint N |
| Corpus ingestion on Render | POST-02: needs Ryan AI keys for prod | 2 | External |
| ScreenplayReader touch-seek | Progress bar is mouse-only (UX-M-06) | 1 | Sprint N |
| Enterprise Notes pagination | 200 items loaded unbounded (UX-M-05) | 2 | Sprint N |
| AudioChooser cognitive load | 90+ clickable elements, no collapse (UX-M-15 carryover) | 3 | Sprint N |
| CommentsSidebar error state | Silent fetch failure, no retry (UX-M-16 carryover) | 2 | Sprint N |
| NotesPanel error state | Same pattern as CommentsSidebar (UX-M-04) | 2 | Sprint N |

## Blocked (External)

| Feature | Blocked By |
|---------|-----------|
| Corpus ingestion (POST-02) | Ryan: ANTHROPIC_API_KEY + GOOGLE_GENERATIVE_AI_API_KEY on Render |
| Migration 0025 deploy | Ryan/Chris: `prisma migrate deploy` on Render web service |

## Notes

The Sprint M feature (ScreenplayPlayer + NotesPanel + ProjectNote/Comment schema) is functionally complete. The remaining gaps are polish and mobile accessibility items identified in the UX audit, not functional gaps.
