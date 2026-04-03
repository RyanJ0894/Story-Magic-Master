# Story Magic — What Remains to Launch

**Date:** 2026-04-03
**Current version:** 0.14.0
**Target:** v1.0.0 — custom domain live, Stripe live mode, beta users

The app is built and deployed. What remains is almost entirely configuration, verification, and DNS. The code is done.

---

## Part 1: Ryan's Manual Tasks (~1–2 hours total)

These cannot be done via API or code. Each requires logging into a dashboard.

### 1a. Render Dashboard — Environment Variables

Go to: **Render → story-magic-web → Environment**

Add the following (these are the only missing ones — all others are already set):

| Variable | Value / Source |
|----------|---------------|
| `OPENAI_API_KEY` | From OpenAI dashboard — needed for Comparable Scripts + StoryScore |
| `ELEVENLABS_API_KEY` | From ElevenLabs dashboard — needed for audio generation health check |
| `GOOGLE_GENERATIVE_AI_API_KEY` | From Google Cloud console — needed for Gemini corpus batch scoring |
| `STRIPE_SECRET_KEY` | From Stripe dashboard → Developers → API Keys (live mode) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe dashboard → Developers → Webhooks (after adding endpoint) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | From Stripe dashboard → Developers → API Keys (live mode) |
| `SERVICE_SECRET_KEY` | Generate a random 32-char secret (shared between web + orchestrator) |
| `CLERK_WEBHOOK_SECRET` | From Clerk dashboard → Webhooks → story-magic endpoint |

After DNS is live, also update:
- `NEXT_PUBLIC_APP_URL` → `https://app.storymagicapp.net`

### 1b. Render Dashboard — Orchestrator Environment Variables

Go to: **Render → story-magic-orchestrator → Environment**

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Same key as above |
| `ELEVENLABS_API_KEY` | Same key as above |
| `SERVICE_SECRET_KEY` | Same value as web service |
| `WEB_URL` | `https://app.storymagicapp.net` (or `https://story-magic-web.onrender.com` until DNS) |

### 1c. Clerk Dashboard — Switch to Production Keys

Go to: **Clerk → Production instance → API Keys**

Current keys are test keys (`pk_test_*`, `sk_test_*`). Before launch:
1. Create a production Clerk instance (or activate the existing one)
2. Update on Render web service:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → `pk_live_*`
   - `CLERK_SECRET_KEY` → `sk_live_*`
3. Re-add the Clerk webhook for the production instance, update `CLERK_WEBHOOK_SECRET`

> **Note:** Test keys block real user signups in some regions. Production keys are required before any public beta.

### 1d. Stripe — Wire Up Webhooks

Go to: **Stripe → Developers → Webhooks → Add endpoint**

- Endpoint URL: `https://app.storymagicapp.net/api/stripe/webhook`
- Events to listen for:
  - `checkout.session.completed` ← required for Impact donations
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` on Render.

Also confirm you're using **live mode keys** (not test mode) for production.

### 1e. DNS — GoDaddy (storymagicapp.net)

Go to: **GoDaddy → DNS → storymagicapp.net**

Add these three records:

| Type | Host | Value |
|------|------|-------|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `app` | `story-magic-web.onrender.com` |

Then go to: **Vercel → story-magic-marketing project → Settings → Domains**
- Add `storymagicapp.net`
- Add `www.storymagicapp.net`

Result after propagation (~24–48 hours):
- `https://storymagicapp.net` → marketing site
- `https://www.storymagicapp.net` → marketing site
- `https://app.storymagicapp.net` → SaaS app

### 1f. Turn Off Email Testing Mode

Currently all transactional emails (Impact submissions, audio ready notifications, donation receipts) route to `info@servicevision.net` regardless of recipient. This is controlled by `EMAIL_TESTING_MODE=true` on Render.

When ready for real user emails:
- Set `EMAIL_TESTING_MODE=false` on Render web service
- Verify Resend domain is verified for `storymagicapp.net` (or whichever sending domain is configured)

---

## Part 2: Verification Checklist (~1–2 hours, post-config)

Once Part 1 is complete, run through these to confirm everything works end-to-end.

### Audio Pipeline (Core Product)
- [ ] Upload a PDF script → pipeline completes → audio downloadable
- [ ] StoryScore runs and returns a score with breakdown
- [ ] Story Adviser returns feedback
- [ ] Stem export downloads a zip of individual tracks
- [ ] Story Explorer shows comparable films (requires `OPENAI_API_KEY`)

### Impact StoryBuilder
- [ ] Submit a story (< 800 words, with attestation) → audio generated → stored in R2
- [ ] Email received: "audio ready" notification
- [ ] Stripe donation flow completes → webhook fires → admin email sent
- [ ] `EMAIL_TESTING_MODE=false` → emails go to actual recipients

### Billing
- [ ] Stripe Checkout completes for Creator/Pro/Studio tier
- [ ] Subscription created in Stripe → webhook fires → user plan updated in DB
- [ ] Subscription cancellation → user reverted to Free tier

### Auth
- [ ] Sign up with production Clerk keys
- [ ] Clerk webhook fires on user creation → profile row created in DB
- [ ] Sign in / sign out works on `app.storymagicapp.net`

### Health Check
Run: `curl https://app.storymagicapp.net/api/health`

All checks should be `healthy` after configuration is complete:
- database ✅
- auth ✅
- storage ✅ (currently degraded)
- elevenlabs ✅ (currently unhealthy)
- openai ✅ (currently unhealthy)
- orchestrator ✅

---

## Part 3: Chris's Code Tasks (~3 SP)

Small items remaining before the codebase is fully clean.

### CORP-01: Verify Comparable Scripts in Production (3 SP)
- Run a full script through the pipeline with `OPENAI_API_KEY` set
- Confirm comparable films appear in the UI with poster images and similarity scores
- If any of the 57 corpus entries are missing embeddings, call `POST /api/admin/corpus/populate`

### CORP-02: Verify Story Explorer (2 SP)
- Story Explorer requires `director_json` to be populated (set by orchestrator after audio generation)
- After a full pipeline run succeeds in production, verify the Story Explorer tab shows timeline + character data
- This is expected to be blocked until the full pipeline runs at least once in production

### CORP-04: Verify Legacy Corpus Embeddings (2 SP)
- 9 pre-existing corpus entries may be missing OpenAI embeddings
- After `OPENAI_API_KEY` is set on Render: `POST /api/admin/corpus/populate`
- Admin UI at `/admin/corpus` shows which entries have embeddings

### Feb15-TD-025: Fix DELETE Verb for Project Deletion (1 SP)
- Currently uses `POST /projects/{id}/delete` — should be `DELETE /projects/{id}`
- Low risk, purely REST hygiene
- 1 route + 1 client call to change

---

## Part 4: Grant Applications

Three active grant programs to apply for:

| Program | URL | Why Apply |
|---------|-----|-----------|
| ElevenLabs Grants | https://elevenlabs.io/grants-application | Impact StoryBuilder uses TTS — strong alignment |
| Google for Startups (AI) | https://cloud.google.com/startup/ai | Gemini integration + AI-first product |
| Anthropic Startups | https://claude.com/programs/startups | Claude Sonnet powers StoryScore + Story Adviser |

---

## Part 5: Post-Launch Roadmap

After v1.0.0 ships, the natural next phases:

### Phase A — Intelligence UX (2–4 weeks)
- Story Explorer polish: richer timeline visualization, character arc charts
- Comparable Scripts UX: poster grid, filter by genre/era, similarity explanation
- Corpus growth: add unproduced specs and TV pilots for better coverage of non-feature formats
- StoryScore calibration: compare AI scores against human expert scores from the corpus

### Phase B — Marketplace + Monetization (3–4 weeks)
- Reader upload program: let script readers/coverage services upload and earn
- Payout system: Stripe Connect for reader payouts
- Marketplace discovery: searchable, filterable script listing

### Phase C — Enterprise Readiness (12–20 weeks)
- SSO (SAML/OIDC) for studio clients
- Multi-tenancy: isolated data per organization
- SOC 2 Type II audit preparation
- TPN/MPAA compliance for content protection
- Audit logging with 7-year retention

### Phase D — Scale + Platform (Ongoing)
- Auto-scaling beyond single Render instance
- Multi-region deployment
- CDN for audio delivery
- Public API + SDKs

---

## Summary

| Category | Owner | Effort | Blocking Launch? |
|----------|-------|--------|-----------------|
| Render env vars (API keys) | Ryan | 30 min | Yes |
| Clerk production keys | Ryan | 15 min | Yes |
| Stripe webhook setup | Ryan | 15 min | Yes (donations) |
| DNS (GoDaddy + Vercel) | Ryan | 15 min | Yes (custom domain) |
| Email testing mode off | Ryan | 2 min | No (can go live with test mode) |
| Corpus verification | Chris | 2–3 SP | No |
| DELETE verb fix | Chris | 1 SP | No |
| Story Explorer verification | Chris | post-pipeline | No |

**The app is fully built. Launch is gated entirely on Ryan's configuration tasks — roughly 1 hour of dashboard work.**
