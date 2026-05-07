# Delta Review — 2026-05-07

Comparison against `code-review/2026-05-06/` — every item classified.

---

## Prior TODO Items

### From `code-review/2026-05-06/TODO_2026-05-06.md`

| ID | Item | Status | Evidence |
|----|------|--------|----------|
| UX-001 | AdvancedAnalysis upgrade copy | RESOLVED | PR #45 — Sprint B |
| UX-002 | Admin collapsible sections | RESOLVED | Sprint A commit |
| UX-003 | SuccessBanner session-state | RESOLVED | Sprint A commit |
| UX-004 | RewriteModal style persistence | RESOLVED | PR #45 |
| UX-005 | FeedbackModal auto-close | RESOLVED | PR #45 |
| UX-006 | Exchange toast | RESOLVED | PR #45 |
| UX-007 | Share modal "View all" > 5 | CARRYOVER | POST-03 in ROADMAP-2026-05-07-final.md |
| BK-001 | Stripe webhook idempotency | RESOLVED | PR #45 |
| BK-002 | Corpus ingestion on Render | CARRYOVER | POST-02 in ROADMAP — blocked on Ryan's AI keys |
| BK-003 | plans-dashboard live pricing | RESOLVED | PR #57 |
| BK-004 | PostgreSQL composite indexes | RESOLVED | PR #45 |
| DNS-1 | DNS CNAME (Ryan) | CARRYOVER | External blocker, Ryan owns |
| STRIPE-1 | Stripe production keys (Ryan) | CARRYOVER | External blocker |
| TOTP-1 | Clerk TOTP (Ryan) | CARRYOVER | External blocker |

**Summary:** 9 RESOLVED, 5 CARRYOVER (3 are Ryan-owned external blockers)

---

## New Findings This Session

All items below are **[NEW]** — not in prior review.

### Code Quality
- [NEW] `generate/route.ts:112` — `(project as any).directorJson?.scenes` → **FIXED this session**

### UX
- [NEW] `VoiceCloneUploader.tsx:67` — error not cleared on success → **FIXED this session**
- [NEW] `CommentsSidebar.tsx:46` — silent fetch failure → **FIXED this session**
- [NEW] `CommentsSidebar.tsx:82` — delete no confirmation (P1) → Deferred to sprint
- [NEW] `audio-chooser.tsx:300+` — 90+ clickable elements, cognitive overload (P0) → Deferred to sprint
- [NEW] `VoiceCloneUploader.tsx:142` — loading button no visual indicator (P1) → Deferred
- [NEW] `ServiceWorkerRegistration.tsx:10` — SW failure not tracked (P1) → Deferred
- [NEW] `audio-chooser.tsx:259` — modal not mobile-friendly (P2) → Deferred

### Data Integrity
- [NEW] `schema.prisma` — HumanReview missing FK on jobId + userId (CRITICAL) → Sprint
- [NEW] `stripe/webhook/route.ts:58-77` — credit purchase non-idempotent (CRITICAL) → Sprint
- [NEW] `schema.prisma` — WebhookEndpoint no delivery log (CRITICAL) → Sprint
- [NEW] `0018_project_comments/migration.sql` — ProjectComment missing FK (CRITICAL) → Sprint
- [NEW] `schema.prisma` — PodcastFeed no userId ownership index (HIGH) → Sprint
- [NEW] `schema.prisma` — CreditTransaction.jobId not indexed (HIGH) → Sprint
- [NEW] `schema.prisma` — ApiKey.keyHash redundant index (MEDIUM) → Cleanup
- [NEW] `schema.prisma` — VoiceClone missing unique on elevenLabsVoiceId (MEDIUM) → Sprint
- [NEW] `schema.prisma` — ProjectComment missing scene/timestamp indexes (MEDIUM) → Sprint

### Tests Added
- [NEW] `tests/unit/lib/comments-notify.test.ts` — 6 tests → **WRITTEN this session**
- [NEW] `tests/unit/lib/human-review-trigger.test.ts` — 8 tests → **WRITTEN this session**
- [NEW] `tests/unit/api/webhook-endpoints.test.ts` — 9 tests → **WRITTEN this session**
