# Delta Review — 2026-06-02

Prior review: `code-review/2026-05-29/`

## Prior TODO Status

| ID | Status | Evidence |
|----|--------|---------|
| TEST-01 teams-service.test.ts | ✅ RESOLVED | Added in prior session |
| TEST-02 scoring-service.test.ts | ✅ RESOLVED | Added in prior session |
| TEST-03 orchestrator/env.test.ts | ✅ RESOLVED | Added in prior session |
| CARRYOVER-2 Remove dead `writerCode?` prop | ✅ RESOLVED | commit `6f58446` review session |
| **UX-E-01** Gate dev log panel behind `NODE_ENV !== 'production'` | ✅ RESOLVED | `generate-button.tsx:404` already has the guard |
| **DT-29-NEW-1** Subscription `@@index([userId])` + `@@index([userId, status])` | ✅ RESOLVED | Migration `0029_subscription_user_indexes` |
| **UX-E-05** Invite sign-up CTA for signed-out users | ✅ RESOLVED | PR #126 — proactive sign-up branch merged via PR #88 |
| **UX-E-06** Scroll containers on team settings member + pending lists | ✅ RESOLVED | `(gated)/team/page.tsx` has `max-h-[360px]` + `max-h-[280px]` |
| DEBT-02 / UX-E-07 Remove `[Audio]`/`[Invite]` console.logs | ✅ RESOLVED | invite page console.logs removed |
| **DT-29-NEW-2** Purchase `onDelete: SetNull`, `userId?` nullable | ⏳ CARRYOVER | Schema still has `onDelete` default (Restrict); `userId` still non-null |
| **PLAY-TOCTOU** Atomic `$executeRaw` on play route | ⏳ CARRYOVER | Non-atomic read-check-increment still at `play/route.ts:60-71` |
| **UX-E-02** Hide enterprise upsell for `studio` tier | ⏳ CARRYOVER | Not yet fixed |
| **UX-E-03** Wizard: remove `.slice(0,5)`, raise `max-h` | ⏳ CARRYOVER | Not yet fixed |
| **UX-E-04** Financial `toLocaleString()` → explicit locale | ⏳ PARTIAL | `admin/page.tsx` + `admin/analytics/page.tsx` fixed; `impact/partners/page.tsx:252` + `admin/users/page.tsx:206` remain |
| **UX-E-08** Enterprise dashboard scroll containers | ⏳ CARRYOVER | `(gated)/dashboard/page.tsx` activity + team list still unbounded (now UX-F-03) |
| **UX-E-09** Audio-chooser touch targets `h-8` → `h-10` | ⏳ CARRYOVER | Not yet fixed |
| **UX-E-10** Upload drop zone `onClick` + `tabIndex` | ⏳ CARRYOVER | Not yet fixed |
| **UX-E-11** Share modal bulk tab mobile flex layout | ⏳ CARRYOVER | Not yet fixed |
| **DT-29-2/3** ScriptShare FK `onDelete: SetNull` | ⏳ CARRYOVER | `sharedByUser` still Restrict default |
| **STALE-01** Fix `share-modal.test.tsx` (7 failures) | ⏳ CARRYOVER | 7 failures confirmed |
| **STALE-02** Fix `login-form.test.tsx` (4 failures) | ⏳ CARRYOVER | 4 failures confirmed |
| **DT-29-1** Corpus export `take: 500` limit | ⏳ CARRYOVER | Not yet fixed |
| **CONTENT-LOG-RETENTION** nightly cleanup job | ⏳ CARRYOVER | Not yet implemented |

## New Findings This Session

| ID | Type | Severity | Description |
|----|------|---------|-------------|
| TS-NEW-01 | TypeScript | P2 | 6 stale `.next/types/` errors from enterprise page route-group move |
| UX-F-01 | UX | P1 | "Compare Scripts" button has no `onClick` — silently does nothing |
| UX-F-02 | UX | P1 | +/− icon buttons in `EnterpriseProjectAssignment` are 28px (below 44px touch min) |
| UX-F-03 | UX | P1 | Enterprise dashboard activity feed + team list unbounded (no scroll container) |
| UX-F-04 | UX | P2 | `TeamNotesTab` 20 comments with "Load More" off-screen |
| UX-F-05 | UX | P2 | Bare `.toLocaleString()` on `admin/users/page.tsx:206` + `impact/partners/page.tsx:252` |

## Commits in This Delta (since 2026-05-29)

- `16d7ab7` fix(hydration): defer localStorage reads to useEffect in project-workflow
- `4f6dad4` fix(sw): exclude JS chunks from cache-first to prevent stale server action IDs
- `4a9c32e` fix(shared): ESM wrapper for CJS Prisma client — fix orchestrator 502
- `702d244` fix(security): scope project page query to authenticated userId — IDOR fix
- `61c7eef` fix(ui): logo duplicate, ElevenLabs grant badge, unshare button
- `031143e` fix(ui): rename Pass→Dislike across reader experience
- `eb04e7f` feat(sprint-p): master/sub-account wiring — member types + activity feed
- `d58f2ce` feat(enterprise): multi-team support + project assignment UI
- `44b59c9` feat(enterprise): multi-team support (PR #107)
- `093595a` feat(enterprise): gate /enterprise/* to Enterprise tier only
- `7c55bb8` fix(reader-upload): remove dead payment-bypass fallback
- `3446fdf` fix(enterprise+invite): team create crash, invite sign-up URL, FOUC
