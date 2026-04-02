# Story Magic — Weekly Summary (Mar 29 – Apr 2, 2026)

**40 commits · 165 files changed · 17,166 insertions**

---

## Mar 29 — Code Review V3 + CI Hardening

### StoryScore Corpus Pipeline
- Built full calibration corpus pipeline: `ingest:training` script parses training PDFs → `script_corpus` table; `score:corpus` batch-scores with Gemini 2.0 Flash
- Admin UI at `/admin/corpus` with CSV export + download button
- Upgraded `ai` SDK to v6, fixed Gemini model ID and `REPO_ROOT` path resolution

### Marketing Site
- Created `story-magic-marketing-site/` — standalone Next.js 14 app (no auth, no Prisma)
- Deployed to Vercel at https://storymagic.servicevision.io
- Full landing page: hero, how-it-works, features grid, 4-tier pricing preview, CTA banner, footer
- `/pricing` and `/features` detail pages; dark mode default

### CI Fixes (6 commits)
- Isolated orchestrator Prisma output to `src/generated/prisma` to prevent it overwriting web package types (was causing 60+ TS2339 errors in CI typecheck)
- Added ESLint configs for both packages; fixed hooks-in-conditional bug; excluded test files and generated dirs from linting

### Pre-launch Hardening
- Nonce-based CSP (BL-11)
- Agent loop cancellation (BL-13)
- MSW test mock camelCase alignment
- Corpus populate admin endpoint

---

## Mar 30 – Apr 1 — Impact StoryBuilder (PR #2)

A complete new program — free AI audio memoir for trauma survivors — shipped as PR #2 (20 commits, merged Apr 1).

### Core Feature
- `/impact/stories/new` form with attestation gate, 800-word cap, 24h rate limit per user
- Auth gate: requires sign-in before accessing StoryBuilder
- Audio generation via orchestrator → upload to Cloudflare R2 → permanent URL stored in DB

### Transactional Emails (Resend)
- 6 emails: submission confirmation, audio ready, audio error, donation thank-you, admin notification, prize draw notification
- All routing to `info@servicevision.net` while `EMAIL_TESTING_MODE=true`

### Donations
- Stripe Checkout (payment mode) → `checkout.session.completed` webhook → `ImpactDonation` table → admin email

### Prize Draw
- Monthly Render cron job (`0 23 28-31 * *`) calling `POST /api/cron/prize-draw`
- Protected by `CRON_SECRET`

### Marketing Integration
- Added `/impact` page to marketing site
- Impact nav link + footer section on storymagic.servicevision.io

### Render Deployment (Apr 1)
Fought through 6 build failures to go live:
- `corepack` → `npm install -g pnpm@9.1.0`
- Node 20.11 pinned
- `DIRECT_DATABASE_URL` added (Prisma 6 requirement)
- OOM resolved via `disableSourceMapUpload: true` (saved ~50MB webpack heap)
- OpenAI client moved inside handler + `force-dynamic` on AI routes
- `prisma migrate deploy` moved to `startCommand`

**App went live at 13:43 UTC on Apr 1** — database healthy, auth healthy.

---

## Apr 2 — Backlog Sprint + Deploy Recovery

### Backlog Items Shipped (pre-merge)
| Item | Description |
|------|-------------|
| **BL-08** | Stem export: `GET /stems/:id` + `/stems/:id/zip`, web proxy at `/api/projects/[id]/export/stems` |
| **BL-46** | Audio quality validation: `validateAudioQuality()` + `parseLoudnormOutput()`, EBU R128 LUFS/peak checks, 27 tests |
| **BL-06** | Long-script chunking: `chunkScriptForScoring()` for Pro tier (>80K chars), 20 tests, wired into `callScoringLLM` |
| **Feb15-TD-032** | Next.js 14 → 15.5.14 upgrade: fixed async params, `onRequestError` Sentry hook, moved `xlsx` to devDeps |

### Next.js 15 Build Failures (7 commits)

The Next.js 15 upgrade triggered a cascade of Render build failures. Root cause: **pnpm skips devDependencies when `NODE_ENV=production`**.

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Hard error at startup | `experimental.instrumentationHook` removed in Next.js 15 | Removed from `next.config.js` |
| ESLint missing at build | pnpm skips devDeps with `NODE_ENV=production` | `eslint: { ignoreDuringBuilds: true }` |
| `xlsx` type error | `scripts/` included by `**/*.ts` tsconfig glob | Added `"scripts"` to tsconfig `exclude` |
| `onRequestError` missing | Next.js 15 requires explicit export | Added `export const onRequestError = Sentry.captureRequestError` to `instrumentation.ts` |

### Env Var Wipe Incident
- Render's `PUT /env-vars` is **destructive** — a partial PUT wiped all 33 env vars including the `fromDatabase` linkage for `DATABASE_URL`/`DIRECT_DATABASE_URL`
- Retrieved connection strings from Render Postgres API (`GET /v1/postgres/{id}/connection-info`), restored all 35 vars, redeployed
- **Lesson:** Never call `PUT /env-vars` with a partial list. Always GET first, merge, then PUT the full set.
- Web service back live at 11:14 UTC

### DB Connection Strings (for reference)
- Internal (use for Render services): `postgresql://story_magic_user:...@dpg-d665vdrh46gs73dnuhr0-a/story_magic`
- External: `postgresql://story_magic_user:...@dpg-d665vdrh46gs73dnuhr0-a.oregon-postgres.render.com:5432/story_magic`
- DB ID: `dpg-d665vdrh46gs73dnuhr0-a`

### Orchestrator Prisma Fix
- Orchestrator had been `update_failed` on every deploy since Mar 29
- `prisma generate` writes JS runtime to `src/generated/prisma/`; `tsc` doesn't copy non-TS files to `dist/`
- Fix: added `cp -r src/generated dist/` to the orchestrator build script
- Orchestrator live at 16:25 UTC

---

## Final State (Apr 2, 16:26 UTC)

| Check | Status |
|-------|--------|
| Web | ✅ live — https://story-magic-web.onrender.com |
| Orchestrator | ✅ live |
| Database | ✅ healthy (2ms latency) |
| Auth (Clerk) | ✅ healthy |
| Orchestrator comms | ✅ healthy (96ms latency) |
| Storage (R2) | ⚠️ degraded — R2 config needs verification |
| ElevenLabs | ❌ unhealthy — needs `ELEVENLABS_API_KEY` on web service |
| OpenAI | ❌ unhealthy — needs `OPENAI_API_KEY` on web service |

**Tests:** 1,019 passing (web 628 + orchestrator 391)
**Corpus:** 57 screenplays with embeddings
**Version:** 0.14.0

---

## Remaining (Ryan Manual Tasks)

| Task | Where |
|------|-------|
| `OPENAI_API_KEY` | Render web service → Environment |
| `ELEVENLABS_API_KEY` | Render web service → Environment |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Render web service → Environment (Gemini corpus scoring) |
| Production Clerk keys (`pk_live_*` / `sk_live_*`) | Render web service → Environment |
| DNS: `storymagicapp.net` → Vercel | GoDaddy: `A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com` |
| DNS: `app.storymagicapp.net` → Render | GoDaddy: `CNAME app story-magic-web.onrender.com` |
| Add `storymagicapp.net` as custom domain | Vercel project dashboard |
| Stripe webhook: confirm `checkout.session.completed` | Stripe dashboard |
| `EMAIL_TESTING_MODE=false` | Render web service → Environment (when ready for real emails) |
| Update `NEXT_PUBLIC_APP_URL` | Render → `https://app.storymagicapp.net` (after DNS) |
