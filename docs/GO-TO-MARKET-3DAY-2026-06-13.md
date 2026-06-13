# Story Magic — 3-Day Go-To-Market Plan

**Date:** 2026-06-13 (Fri PT)
**Author:** Chris Therriault / Claude
**Target:** Market-ready by **end of Sunday 2026-06-15** — meaning a friendly cohort can sign up, pay, generate, listen, and we will not be paged in the night.
**This document is the single source of truth for the next 72 hours.** It supersedes prior TODO files for this window. Pre-existing planning docs (`ROADMAP-2026-06-09-EOD.md`, `REQUIREMENTS-2026-06-09.md`, `UAT-2026-06-09.md`) remain authoritative for everything past Monday.

---

## What "market-ready" means here

We're not promising:
- A perfect product
- Enterprise SOC 2 (that's the post-launch track)
- Every UX paper cut polished

We are promising:
1. **A new visitor can sign up, pay, upload a script, generate audio, listen, and download** — happy path verified by us, not by the customer.
2. **Failure modes don't lose the user's money or their work.** Cascade errors surface; Stripe charges either complete or get refunded; uploads either generate or fail loudly enough to refund.
3. **We will know within minutes if production is broken** — Sentry alerts wired, manifest endpoint live, the H1 timing breadcrumbs are paging.
4. **One person can run incident response without source-diving** — runbook exists, rollback verified, recovery sequence rehearsed once.

If those four are true Sunday night, we are market-ready for a friendly cohort (10–50 sign-ups Mon–Wed). Wider launch goes through `docs/ROADMAP-2026-06-09-EOD.md`'s enterprise track on a separate timeline.

---

## Current snapshot

| Metric | Value | Source |
|---|---|---|
| Test suite | **2,191 passing** (861 orch + 1,330 web) | overnight sprint |
| TS errors | 0 | overnight typecheck |
| Open PRs | 0 | post-#266 merge |
| Open issues | 7 (triaged below) | `gh issue list` |
| Hardening | All 8 H1–H8 items shipped | `HARDENING-OVERNIGHT-LOG-2026-06-13.md` |
| Apex domain | ✅ `https://storymagicapp.net/` 301→www→200 | this morning |
| Render auto-deploy | Now skips docs/code-review changes | #266 |
| UAT status | 20 cases, **all NOT TESTED** | `UAT-2026-06-09.md` |
| Stripe live mode | Not yet verified end-to-end | open |
| Production smoke | Last clean run 02:00 PT today | overnight |

---

## Open-issue triage against market-ready

| # | Issue | Market-ready blocker? | Action |
|---|---|---|---|
| #243 | Whisper binary missing in prod, Groq rate limits | **Yes — alignment failure** | Day 1: verify Groq fallback (PR #189) actually triggers in prod when whisper.cpp absent; either restore whisper.cpp or accept Groq as primary alignment |
| #219 | Enterprise signup CSRF error via Render deploy | Conditional — **only if enterprise sign-ups in cohort** | Day 1: triage. If non-enterprise cohort only, defer. Otherwise must fix. |
| #208 | Reader "recently played" % wrong | No — cosmetic | Backlog. Note in known-issues. |
| #207 | Listen UI display out of sync | **Yes — UX-blocking on the listen flow** | Day 1: reproduce, fix or hide the bad state |
| #206 | Dead-end "listen" flow | **Yes — happy-path blocker** | Day 1: must fix |
| #205 | Storage layer needs refactor/redesign | No — architectural | Backlog (post-launch) |
| #174 | Notification feed for master accounts | No — enterprise feature | Already has PRs #199/#200/#201 staged; not Day 1–3 |

**Blockers identified: 3 (#243, #207, #206), plus #219 conditional.** All other issues defer.

---

## Day 1 — Friday 2026-06-13 (today, remainder of day)

**Theme:** Find every actual blocker. UAT-driven discovery.

### Slot A: Listen-flow triage (1–2 h, Chris or Ryan)
- [ ] Reproduce **#206 (dead-end listen)** with a freshly generated project. Capture exact path from generation → listen page → where it breaks.
- [ ] Reproduce **#207 (Listen UI out of sync)**. Note which state mismatches (player position vs. visual scrubber? track index? completion %?).
- [ ] One PR per issue. Tests required (component tests for state sync, e2e Playwright spec for the listen path).

### Slot B: Whisper / alignment in prod (45 min, Claude)
- [ ] Trigger an actual generation in prod. Watch Sentry for `[align]` breadcrumbs.
- [ ] Confirm Groq fallback fires when whisper.cpp binary is absent (per PR #189). If Groq rate limits, watch the fallback chain (whisper.cpp → Groq → OpenAI → duration estimator).
- [ ] If the chain holds: close **#243** with a comment that Groq is now primary alignment.
- [ ] If broken: ship a fix (either rehydrate whisper.cpp in the orchestrator build, or fix the Groq path).

### Slot C: Stripe live-mode verification (1 h, Chris)
- [ ] Use the existing `scripts/stripe-test-checklist.md`. Walk through: real card → upgrade → webhook receipt → DB state → UI revalidation (#247 already fixed dashboard staleness).
- [ ] Test refund path: refund in Stripe dashboard → webhook → user back to free tier in DB → UI updates.
- [ ] **Gate:** if either checkout or refund leaves DB out of sync, that's a Day 2 P0.

### Slot D: UAT manual execution batch 1 (2 h, anyone)
- [ ] Open `docs/UAT-2026-06-09.md`. Run the 20 cases in order. Mark PASS / FAIL / N/A in a new dated UAT file (`UAT-2026-06-13.md`).
- [ ] Don't fix anything in this batch — just collect failures. Triage at end of day.
- [ ] **Gate:** count FAILs. >5 means we punt market-ready to next week; ≤2 means we're on track.

### End-of-Day 1 status meeting (15 min, Chris)
- [ ] Update this doc's "Current snapshot" with Day 1 results.
- [ ] Re-rank Day 2 work based on what UAT surfaced.
- [ ] Decision: **continue or punt.** Punt criteria: any P0 surfaced that can't be done in Day 2, OR > 5 UAT FAILs.

---

## Day 2 — Saturday 2026-06-14

**Theme:** Close every blocker. Production hardening.

### Slot A: Fix all blockers found Day 1 (4–6 h, Claude + Chris)
- [ ] Drive open count to 0 on the "must fix before market-ready" list. Each issue = one PR, tests required, no admin merges (CI must be green).

### Slot B: Performance smoke (2 h, Claude)
- [ ] Run `./scripts/smoke-test.sh --staging` (or prod if no staging available — read the script to check).
- [ ] 15-page script end-to-end timing. Compare against the timing breadcrumbs (H1) — anything > 5 s on a single handler is a known performance smell.
- [ ] Concurrent load: 3 simultaneous generations. Watch the H7 in-flight counter, watch orch memory (it's on the `starter` 512 MB plan).
- [ ] **Gate:** if a 15-page script can't complete in < 12 min wall-clock with no errors, ship perf fix or block the page-count at upload.

### Slot C: Documentation hardening (3 h, Chris)
- [ ] **Privacy policy + Terms of Service** finalized and linked from footer. Use a generator + customize, don't write from scratch.
- [ ] **Pricing page** copy locked. Confirm `/pricing` page renders all tiers correctly post #247 fix.
- [ ] **Support runbook**: one page in `docs/SUPPORT-RUNBOOK.md` with:
  - How to refund a charge
  - How to delete a user's account + their projects (GDPR)
  - How to look up a job by ID in the DB
  - How to read the manifest endpoint to confirm deploy state
  - How to roll back via Render dashboard if a deploy is bad
- [ ] **Status page** stub at `/status` showing health of web + orchestrator. Doesn't need to be fancy — a server-rendered table calling `/health` on each is enough.

### Slot D: Rollback drill (45 min, Claude)
- [ ] Deploy a trivial known-bad change to staging (or to prod off-hours): break the home page intentionally.
- [ ] Time how long it takes to: spot it in Sentry → identify the bad commit via manifest endpoint → trigger Render rollback → recovery.
- [ ] **Target:** < 5 minutes total. Write the result into `SUPPORT-RUNBOOK.md`.

### Slot E: Marketing-asset audit (1 h, Chris)
- [ ] Landing page above-the-fold conveys value in 2 seconds (record a 5-second screen capture and watch back).
- [ ] Open Graph meta tags work — `curl -A "facebookexternalhit" https://storymagicapp.net/` shows correct OG tags.
- [ ] One demo audio sample plays on the landing page (no sign-up wall).

### End-of-Day 2 status meeting (15 min)
- [ ] Update snapshot.
- [ ] Decision: cutover Sunday afternoon, or one more day.

---

## Day 3 — Sunday 2026-06-15

**Theme:** Final smoke. Cutover prep. Bake.

### Slot A: Regression sweep (2 h, Claude)
- [ ] Full test suite locally: `pnpm test` → both packages green.
- [ ] Playwright E2E suite: `pnpm --filter @story-magic/web test:e2e` — every spec passes (none flakily-skipped).
- [ ] Typecheck clean.
- [ ] Re-run the manual UAT cases that FAILed on Day 1 — all PASS now.

### Slot B: Final production smoke (1 h, Chris + Claude)
- [ ] Fresh anonymous browser session. Sign up with a real (throwaway) email.
- [ ] Verify email if applicable.
- [ ] Upload a real PDF (3-page test).
- [ ] Generate. Listen. Download.
- [ ] Upgrade to a paid plan with a real card. Verify billing.
- [ ] Refund. Verify downgrade.
- [ ] Repeat for a 15-page script (the harder path).
- [ ] **Gate:** any step that requires us to know an internal trick means it isn't market-ready.

### Slot C: Cutover prep (1 h, Chris)
- [ ] Update version tag in `package.json` to `v3.6.0` (the market-ready release).
- [ ] Cut a GitHub release with notes from `git log v3.5.x..HEAD`.
- [ ] Announce-channel template drafted (LinkedIn, X, friendly cohort email) — not sent yet.
- [ ] Confirm Sentry alerting routes to a number Chris answers (text/Slack — not just email).
- [ ] Confirm Checkly heartbeats are green and pages route to the same number.

### Slot D: Hand-off documentation (1 h, Chris)
- [ ] Update `CLAUDE.md` with anything an incoming session needs to know.
- [ ] Update memory: roadmap pointer → this doc, project state → market-ready.
- [ ] Final status board entry in the hardening log.

### Sunday 18:00 PT — GO / NO-GO decision

**Go criteria:**
- All Day 1+2 blockers closed
- UAT shows 0 FAILs on the path-critical cases (sign-up, upload, generate, listen, pay, refund)
- Performance smoke under thresholds
- Rollback drill < 5 min
- Sentry alerting verified end-to-end (one synthetic test alert received)
- Privacy / terms / pricing / support runbook all in place

**No-go criteria (any one is enough):**
- A new P0 surfaced after 12:00 PT Sunday
- We can't close a Day 2 blocker
- Rollback drill > 10 min
- Sentry didn't page us when it should have

If Go: send the friendly-cohort email Monday morning. Watch metrics for 48 h before broader push.
If No-Go: regroup, this doc updates, new target = Friday 2026-06-20.

---

## What's explicitly NOT in scope this window

Saying these out loud so we don't slip them in:

- **Enterprise sub-account features** (#174 notifications, #171 enterprise checkout if it's still pending) — separate track
- **Storage layer refactor (#205)** — architectural debt, post-launch
- **Mobile PWA install polish** — works enough
- **i18n / multi-language** — English only
- **#208 reader % bug** — cosmetic
- **Real customer PDF fixtures (H6 follow-up)** — synth fixtures cover CI
- **OpenRouter relief valve, prompt cache tuning** — already shipped overnight; no further iteration
- **Code review remediation backlog** — DT-31-H-1 + UX-G-01 etc. live in `code-review/2026-06-09/` and roll to Sprint A *after* launch

If any of these creep into Day 1–3 work, push back. The goal is *market-ready*, not *complete*.

---

## Decision log (update as we go)

| Time | Decision | Why |
|---|---|---|
| 2026-06-13 14:30 PT | Plan committed | Overnight hardening sprint complete, 0 open PRs, this is the natural window |
| | | |

---

## Quick reference

| Resource | Location |
|---|---|
| Production web | https://www.storymagicapp.net/ |
| Production orch | https://story-magic-orchestrator.onrender.com/ |
| Manifest endpoint | https://www.storymagicapp.net/api/admin/manifest (admin auth) |
| Sentry | https://sentry.io (story-magic project) |
| Render dashboard | https://dashboard.render.com (web srv-d5mmo2emcj7s73c6ffs0, orch srv-d5mmo2emcj7s73c6ffr0) |
| Doppler | https://dashboard.doppler.com (story-magic project, prd config) |
| Deploy runbook | `packages/web/scripts/deploy-runbook.md` |
| Stripe test checklist | `packages/web/scripts/stripe-test-checklist.md` |
| Hardening overnight log | `docs/HARDENING-OVERNIGHT-LOG-2026-06-13.md` |
| Hardening appraisal | `docs/HARDENING-APPRAISAL-2026-06-13.md` |

— Plan v1, 2026-06-13 14:30 PT
