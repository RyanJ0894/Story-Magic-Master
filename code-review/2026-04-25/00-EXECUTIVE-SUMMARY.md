# Code Review V4 — Story Magic — 2026-04-25

| Field | Value |
|-------|-------|
| Date | 2026-04-25 |
| Prior review | 2026-04-19 |
| Repository | story-magic (monorepo) |
| Branch | main |
| Commit | 2227703 |

---

## Rating Change

| | Prior (2026-04-19) | This Review | Trend |
|-|-------------------|-------------|-------|
| **Overall** | A- | **A** | ↑ |
| Security | B+ (2 CRITICAL open) | **A+** (0 open) | ↑ |
| Test Coverage | A- (1,058 tests, 39 suites) | **A** (1,204 tests, 72 suites) | ↑ |
| Feature Completeness | 88% | **93%** | ↑ |
| TypeScript | A (0 errors) | **A** (0 errors) | → |
| Architecture | A- (2-pass, truncation risk) | **A** (3-pass, chunked, cached) | ↑ |

---

## Since Last Review (2026-04-19 → 2026-04-25)

✅ **14 items resolved** across two major areas:

**Director Pipeline Overhaul (commits `0f2121f`, `f8815e9`, `61ea735`):**
- Rebuilt from 2-pass (truncation risk) to 3-pass (CharacterExtraction → VoiceAssignment → SceneConstruction)
- Chunked extraction for scripts > 30K chars — parallel processing, then merge
- Voice persistence: `project.voiceAssignments` caches Pass 2 results; re-runs skip it
- Batch voice search reduces LLM iterations ~70%
- Configurable default voice IDs via env vars

**Security Hardening (commits `a0ba80d`, `2227703`):**
- Global `usedVoiceIds` Set replaced with `createVoiceTools()` factory — eliminates concurrent-project voice collision
- Download endpoint ownership check now mandatory (prior: could be skipped if userId null)
- Double-encoded path traversal protection added
- TOCTTOU race eliminated (removed `existsSync()` before `res.download()`)
- O(N²) audio validator scene lookup replaced with O(N) Map
- `setInterval` in monitoring replaced with reschedule-on-completion `setTimeout`
- `MAX_OUTPUT_TOKENS` now configurable per-call (supports groq/small-window models)

🆕 **3 new findings:**
- TypeScript error in `teams/members/route.ts` (role type) — **fixed immediately**
- Voice-assignments/workflow-mode/audio-overrides routes untested (medium, next sprint)
- `comparable` + `adviser` services untested (medium, next sprint)

↩️ **4 Ryan action items carried over** (outside dev scope): Clerk key rotation, DNS, Stripe webhook confirmation, `ANTHROPIC_API_KEY`.

---

## Current State Summary

The product is technically excellent. Architecture is clean, TypeScript is error-free in both packages, and all production routes have auth guards. The pipeline handles large scripts robustly with the new 3-pass + chunked approach.

The only remaining development work is test coverage for 3 modules that work in production but lack unit tests (voice-assignments route, comparable service, adviser service). These are medium-priority, ~10 SP, completable in one sprint.

The real blockers to production launch are Ryan's action items: Clerk production keys and DNS routing. Without these, the app is live on Render but not reachable at the production domain, and new users can't authenticate with production Clerk.

---

## Critical Must-Fix Before Launch

1. **Ryan: Rotate Clerk keys** — `pk_test_*` are still in Render env vars. Real users can't authenticate.
2. **Ryan: DNS** — `app.storymagicapp.net` needs to point to `story-magic-web.onrender.com`
3. **Ryan: Add AI API keys to Render** — StoryScore and corpus scoring disabled without `ANTHROPIC_API_KEY`

---

## Document Index

| # | Document | Findings | Focus |
|---|----------|----------|-------|
| 01 | [Delta Review](01-DELTA-REVIEW.md) | 14 resolved, 3 new | Continuity |
| 02 | [Security & Quality](02-SECURITY-AND-QUALITY.md) | 0 open HIGH/CRITICAL | Auth, validation, types |
| 03 | [Testing Gaps](03-TESTING-GAPS.md) | 4 gaps | Coverage map |
| 04 | [Feature Completeness](04-FEATURE-COMPLETENESS.md) | 93% complete | Product gap analysis |
| 05 | [Technical Debt](05-TECHNICAL-DEBT.md) | 6 items / 15.5 SP | Debt backlog |
| — | **[SPRINT_PLAN](SPRINT_PLAN.md)** | 2 sprints | **Key deliverable** |

---

## Recommended Next Steps

1. **Sprint 1 (this week):** Write tests for voice-assignments, comparable, adviser, teams/members — 10 SP, brings coverage to ~1,220 tests, all production routes tested
2. **Ryan actions (unblocks launch):** Clerk key rotation + DNS + ANTHROPIC_API_KEY on Render
3. **Sprint 2 (low priority, 2 SP):** Remove `generateSimpleText` dead code, unify default voice ID imports, document referral env var

**After Ryan's actions:** The app is production-ready.
