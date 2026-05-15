> **Superseded by:** [ROADMAP-2026-05-15.md](ROADMAP-2026-05-15.md) — Updated 2026-05-15

# Story Magic — Product Roadmap

**Date:** 2026-05-07 (final — post-merge)
**Author:** Chris Therriault (chris@servicevision.net)
**Version:** v2.0.0-beta
**Status:** All sprint D–G PRs MERGED to main. Feature-complete for v2.0.0-beta.
**Supersedes:** `docs/ROADMAP-2026-05-07.md` (r2 — pre-merge), `docs/ROADMAP-2026-05-06.md`

> **Current state:** 1,543 tests passing. 0 TypeScript errors. 14 PRs merged overnight.
> v2.0.0-beta feature set complete on `main`. Four Ryan launch actions remain.

---

## Document Reconciliation

| Document | Status |
|----------|--------|
| `docs/ROADMAP-2026-05-07.md` (r2, pre-merge) | Superseded — PRs are now merged |
| `docs/ROADMAP-2026-05-06.md` | Archived |
| `code-review/2026-05-06/TODO_2026-05-06.md` | Sprint A complete; Sprint B+C+D–G complete |

---

## Platform Health Scorecard

| Area | Score | Notes |
|------|-------|-------|
| TypeScript | 10/10 | 0 errors, both packages (verified post-merge) |
| Security / RLS | 9/10 | Webhook idempotency fixed; HMAC signing on all webhooks |
| Test Coverage | 9/10 | 1,543 tests (1,012 web + 531 orchestrator) |
| UX / Information Design | 9/10 | Sprint A–C P0/P1 UX issues all resolved |
| Code Quality | 10/10 | 0 console.log in prod paths, 0 `any` in app code |
| Data Integrity | 9/10 | Composite index (0011); webhook idempotency key |
| Feature Completeness | 10/10 | All sprint D–G competitive features on main |
| Deployment | 8/10 | Live on Render; DNS (Ryan) is last platform blocker |
| **Overall** | **A** | v2.0.0-beta feature-complete |

---

## What's Shipped ✅

### v2.0.0-beta — Sprint D–G (May 6–7, 2026) — ~90 SP

- [x] **Fountain/FDX native import** — spec-compliant parsers; upload UI extended | PR #39
- [x] **Scene-level sharing** — `sceneIndex` + `sceneStartMs`; "Share this scene" button; listen page seek | PR #39
- [x] **Director Notes UI** — panel, API, prompt injection Pass 1, auto-save | PR #58
- [x] **Credit system** — `CreditTransaction` ledger, credit purchase ($9.99/20), deduction on generation, 3 signup bonus | PR #41
- [x] **Podcast RSS distribution** — `PodcastFeed` model, publish API, RSS 2.0 endpoint, public page, Apple Podcasts deep link | PR #42
- [x] **Emotion cue overrides** — `emotionOverrides` JSON, per-dialogue emotion Select, "Re-render scene" | PR #43
- [x] **Enterprise direct access** — no password gate for enterprise plan | PR #44
- [x] **Sprint B UX polish** — RewriteModal style persistence, FeedbackModal no auto-close, exchange toast, Purchase seeds | PR #45
- [x] **Sprint C tech debt** — `DELETE /api/projects/[id]`, Story Adviser flag enabled | PR #46
- [x] **Mobile PWA** — manifest, service worker, iOS install hint | PR #52
- [x] **Voice cloning** — `VoiceClone` model, upload API, `VoiceCloneUploader`, in assignment dropdown | PR #52
- [x] **Audio preview hint** — 15s contextual preview on completion; install CTA | PR #52
- [x] **Public REST API** — `ApiKey` model + creation/revoke, `/api/v1/generate`, `/api/v1/jobs/[id]` | PR #53
- [x] **Webhooks** — `WebhookEndpoint` model, HMAC signing, retry queue, `job.completed` + `job.failed` events | PR #53
- [x] **Human-in-loop review** — `HumanReview` model, admin queue, review decision API, transactional emails | PR #54
- [x] **Team comments** — `ProjectComment` model, comments API, `CommentsSidebar`, owner email notification | PR #55
- [x] **Pipeline silent failure fix** — throws on missing episode file (closes Issue #15) | PR #56
- [x] **Plans page live pricing** — single source of truth from `PRICING_TIERS` | PR #57

### v1.1.0 — Sprint A–C (May 5–6, 2026)

- [x] Sprint A P0 UX polish: AdvancedAnalysis copy, Admin collapsible, SuccessBanner session-state
- [x] Idempotency fix + PostgreSQL indexes (code review action items)
- [x] +16 tests added (1,370 → 1,543 total across both sessions)

### v1.0.0-beta — Phases 0–7 (Feb–May 2026)

- [x] Next.js 15 App Router + Clerk + Prisma + Tailwind + Radix
- [x] Director 3-pass LLM pipeline + long-script chunking (90-120 page)
- [x] Orchestrator (TTS + FFmpeg -16 LUFS M4A export)
- [x] StoryScore (Claude Sonnet 4.6) + corpus (57 screenplays)
- [x] Comparable scripts (pgvector), Stem export, Audio quality validation
- [x] Stripe Checkout + Portal + idempotent webhook
- [x] Free / Pro / Enterprise plan tiers + feature gates
- [x] Advanced Analysis add-on ($9.99/project, Claude Opus 4.6)
- [x] Story Adviser 4-step wizard (enabled via Sprint C)
- [x] Exchange marketplace + Writer Hub + Reader library
- [x] ElevenLabs turbo v2.5 + PCM + concurrency
- [x] Doppler secrets management (44 secrets)
- [x] SOC 2 prep — audit logging, AES-256-GCM field encryption

---

## Remaining Backlog

### Ryan Launch Actions (Engineering: DONE — waiting on owner)

| Action | Owner | Blocker | Impact |
|--------|-------|---------|--------|
| DNS — GoDaddy CNAME `app.storymagicapp.net` → Render | Ryan | App on Render URL only | P0 |
| Stripe — create production account, add keys to Doppler prd | Ryan | Revenue goes to wrong account | P0 |
| Stripe — add `checkout.session.completed` to webhook events | Ryan | Subscriptions don't activate | P0 |
| Clerk — enable TOTP for admin org in Clerk dashboard | Ryan | Admin unprotected by MFA | P1 |

### Engineering Backlog (~14 SP remaining)

| ID | SP | Task | Notes |
|----|----|------|-------|
| POST-01 | 8 | PR #27 rebase — Enterprise Master Account (`feat/enterprise-master-account`) | Branch conflicts; needs `git rebase --onto origin/main` |
| POST-02 | 2 | Corpus ingestion on Render | Verify OPENAI + ANTHROPIC keys; run `pnpm ingest:training && pnpm score:corpus` |
| POST-03 | 2 | Share modal "View all" > 5 shares | Paginate/expand active shares list (UX-008) |
| POST-04 | 2 | BILL-5.14 Purchase seed fixtures | Already done in Sprint B; cross-check in staging |

### External Blockers

| Blocker | Owner | Impact | Status |
|---------|-------|--------|--------|
| DNS CNAME update | Ryan | App unreachable on custom domain | Waiting |
| Stripe production account | Ryan | Revenue isolation | Waiting |
| Stripe webhook event list | Ryan | Subscriptions silent | Waiting |
| Clerk TOTP enforcement | Ryan | Admin security | Waiting |
| AI keys on Render (corpus) | Ryan | Comparables degraded | Waiting |

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v1.0.0-beta | 2026-05-06 | MVP complete — 642 → 1,370 tests; Phases 0-7 |
| v1.1.0 | 2026-05-06 | Sprint A–C — code review remediation + UX polish |
| **v2.0.0-beta** | **2026-05-07** | **Sprint D–G merged — 14 PRs, ~90 SP, 1,543 tests** |
| **v2.0.0** | **TBD** | **Production launch (pending 4 Ryan actions)** |

---

## Sprint Execution Status

```
✅ Phases 0–7    → MVP on main (Feb–May 2026)
✅ Sprint A      → Code review + UX P0 (2026-05-06)
✅ Sprint B      → UX polish + seeds (PR #45)
✅ Sprint C      → DELETE verb + Story Adviser flag (PR #46)
✅ Sprint D      → Fountain/FDX + Director Notes + Credits + Podcast + Scene Sharing (PRs #39, #58, #41, #42)
✅ Sprint E      → Emotion overrides + Enterprise access (PRs #43, #44)
✅ Sprint F      → PWA + Voice Cloning + Public API + Webhooks (PRs #52, #53)
✅ Sprint G      → Human Review + Team Comments (PRs #54, #55)
⏳ Post-launch   → PR #27 rebase + corpus ingestion + share pagination
🚀 Launch        → 4 Ryan actions (DNS + Stripe + Clerk TOTP)
```

---

## Database Schema: New Models (Sprint D–G)

| Migration | Model(s) Added | Introduced By |
|-----------|----------------|---------------|
| 0013 | `DirectorNotes` (on Project as JSON) | PR #58 |
| 0015 | `SceneShare` (on ScriptShare as JSON fields) | PR #39 |
| 0016 | `PodcastFeed` | PR #42 |
| 0017 | `VoiceClone` | PR #52 |
| 0018 | `ProjectComment` | PR #55 |
| 0019 | `ApiKey`, `WebhookEndpoint` | PR #53 |
| 0020 | `CreditTransaction` | PR #41 |
| 0021 | `HumanReview` | PR #54 |

---

## Quick Reference

| Resource | Location |
|----------|----------|
| This roadmap | `docs/ROADMAP-2026-05-07-final.md` |
| PM competitive digest | `docs/PM-DIGEST-2026-05-07.md` |
| Requirements baseline | `docs/REQUIREMENTS-2026-05-07.md` |
| UAT plan | `docs/UAT-2026-05-07.md` |
| Prior roadmap (pre-merge) | `docs/ROADMAP-2026-05-07.md` |
| Code review | `code-review/2026-05-06/` |
| Deploy runbook | `packages/web/scripts/deploy-runbook.md` |

---

*Single source of truth as of 2026-05-07. v2.0.0-beta feature-complete on main. Four Ryan launch actions unblock v2.0.0 production.*
