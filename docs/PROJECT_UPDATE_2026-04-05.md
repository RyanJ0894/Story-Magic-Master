# Story Magic — Project Update
**Date:** April 5, 2026
**Prepared by:** Chris Therriault

---

## Status: Live on Render — Finishing Configuration

The app is fully built and deployed. This week was about getting the deployed instance healthy. All core engineering work is complete. What's left is configuration, DNS, and one Ryan action in Stripe.

---

## What's Working Right Now

Visit: https://story-magic-web.onrender.com

| System | Status | Notes |
|--------|--------|-------|
| App | ✅ Live | Deployed on Render, uptime ~57 hours |
| Database | ✅ Healthy | PostgreSQL, 4ms latency |
| Auth (Clerk) | ✅ Healthy | Sign up/sign in functional |
| Orchestrator | ✅ Healthy | Audio pipeline service responding (26ms) |
| OpenAI | ✅ Healthy | StoryScore + Story Adviser active |
| Storage (R2) | ✅ Healthy* | *resolving with today's deploy |
| ElevenLabs | ⚠️ Verifying | Key updated today, confirming after deploy |

---

## What Was Done This Week (Apr 1–5)

### Production Deployment — Fully Resolved
The app went live April 1 but hit a series of build and startup failures through April 2. All are now fixed:

- **Next.js 15 upgrade** — removed deprecated `experimental.instrumentationHook`, fixed `onRequestError` Sentry hook, excluded scripts from TypeScript compilation
- **pnpm + devDependencies bug** — pnpm skips devDeps when `NODE_ENV=production`; fixed by adding `eslint: { ignoreDuringBuilds: true }` so the build doesn't require ESLint to be installed
- **Orchestrator Prisma client** — `prisma generate` writes JS runtime files to `src/generated/prisma/`; `tsc` doesn't copy non-TypeScript files; fixed by adding `cp -r src/generated dist/` to the build script
- **Database connection restored** — a Render API call accidentally wiped all env vars; connection strings recovered from Render's Postgres API and restored

### Environment Variables — Fully Configured
All API keys and service credentials are now set on both Render services:

| Variable | Status |
|----------|--------|
| `OPENAI_API_KEY` | ✅ Set |
| `ELEVENLABS_API_KEY` | ✅ Set (updated today) |
| `ANTHROPIC_API_KEY` | ✅ Set |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ Set (Gemini corpus scoring) |
| `STRIPE_SECRET_KEY` | ✅ Set (dbbuilder live account) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ Set |
| `STRIPE_WEBHOOK_SECRET` | ✅ Set (placeholder — see Ryan action below) |
| `SERVICE_SECRET_KEY` | ✅ Set (web ↔ orchestrator auth) |
| `SENTRY_DSN` | ✅ Set |
| `RESEND_API_KEY` | ✅ Set |
| All R2 credentials | ✅ Set |
| All feature flags | ✅ Set (all enabled) |

---

## What Ryan Needs to Do (3 actions, ~45 minutes)

These are the only remaining blockers. Ryan doesn't need to write any code.

### Action 1 — Stripe Webhook Endpoint (~15 min)
The Stripe webhook secret currently set is a placeholder. To enable real donation payments:

1. Go to **https://dashboard.stripe.com → Developers → Webhooks → Add endpoint**
2. Set endpoint URL: `https://story-magic-web.onrender.com/api/stripe/webhook`
3. Add these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **Signing secret** that Stripe generates
5. Send it to Chris — he'll update `STRIPE_WEBHOOK_SECRET` on Render

> Without this, the app won't receive Stripe events. Checkout sessions will still create successfully, but donations won't trigger the confirmation email or be recorded in the database.

### Action 2 — DNS (~15 min)
Add these three records in **GoDaddy → DNS → storymagicapp.net**:

| Type | Host | Value |
|------|------|-------|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `app` | `story-magic-web.onrender.com` |

Then go to **Vercel → story-magic-marketing project → Settings → Domains** and add:
- `storymagicapp.net`
- `www.storymagicapp.net`

After propagation (~24–48 hours):
- `https://storymagicapp.net` → marketing site
- `https://app.storymagicapp.net` → SaaS app

### Action 3 — Test the App (~15 min)
Once DNS is live, please run through this checklist:

**Core pipeline:**
- [ ] Sign up for a new account
- [ ] Upload a PDF screenplay (test scripts are in `/Samples/` in the repo)
- [ ] Wait for audio generation to complete
- [ ] Download the audio file and confirm it plays
- [ ] Check that StoryScore shows a score with breakdown
- [ ] Check that Story Adviser shows feedback

**Impact StoryBuilder:**
- [ ] Go to https://app.storymagicapp.net/impact/stories/new
- [ ] Submit a short story (< 800 words, check the attestation box)
- [ ] Confirm audio is generated and playable
- [ ] Confirm email arrives at `info@servicevision.net` (testing mode is on — emails won't go to real users yet)

**Stripe (after webhook is configured):**
- [ ] Try the donation flow on an Impact story
- [ ] Use Stripe test card `4242 4242 4242 4242` with any future expiry
- [ ] Confirm confirmation email arrives

---

## What Chris Is Working On Next

### Corpus Verification (this week)
With `OPENAI_API_KEY` now live on Render, the Comparable Scripts feature is active. Need to verify:
- All 57 corpus entries have OpenAI embeddings (call `/api/admin/corpus/populate` if any are missing)
- Comparable films appear correctly in the UI after a full pipeline run

### Story Explorer Verification
Story Explorer requires a completed audio generation (`director_json` populated by orchestrator). Will verify once Ryan runs the first production pipeline.

### DELETE Verb Fix (1 SP)
Project deletion currently uses `POST /projects/{id}/delete` — should be `DELETE /projects/{id}`. Minor REST hygiene fix, low priority.

---

## After Launch Priorities

Once DNS is live and Ryan confirms the pipeline works end-to-end:

1. **Turn off email testing mode** — Set `EMAIL_TESTING_MODE=false` on Render so emails go to real recipients (currently all route to `info@servicevision.net`)
2. **Production Clerk keys** — Switch from test Clerk keys to `pk_live_*` / `sk_live_*` before any public marketing
3. **Grant applications** — ElevenLabs, Google for Startups, Anthropic Startups (all have good alignment with the Impact StoryBuilder program)

---

## Quick Reference

| Resource | URL |
|----------|-----|
| Live app | https://story-magic-web.onrender.com |
| Marketing site | https://storymagic.servicevision.io |
| Health check | https://story-magic-web.onrender.com/api/health |
| Admin panel | https://story-magic-web.onrender.com/admin |
| Corpus admin | https://story-magic-web.onrender.com/admin/corpus |
| GitHub repo | https://github.com/dbbuilder-org/story-magic |

---

*Next update after Ryan completes DNS + Stripe webhook setup.*
