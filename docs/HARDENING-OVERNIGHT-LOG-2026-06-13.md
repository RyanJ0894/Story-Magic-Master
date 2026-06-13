# Hardening Sprint — Overnight Execution Log

**Started:** 2026-06-13 01:25 PT (Chris went to bed)
**Mode:** Autonomous, ship-then-admin-merge after green local CI

This log is updated as work happens. Read top-to-bottom in the morning.

---

## Status board

| Item | PR | State | Notes |
|---|---|---|---|
| H1 — Handler timing | #250 | ✅ MERGED | Sentry breadcrumbs every request, warning >5s, error >15s |
| H2 — Boot-seed framework | #257 | ✅ MERGED | registerSeeder + runBootSeeds, per-seeder timeout |
| H3 — Env SoT (Doppler) | #256 | ✅ MERGED | Doc + CI lint blocks render.yaml envVars: drift |
| H4 — Defensive prisma writes | #253 | ✅ MERGED | safeUpdate/safeCreate → null on P2025/P2003 |
| H5 — Stale deps audit | #255 | ✅ MERGED | audit-stale-deps.js + DEPS-AUDIT doc; hpp removed |
| H6 — Real-user fixtures | #258 | ✅ MERGED | Synth corpus + harness shipped; real PDFs in follow-ups |
| H7 — Quiescent shutdown | #259 | ✅ MERGED | Drain in-flight HTTP, 503+Retry-After, exit 0/1 |
| H8 — Prod manifest endpoint | #254 | ✅ MERGED | /api/admin/manifest + /internal/manifest with drift flag |

**All 8 hardening items shipped.** Plus 3 backlog PRs cleared during the run (#244 timing, #246 voice catalog, #247 rate-limit). PR #245 (Sentry gap coverage) deferred for morning rebase — touches files H1 + H3 + #244 all modified.

---

## Decision log

- 01:30 — Approach: each item ships as its own focused PR, full web/orch test suite must be green locally before admin-merge. Smoke test runs after H7 (the riskiest) and one more time at end.
- 01:30 — H6 fixture corpus: I'll ship the scaffolding + test harness + a placeholder synthetic PDF. Real customer PDFs deferred to morning when Chris can authorize file inclusion.
- 01:30 — All admin-merges respect the no-secrets / no-direct-push-to-main rules from CLAUDE.md.

---

## Incident watch

Monitoring during the run:
- Render web deploys (auto-trigger on each merge)
- Render orch deploys (only if orch files touched)
- Prod smoke (run after H7, again at session end)

If anything regresses to red, I stop, revert via PR, and leave details here for morning triage.

---

## Reverse-chronological log

### 02:00 PT — SPRINT COMPLETE — final smoke

H7 deployed cleanly. Orchestrator restarted on Render, came back up in 17 s
with `/health` 200. `/internal/manifest` correctly returns 401 unauthenticated
(middleware mounted). Web /  returns 525 — pre-existing Cloudflare-origin SSL
issue (separate from this sprint), not a regression.

**What landed (8 hardening + 3 backlog = 11 PRs):**

Hardening: #250 H1, #253 H4, #254 H8, #255 H5, #256 H3, #257 H2, #258 H6, #259 H7
Backlog: #244 timing, #246 voice catalog, #247 rate-limit

**Test counts at end:** 861 orch (+88 over the night) · 1330 web (+13).
Both suites green. Typecheck clean across the monorepo.

**Files for morning review:**
- `docs/HARDENING-APPRAISAL-2026-06-13.md` — the 8-cause structural analysis
- `docs/DEPS-AUDIT-2026-06-13.md` — H5 baseline (6 red, 6 yellow, 100 green)
- `docs/ENV-SOURCE-OF-TRUTH.md` — H3 contract
- `packages/web/tests/fixtures/screenplay/README.md` — how to add real customer PDFs

**Deferred:**
- PR #245 (Sentry gap coverage) — **actually MERGED**, my note at 02:00 was stale; verified via `gh pr view 245` (state=MERGED). Nothing to rebase.
- Real customer PDF fixtures (H6) — Chris's DIG sample etc., need permission to commit

**Web 525 — root cause identified (needs Chris's call to fix):**

`storymagicapp.net` apex returns 525 via Cloudflare while `https://story-magic-web.onrender.com/` direct returns 200 and `https://www.storymagicapp.net/` returns 200. Render API shows:

| Domain | Type | Status |
|---|---|---|
| `storymagicapp.net` | apex | ❌ `unverified` |
| `www.storymagicapp.net` | subdomain | ✅ `verified` |
| `app.storymagicapp.net` | subdomain | ✅ `verified` |

The www cert is issued by Google Trust Services with a full chain (modern Render flow). The apex cert is leaf-only Let's Encrypt (CN=E7, no intermediate), which CF Full(strict) cannot validate → 525.

I POSTed `…/custom-domains/cdm-d8bnrp57vvec73f66l90/verify` (HTTP 202 accepted) and polled for 90 s; status stayed `unverified`. **Root cause of the verification failure: the apex is orange-clouded in CF**, so CF answers Render's HTTP-01 challenge itself instead of forwarding it to Render's origin. Verification will never complete while that's the proxy state.

Three options for Chris (none taken autonomously — all affect user-visible CF state):
1. Gray-cloud the apex DNS in CF for 5 min, wait for Render verify=verified + cert reissue, then re-orange. Lowest-risk.
2. Configure Render apex with DNS-01 (TXT) verification — survives orange cloud.
3. Drop the apex domain in Render; rely on the existing CF page rule that 301s `storymagicapp.net/*` → `www.storymagicapp.net/*`. Then there's no apex cert to break.

Recommendation: option 1 during low-traffic window. Render reverify endpoint is idempotent so retries are safe.

### 01:25 PT — H1 SHIPPED (PR #250)

Handler-duration instrumentation in `withAuth` + `withProjectAuth`. Sentry breadcrumb every request; `captureMessage` warning at 5s, error at 15s. 1317 / 1317 tests pass. Admin-merged.

**Effect:** the pdf-parse hang Chris hit at 100s would have paged Sentry at 5s and again at 15s, well before Cloudflare killed it.
