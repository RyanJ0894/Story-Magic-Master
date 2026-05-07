# Sprint Plan — 2026-05-06

## Sprint A — UX Polish for Advanced Analysis + Admin (~9 SP, ~3–4 days)

| ID | SP | Title | File:Line | Priority |
|----|----|-------|-----------|----------|
| UX-001 | 2 | [P0] Advanced Analysis: concrete Opus benefits copy | `AdvancedAnalysisUpgrade.tsx:86` | Revenue |
| UX-002 | 2 | [P0] Admin settings: collapsible sections | `admin-settings-client.tsx:80` | Admin UX |
| UX-003 | 2 | [P0] AdvancedAnalysisSuccessBanner: session state not URL param | `AdvancedAnalysisSuccessBanner.tsx:22` | UX |
| UX-004 | 1 | [P1] RewriteModal: persist style preference in localStorage | `RewriteModal.tsx:89` | UX |
| UX-005 | 1 | [P1] FeedbackModal: remove auto-close timeout | `FeedbackModal.tsx:145` | Accessibility |
| UX-006 | 1 | [P2] Exchange listing form: success toast | `exchange-listing-form.tsx:56` | Polish |

## Sprint B — Share Modal Refactor (~5 SP, ~1 week)

| ID | SP | Title | File:Line | Priority |
|----|----|-------|-----------|----------|
| UX-007 | 3 | [P0] Share modal: consolidate 3 tabs → 1 progressive flow | `share-modal.tsx:138` | UX |
| UX-008 | 2 | [P1] Share modal: "View all" link for shares > 5 | `share-modal.tsx:297` | UX |

## Post-Launch Backlog

| ID | SP | Title | Notes |
|----|----|----|-------|
| BK-001 | 1 | Enable Story Adviser FF | `NEXT_PUBLIC_FF_STORY_ADVISER=true` in Doppler prd + sync |
| BK-002 | 3 | StoryScore corpus ingestion | `pnpm ingest:training && pnpm score:corpus` |
| BK-003 | — | Stripe account migration | Ryan action — needs own Stripe account |
| BK-004 | 2 | Purchase seed data | `packages/web/prisma/seed.ts` — add `advanced_analysis` test fixture |

## Ryan Action Items (Blocking Launch)
- [ ] DNS: CNAME `app` → `story-magic-web.onrender.com` (emailed 2026-04-26)
- [ ] Stripe: Create own Stripe account; send `sk_live_*`, `pk_live_*`, `whsec_*`
- [ ] Clerk TOTP: Dashboard → Configure → MFA → enable Authenticator app
