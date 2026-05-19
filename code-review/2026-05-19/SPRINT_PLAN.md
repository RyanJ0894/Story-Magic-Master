# Sprint Plan — 2026-05-19

Unified plan from all three review parts. Ordered by priority.

---

## Immediate (Deploy Required — Not Code)

| ID | Action | Who | Notes |
|----|--------|-----|-------|
| DEPLOY-1 | Run `prisma migrate deploy` on Render (migration 0025) | Ryan/Chris | Fixes CRITICAL `project_comments.user_id` FK + 3 HIGH index issues |

---

## Sprint N: UX Polish + Mobile (This Sprint — ~14 SP)

All P0 UX issues are fixed. Sprint N focuses on P1 and critical carryovers.

| ID | SP | Title | File:Line | Priority |
|----|----|-------|-----------|---------|
| UX-M-04 | 2 | NotesPanel: add error state + retry on fetch failure | `NotesPanel.tsx:48–59` | P1 |
| UX-M-05 | 2 | Enterprise dashboard Notes tab: paginate (take:20 + load more) | `enterprise/dashboard/page.tsx:109` | P1 |
| UX-M-06 | 1 | ScreenplayReader: add touch-seek handlers to progress bar | `screenplay-reader.tsx:245–263` | P1 |
| UX-M-07 | 1 | project-workflow: confirm team name before share | `project-workflow.tsx:1069` | P1 |
| UX-M-08 | 1 | enterprise/team: confirm before removing member | `enterprise/team/page.tsx:110–124` | P1 |
| UX-M-15 | 3 | AudioChooser: collapse scenes by default (carryover from 05-07) | `audio-chooser.tsx` | P0 (carryover) |
| UX-M-16 | 2 | CommentsSidebar: add error state + retry (carryover from 05-07) | `CommentsSidebar.tsx:46` | P0 (carryover) |
| **Total** | **12 SP** | | | |

---

## Sprint N Backlog: Polish (~11 SP)

| ID | SP | Title | Priority |
|----|----|-------|---------|
| UX-M-09 | 2 | ScreenplayPlayer+NotesPanel: responsive collapse below sm | P2 |
| UX-M-10 | 1 | NotePopover: Escape key to dismiss | P2 |
| UX-M-11 | 1 | Enterprise dashboard: replace hardcoded "50+" stat with real metric | P2 |
| UX-M-12 | 1 | ScreenplayPlayer reactions: debounce + loading state | P2 |
| UX-M-13 | 1 | AdvancedAnalysisUpgrade: add per-project dismiss memory | P2 |
| UX-M-14 | 1 | ShareModal QR tab: hide or implement download | P2 |
| DT-BL-M1 | 1 | Add `@@index([jobId])` to AudioOutput | Medium |
| DT-BL-M2 | 1 | Add `@@index([userId, isRead])` to Alert | Medium |
| DT-BL-M3 | 1 | Add `@@index([projectId])` to HumanReview | Medium |
| **Total** | **10 SP** | | |

---

## External Blockers (Not Codeable)

| Item | Owner | Impact |
|------|-------|--------|
| `prisma migrate deploy` on Render | Ryan/Chris | CRITICAL FK + 3 HIGH fixes go live |
| Ryan AI keys (ANTHROPIC + GOOGLE) on Render | Ryan | Corpus ingestion + StoryScore (POST-02) |

---

## Sprint N Execution Order

```
1. Deploy migration 0025 first (DB changes, no code risk)
2. UX-M-15 + UX-M-16 (carryover P0s — highest UX risk)
3. UX-M-04 through UX-M-08 (P1 mobile + safety)
4. Backlog polish as capacity allows
```

---

## What's Well-Designed (No Action Needed)

From the UX audit:
- AudioPlayer progressive playback queue — segment stitching + buffer indicator are production-quality
- ScreenplayReader decision bar — `aria-pressed`, loading guard, optimistic rollback is a model pattern
- AdvancedAnalysisSuccessBanner — URL param stripping + auto-dismiss resolved from prior audit
- MobileNav — closes on link click without backdrop
- Enterprise dashboard tab structure — clean 5-tab hierarchy
