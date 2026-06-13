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

**All 8 hardening items shipped.** Plus 3 backlog PRs cleared during the run (#245 Sentry gap coverage, #246 voice catalog, #247 billing revalidate). PR #244 (rate-limit per-user) is still OPEN — the 02:00 summary wrongly listed it as merged; it isn't.

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

### Per-PR audit trail (merge timestamps from `gh pr view`, PT)

| Time | PR | Item | Title |
|---|---|---|---|
| 01:26 | #250 | H1 | feat(h1): handler duration → Sentry breadcrumbs + slow/stuck events |
| 01:32 | #253 | H4 | feat(h4): safeUpdate / safeCreate to absorb cascade-delete races |
| 01:35 | #254 | H8 | feat(h8): prod manifest endpoint — single URL for what's actually deployed |
| 01:41 | #255 | H5 | feat(h5): stale-dep auditor + 2026-06-13 baseline report |
| 01:45 | #256 | H3 | feat(h3): Doppler as env source of truth + CI lint on render.yaml drift |
| 01:46 | #246 | backlog | fix(voice): auto-seed catalog from JSON when DB is empty |
| 01:46 | #245 | backlog | feat(sentry): close 3 observability gaps surfaced by today's incidents |
| 01:46 | #247 | backlog | fix(billing): revalidate /dashboard after successful upgrade |
| 01:49 | #257 | H2 | feat(h2): generalize boot-time idempotent seed framework |
| 01:53 | #258 | H6 | feat(h6): real-fixture corpus + integration harness for parse-screenplay |
| 01:59 | #259 | H7 | feat(h7): quiescent shutdown — drain long-running requests on SIGTERM |

PR #244 (rate-limit per-user) remains OPEN — not part of this sprint's merged set despite the earlier inaccurate claim.

The sprint ran 01:26 → 01:59 PT (33 minutes from first to last hardening merge). The three backlog PRs (#245/#246/#247) merged in a single 5-second window at 01:46 — they were independent, fully green, and queued up while H3 was the last item gating on CI.

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

### 02:30 PT — deeper root cause: apex DNS points at Vercel, not Render

While prepping to gray-cloud the apex for option 1, I checked the actual DNS state and found the *real* root cause is worse than "orange cloud blocks HTTP-01":

| Hostname | Record | Content | Proxied |
|---|---|---|---|
| `www.storymagicapp.net` | CNAME | `story-magic-web.onrender.com` | True (works, 200) |
| `storymagicapp.net` (apex) | A | `76.76.21.21` | True ❌ |

`76.76.21.21` is **Vercel's anycast IP**, not Render's apex IP (`216.24.57.1`). The apex has never pointed at Render. Render's HTTP-01 challenge can't succeed even with gray cloud because the IP doesn't resolve to a Render edge.

So the three earlier options were diagnosing the wrong thing. Corrected remediation:
1. Update apex A record from `76.76.21.21` → Render's apex IP (per Render's "Custom Domains" docs for the service), keep proxied. Then re-trigger verify. Once verified, CF Full(strict) sees the chained GTS cert and 525 clears.
2. Replace apex A with a CNAME flattening to `story-magic-web.onrender.com` (CF supports CNAME at apex). Same effect, less coupling to a specific IP.
3. Same as before: drop apex in Render, rely on a CF page rule to 301 to www.

Re-pointing the apex DNS is a higher-blast-radius action than a proxy flip — it changes where global traffic for `storymagicapp.net` lands. Not taken autonomously; waiting on Chris's call. (Open question: was the Vercel IP intentional from an older deploy, or stale config? `www` was correctly migrated to Render but the apex never was.)

### 03:30 PT — apex 525 RESOLVED ✅

Chris approved proceeding. Executed:

1. Backed up the apex A record (`76.76.21.21` Vercel, proxied) to `/tmp/sm-apex-A-backup-*.json`.
2. Deleted the apex A.
3. Created CNAME at apex → `story-magic-web.onrender.com` (CF auto-flattens CNAMEs at apex). Initial state: proxied = true.
4. Re-triggered Render `/verify`. Status stayed `unverified`, apex began returning 403 (Render service reachable but didn't recognize the Host).
5. Temporarily gray-clouded the apex CNAME so Render's verifier could reach the origin directly. DNS resolved to Render's apex anycast `216.24.57.8` / `.9`.
6. Re-triggered Render `/verify`. Status flipped to **`verified`** within ~60 s.
7. Render reissued/installed the cert (Let's Encrypt R7 → R7 with the intermediate this time — chain validates against system roots, `Verify return code: 0 (ok)`).
8. Re-oranged the CNAME (proxied = true).
9. End-to-end smoke: `https://storymagicapp.net/` → **301** → `https://www.storymagicapp.net/` → **200**. apex/www/app all healthy.

Total wall time from first CF API call to verified+oranged: ~7 min.

**Why HTTP-01 needed gray cloud here even after the DNS was correct:** Render's HTTP-01 challenge requires reaching Render's origin directly during the verification window. With CF orange-clouded *and* the hostname unverified at Render, Render returned 403 for the challenge path — chicken-and-egg. Gray-clouding broke the cycle. Once verified, re-oranging is safe because Render now recognizes the Host and CF Full(strict) accepts the new chained cert.

**Lessons:**
- The standard CF/Render apex setup should be CNAME-at-apex (CF flattens) rather than A record — survives Render IP changes.
- HTTP-01 + orange cloud + first-time verification is always going to need a brief gray-cloud window. DNS-01 would avoid this, but for a one-time setup it's not worth changing.
- The stale Vercel A record had survived a platform migration silently for an unknown period because `www` worked. A smoke check on `dig +short <apex>` against a Render-owned CIDR would have caught this earlier.

Final DNS, Render, and CF state captured. PR with this log update follows.

### 01:25 PT — H1 SHIPPED (PR #250)

Handler-duration instrumentation in `withAuth` + `withProjectAuth`. Sentry breadcrumb every request; `captureMessage` warning at 5s, error at 15s. 1317 / 1317 tests pass. Admin-merged.

**Effect:** the pdf-parse hang Chris hit at 100s would have paged Sentry at 5s and again at 15s, well before Cloudflare killed it.
