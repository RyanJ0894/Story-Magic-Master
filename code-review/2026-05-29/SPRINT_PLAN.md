# Sprint Plan — 2026-05-29

Unified across Code-Review V3 + UX + Data-Tiers. Sorted by priority.
All changes via PR (main is branch-protected — 1 codeowner approval + 3 CI checks).

---

## Sprint 1 — Correctness + Compliance (do first)

| ID | Pri | SP | Title | File |
|----|-----|----|-------|------|
| UX-E-01 | P0 | 1 | Gate dev log panel behind `NODE_ENV !== 'production'` | `app/projects/[id]/generate-button.tsx:409` |
| DT-29-NEW-1 | HIGH | 1 | `Subscription` missing `@@index([userId])` + `@@index([userId, status])` — every entitlement check is a full table scan | `packages/web/prisma/schema.prisma` |
| DT-29-NEW-2 | HIGH | 2 | `Purchase.user` → `onDelete: SetNull`, make `userId?` nullable — FK violation blocks GDPR erasure | `packages/web/prisma/schema.prisma` + migration |
| PLAY-TOCTOU | HIGH | 3 | Atomic `$executeRaw` UPDATE with WHERE guard on play route — prevents maxPlays overshoot under concurrent requests | `app/api/shares/access/[code]/play/route.ts:40–73` |

**Sprint 1 total: 7 SP**

---

## Sprint 2 — Robustness + UX Polish

| ID | Pri | SP | Title | File |
|----|-----|----|-------|------|
| UX-E-02 | P1 | 1 | Hide enterprise upsell banner for `studio` tier — unconditional render on all tiers | `app/dashboard/dashboard-tabs.tsx:260` |
| UX-E-03 | P1 | 1 | Wizard: remove `.slice(0,5)`, raise `max-h` to 400 px — 5 suggestions silently discarded | `components/wizard/ScriptImprovementWizard.tsx:287-288` |
| UX-E-04 | P1 | 1 | Financial `toLocaleString()` → explicit `en-US` + currency options | `app/admin/page.tsx:102`, `app/admin/analytics/page.tsx:124`, `app/impact/partners/page.tsx:86,252` |
| DT-29-2/3 | MED | 2 | `ScriptShare` FK cascades — `sharedByUser` + `sharedWithUser` → `onDelete: SetNull` | `packages/web/prisma/schema.prisma` |
| STALE-01 | P2 | 1 | Fix `share-modal.test.tsx` — 7 failures from QR tab removal | `tests/component/share-modal.test.tsx` |
| STALE-02 | P2 | 1 | Fix `login-form.test.tsx` — 4 failures from login page refactor | `tests/component/login-form.test.tsx` |
| UX-E-05 | P2 | 1 | Invite page: show sign-up CTA for signed-out users | `app/invite/[token]/page.tsx:278` |
| UX-E-06 | P2 | 1 | Scroll containers on team settings member + pending lists | `app/enterprise/team/page.tsx:251,290` |

**Sprint 2 total: 9 SP**

---

## Sprint 3 — Cleanup + Polish (after Ryan confirms stability)

| ID | Pri | SP | Title | File |
|----|-----|----|-------|------|
| DEBT-02 | P2 | 1 | Remove `[Audio]`/`[Invite]` diagnostic console.logs | `app/invite/[token]/page.tsx:92,101` |
| UX-E-07 | P2 | 0.5 | Remove invite-accept console.logs (pairs with DEBT-02) | `app/invite/[token]/page.tsx:92,101` |
| UX-E-08 | P2 | 1 | Enterprise dashboard: scroll containers on activity feed + team list | `app/enterprise/dashboard/page.tsx:257,303` |
| UX-E-09 | P2 | 1 | Audio-chooser: bump `h-8` icon buttons to `h-10` for touch targets | `app/projects/[id]/audio-chooser.tsx:270,285,297` |
| UX-E-10 | P2 | 1 | Upload drop zone: add `onClick` + `tabIndex` for keyboard/touch activation | `components/reader/upload-client.tsx:288` |
| UX-E-11 | P2 | 1 | Share modal bulk tab: `flex-col` row on mobile to prevent clipping | `components/dashboard/share-modal.tsx:338` |
| DT-29-1 | MED | 1 | Corpus export: add `take: 500` limit to unbounded `findMany` | `app/api/admin/corpus/export/route.ts:16` |
| CONTENT-LOG-RETENTION | HIGH | 2 | Add nightly `content_access_log` cleanup job (90-day retention) | `render.yaml` + `packages/web/scripts/` |

**Sprint 3 total: 8.5 SP**

---

## Backlog (Low priority / External)

| ID | SP | Title | Owner |
|----|-----|-------|-------|
| DT-27-2 | 1 | Transaction around invite-accept TOCTOU (LOW — rate-limited + idempotent) | Chris |
| DT-27-3 | — | `removeMember` leaves userId on removed rows (moot after DATA-01 fix) | No action |
| DT-27-4 | 1 | `ensureProfile` email backfill gate (only when in-app email edit lands) | Chris |
| DT-27-5 | 1 | Migration 0027 full index → partial (`share_id IS NOT NULL`) | Chris |
| DT-29-4 | 2 | `ImpactStory.viewCount` per-IP dedup (pre-launch) | Chris |
| DT-29-5 | 2 | CI check for orchestrator ↔ web schema drift on mirrored tables | Chris |
| POST-02 | — | Corpus ingestion at `/admin/corpus` | Ryan |
| DEBT-01 | — | Female-teen voice IDs for `hybrid-voice-search.ts` | Ryan |

---

## Already Done This Session

- ✅ TEST-01 `teams-service.test.ts` (+21 tests)
- ✅ TEST-02 `scoring-service.test.ts` (+20 tests)
- ✅ TEST-03 `orchestrator/env.test.ts` (+17 tests)
- ✅ CARRYOVER-2 Dead `writerCode?` prop removed (`share-modal.tsx` + `writer-dashboard-client.tsx`)
