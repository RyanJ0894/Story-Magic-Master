# Story Magic — Project Update
**Date:** April 5–6, 2026
**Prepared by:** Chris Therriault

---

## Status: Live — One Remaining Ryan Action

The app is fully built, deployed, and almost entirely configured. All API keys, Stripe, and infrastructure are wired up. The only remaining work before launch is **DNS** (Ryan/GoDaddy, ~15 minutes).

---

## What's Working Right Now

Visit: https://story-magic-web.onrender.com

| System | Status |
|--------|--------|
| App | ✅ Live |
| Database | ✅ Healthy (2ms) |
| Auth (Clerk) | ✅ Healthy |
| Orchestrator (audio pipeline) | ✅ Healthy (27ms) |
| OpenAI (StoryScore + Story Adviser) | ✅ Healthy |
| Storage (Cloudflare R2) | ✅ Healthy |
| Stripe | ✅ Configured — live keys + real webhook secret |
| ElevenLabs (TTS) | ⚠️ Key updated today — confirming |

---

## What Was Completed This Week (Apr 1–6)

### Deployment
- App went live on Render April 1
- Resolved 6 separate build/startup failures through April 2 (Next.js 15 upgrade complications, Prisma client, database connection)
- Both web and orchestrator services stable

### All Environment Variables — Fully Set
Every key needed for production is now configured on Render:

| Service | Status |
|---------|--------|
| OpenAI | ✅ |
| ElevenLabs | ✅ |
| Anthropic (Claude) | ✅ |
| Google Gemini | ✅ |
| Stripe live keys | ✅ |
| Stripe webhook secret | ✅ Real signing secret set (Apr 6) |
| Cloudflare R2 storage | ✅ |
| Resend (transactional email) | ✅ |
| Redis (Upstash) | ✅ |
| Sentry (error tracking) | ✅ |
| All feature flags | ✅ All enabled |

### Stripe — Fully Wired
- Live Stripe account connected (dbbuilder account)
- Webhook endpoint active at `https://story-magic-web.onrender.com/api/stripe/webhook`
- All 11 subscription lifecycle events registered
- Real signing secret set on Render — webhook verification will work

---

## One Remaining Action for Ryan

### DNS (~15 minutes in GoDaddy)

Add these three records under **GoDaddy → DNS → storymagicapp.net**:

| Type | Host | Value |
|------|------|-------|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `app` | `story-magic-web.onrender.com` |

Then go to **Vercel → story-magic-marketing project → Settings → Domains** and add:
- `storymagicapp.net`
- `www.storymagicapp.net`

After propagation (up to 48 hours, usually faster):
- `https://storymagicapp.net` → marketing site
- `https://www.storymagicapp.net` → marketing site
- `https://app.storymagicapp.net` → the app

Once that's done, Chris will update `NEXT_PUBLIC_APP_URL` on Render to `https://app.storymagicapp.net`.

---

## Test Checklist for Ryan (after DNS propagates)

**Core pipeline:**
- [ ] Sign up for a new account at https://app.storymagicapp.net
- [ ] Upload a PDF screenplay (short test script is fine — any PDF)
- [ ] Wait for audio generation to complete
- [ ] Download the audio and confirm it plays
- [ ] Confirm StoryScore shows a score with breakdown
- [ ] Confirm Story Adviser shows feedback

**Impact StoryBuilder:**
- [ ] Go to https://app.storymagicapp.net/impact/stories/new
- [ ] Submit a short story (under 800 words, check the attestation box)
- [ ] Confirm audio generates and plays
- [ ] Confirm an email arrives at `info@servicevision.net` (all emails currently route there — testing mode is on)

**Stripe donations:**
- [ ] Complete a donation on an Impact story
- [ ] Use test card `4242 4242 4242 4242`, any future date, any CVC
- [ ] Confirm donation confirmation email arrives at `info@servicevision.net`

---

## After Testing — Next Steps

Once Ryan confirms everything works:

1. **Chris:** Turn off email testing mode so emails go to real recipients
2. **Chris + Ryan:** Apply for ElevenLabs, Google for Startups, and Anthropic startup grants (Impact StoryBuilder is a strong fit for all three)
3. **Ryan:** Switch to production Clerk keys before any public marketing (current keys are test mode, which can block signups in some regions)

---

## Quick Reference

| Resource | URL |
|----------|-----|
| Live app | https://story-magic-web.onrender.com |
| Marketing site | https://storymagic.servicevision.io |
| Health check | https://story-magic-web.onrender.com/api/health |
| Admin panel | https://story-magic-web.onrender.com/admin |
| GitHub | https://github.com/dbbuilder-org/story-magic |
