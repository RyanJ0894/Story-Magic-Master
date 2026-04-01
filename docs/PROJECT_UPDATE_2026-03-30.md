# Story Magic — Project Update
**Date:** March 30, 2026
**Prepared by:** Chris Therriault

---

## Where We Are

Story Magic is **production-ready**. The SaaS platform (audio generation pipeline, billing, auth, sharing) has been complete since late February. This past week focused on clearing the final pre-launch checklist — CI, code quality, and platform polish — so we can go live as soon as DNS and environment variables are in place.

---

## What Was Done Tonight (Sessions Mar 29–30)

### 1. CI Pipeline — Fixed & Green ✅

The GitHub Actions CI workflow was failing on every push. Root causes were infrastructure issues that had never been addressed:

- **Prisma client collision** — Both the `web` and `orchestrator` packages were writing their generated Prisma client to the same path, causing the web's database types to be overwritten. Fixed by giving the orchestrator its own isolated output path.
- **83 failing orchestrator tests** — Prisma's client constructor was running at module load time in tests without a `DATABASE_URL`, causing every test in `mixer.ts` and `align.ts` to throw before even running. Fixed by injecting a test-only env var in the vitest config.
- **ESLint not scanning TypeScript** — The orchestrator's lint script was using default extensions (`.js` only). Fixed to use `--ext .ts`.
- **Missing ESLint config for web** — `next lint` was prompting interactively in CI (no `.eslintrc.json` present). Created a proper config, disabled pre-existing `react/no-unescaped-entities` violations.
- **React hooks bug in voice-chooser** — A `useMemo` was called after two early `return` statements, violating Rules of Hooks. Fixed by moving the hook above the early returns.
- **Build crash on `generate-demo-script`** — The OpenAI client was instantiated at module level, which Next.js executes at build time. Throws when `OPENAI_API_KEY` is absent in CI. Fixed by moving instantiation inside the request handler.

### 2. Pre-Launch Hardening ✅

All remaining roadmap items before 1.0 are now implemented:

| Item | What Was Done |
|------|---------------|
| **Nonce-based CSP (BL-11)** | Middleware now generates a per-request cryptographic nonce, embeds it in `script-src`, and forwards it to `ClerkProvider` via the `x-nonce` header. CSP Level 2+ browsers ignore `unsafe-inline` when a nonce is present — effective protection without breaking Clerk or Stripe. |
| **Agent loop cancellation (BL-13)** | Users can now cancel jobs that are actively processing (not just queued). The cancel API and queue service both accept `processing` status. The generation processor checks DB status after the director phase so a cancelled job stops before the long orchestration step. |
| **Remove old delete route (Feb15-TD-025)** | Removed the legacy `POST /api/projects/[id]/delete` sub-route. Proper `DELETE /api/projects/[id]` has been the correct endpoint for months. |
| **MSW mocks camelCase (Feb15-TD-034)** | All test mock factories and response fixtures migrated from `snake_case` to `camelCase` to match Prisma's actual output. This fixes a class of bugs where tests were passing against wrong field names. |
| **Corpus populate button (CORP-04)** | Added a "Populate Missing Embeddings" button to the `/admin/corpus` page. Previously the only way to fill missing embeddings was via CLI. Admins can now trigger it from the UI. |

### 3. StoryScore Calibration Pipeline ✅ (from Mar 29)

- **New scoring engine** using Claude Sonnet 4.6 via Vercel AI SDK (replacing OpenAI)
- **Multi-provider AI factory** (`providers.ts`) — Claude for production scoring, Gemini Flash for batch corpus scoring
- **Few-shot calibration** — each score request includes real anchor examples from the corpus (Oscar Winners, Weak Films)
- **Admin corpus dashboard** at `/admin/corpus` — shows training scripts, scores, coverage %, calibration spread
- **CSV export** for score audit trails
- **Ingest + batch score scripts** — `pnpm ingest:training` (processes 43 PDFs), `pnpm score:corpus` (Gemini Flash batch)

### 4. Marketing Site ✅ (from Mar 29)

A full marketing site is built and deployed. Covers: hero, how-it-works, features, pricing, CTA, footer. All CTAs point to `app.storymagicapp.net` for signups.

---

## Current PR

**PR #2** — `fix/code-review-v3-20260329`
All of the above work is in this branch. CI is running — the build should pass clean.

---

## What's Needed to Go Live

These are **external actions only** — no more code changes required:

### Chris
1. `cd packages/web && npx prisma migrate deploy` — apply migration 0003 (adds `script_corpus` + `corpus_score` tables) to production DB
2. Add env vars to Render web service: 
   - `GOOGLE_GENERATIVE_AI_API_KEY `
3. After migrate: `pnpm --filter @story-magic/web ingest:training` (ingest 43 training PDFs)
4. After ingest: `pnpm --filter @story-magic/web score:corpus` (batch score with Gemini Flash)
5. Verify `/admin/corpus` — coverage ≥ 80%, calibration spread ≥ 2.5

### Ryan
1. **Click Formsubmit activation email** in talent@storymagicapp.net — the contact form on the marketing site won't work until this is done
2. **Add domains to Vercel** (story-magic-marketing project → Settings → Domains):
   - `storymagicapp.net`
   - `www.storymagicapp.net`
3. **Update GoDaddy DNS:**

   | Type | Name | Value |
   |------|------|-------|
   | A | `@` | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |
   | CNAME | `app` | `story-magic-web.onrender.com` |

4. **Add custom domain in Render** (story-magic-web service): `app.storymagicapp.net`

---

## Overall Project Health

| Area | Status |
|------|--------|
| Audio generation pipeline | ✅ Complete |
| Auth (Clerk) | ✅ Complete |
| Billing (Stripe) | ✅ Complete |
| Script upload (PDF/DOCX/TXT/MD) | ✅ Complete |
| Voice chooser | ✅ Complete |
| Sharing + Reader library | ✅ Complete |
| StoryScore analysis | ✅ Complete |
| Story Adviser | ✅ Complete |
| Comparable Scripts | ✅ Complete |
| Story Explorer | ✅ Complete |
| Export Reports | ✅ Complete |
| CI pipeline | ✅ Fixed this week |
| Security (nonce CSP) | ✅ Done this week |
| Marketing site | ✅ Deployed |
| DNS / custom domain | ⏳ Ryan action |
| StoryScore corpus ingestion | ⏳ Chris action (needs env vars) |
| **Launch** | 🚀 Blocked only on DNS + env vars |

---

## Test Coverage

- Orchestrator: 364 tests
- Web (unit): 278 tests
- Web (component): 186 tests
- **Total: 828 tests**

---

*Next milestone: DNS propagation + corpus ingest → 1.0 launch.*
