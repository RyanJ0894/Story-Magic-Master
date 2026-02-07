# Story Magic Deployment Runbook

**Last Updated:** February 7, 2026

---

## Table of Contents

1. [Staging Deployment](#1-staging-deployment)
2. [Production Deployment](#2-production-deployment)
3. [Post-Deployment Verification](#3-post-deployment-verification)
4. [Rollback Procedures](#4-rollback-procedures)
5. [Monitoring & Alerting](#5-monitoring--alerting)
6. [Incident Response](#6-incident-response)

---

## 1. Staging Deployment

### Prerequisites
- [ ] Render.com account with organization access
- [ ] All environment variables documented (see `.env.local` for reference)
- [ ] `staging` branch exists and is up-to-date with `main`
- [ ] Supabase project configured (same project, staging uses same DB)

### Steps

```bash
# 1. Ensure staging branch is current
git checkout staging
git merge main
git push origin staging

# 2. Deploy via Render Dashboard
#    - Import render-staging.yaml as Blueprint
#    - Or: Render Dashboard → New → Blueprint → Connect repo → Select staging branch

# 3. Configure environment variables in Render Dashboard
#    (Do NOT commit secrets to render-staging.yaml)
#    Required env vars per service — see .env.local for values:
```

**Web (story-magic-web-staging):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ORCHESTRATOR_URL=https://story-magic-orchestrator-staging.onrender.com
SENTRY_DSN
SENTRY_AUTH_TOKEN
NEXT_PUBLIC_APP_URL=https://story-magic-web-staging.onrender.com
```

**Orchestrator (story-magic-orchestrator-staging):**
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
ELEVENLABS_API_KEY
GROQ_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CHECKLY_PING_URL
SENTRY_DSN
WEB_URL=https://story-magic-web-staging.onrender.com
TTS_CONCURRENCY=4
LOG_LEVEL=debug
NODE_ENV=production
AUDIO_OUTPUT_DIR=/var/data/audio
```

```bash
# 4. Verify deployment
./scripts/smoke-test.sh --staging

# 5. Check logs
render logs --service story-magic-web-staging --tail
render logs --service story-magic-orchestrator-staging --tail
```

### Staging Verification Checklist
- [ ] Web responds at staging URL
- [ ] Orchestrator /health returns 200 with `status: ok`
- [ ] Can sign up / log in
- [ ] Can create a project
- [ ] Can generate audio (orchestrator accepts request)
- [ ] Sentry receives test error
- [ ] Stripe webhook endpoint registered for staging URL

---

## 2. Production Deployment

### Prerequisites
- [ ] All staging verification checks pass
- [ ] Smoke test passes on staging
- [ ] No critical Sentry errors in staging
- [ ] DNS configured (if custom domain)

### Steps

```bash
# 1. Ensure main branch is deployment-ready
git checkout main
git pull origin main

# 2. Tag the release
git tag -a v1.0.0 -m "MVP 1.0 production release"
git push origin v1.0.0

# 3. Deploy via Render Dashboard
#    - Import render.yaml as Blueprint (production)
#    - Configure all env vars (same as staging but with production values)
#    - Enable auto-deploy from main branch

# 4. DNS Configuration (if custom domain)
#    - Add CNAME record: www.storymagicapp.net → story-magic-web.onrender.com
#    - Add CNAME record: api.storymagicapp.net → story-magic-orchestrator.onrender.com
#    - Or use Render's custom domain settings

# 5. SSL Verification
#    - Render provides automatic SSL via Let's Encrypt
#    - Verify HTTPS works: curl -I https://www.storymagicapp.net

# 6. Stripe Production Setup
#    - Switch to live Stripe keys (sk_live_*, pk_live_*)
#    - Register production webhook URL
#    - Verify webhook signing secret
```

### Production Verification
```bash
./scripts/smoke-test.sh --production
```

- [ ] Web loads at production URL
- [ ] HTTPS active with valid certificate
- [ ] HSTS header present
- [ ] Orchestrator /health returns 200
- [ ] Auth flow works (signup → login → dashboard)
- [ ] Stripe checkout completes with test card (then switch to live)
- [ ] Audio generation works end-to-end
- [ ] Sentry receiving errors
- [ ] Checkly monitoring active

---

## 3. Post-Deployment Verification

### Health Checks (run every 5 minutes via Checkly)
- Orchestrator: `GET /health` → 200
- Web: `GET /` → 200

### Manual Verification (run after each deploy)
1. Load landing page — verify content renders
2. Sign up with test email
3. Create project, paste sample script
4. Click generate — verify job starts
5. Check Sentry for any new errors
6. Check Render logs for errors

### Monitoring Dashboard Locations
- **Sentry:** https://sentry.io/organizations/servicevision/
- **Render:** https://dashboard.render.com/
- **Checkly:** https://app.checklyhq.com/
- **Stripe:** https://dashboard.stripe.com/

---

## 4. Rollback Procedures

### Quick Rollback (< 5 minutes)
```bash
# Rollback to previous deploy in Render Dashboard
# Dashboard → Service → Deploys → Click previous deploy → "Rollback to this deploy"
```

### Git Rollback
```bash
# Revert the problematic commit
git revert HEAD
git push origin main
# Render auto-deploys from main
```

### Database Rollback
```sql
-- Supabase migrations are forward-only
-- For critical issues, restore from Supabase point-in-time recovery
-- Dashboard → Project → Settings → Database → Point in Time Recovery
```

### Emergency: Full Service Stop
```bash
# Suspend services in Render Dashboard
# Dashboard → Service → Settings → Suspend Service
```

---

## 5. Monitoring & Alerting

### Error Budget
- Target: 99.9% uptime (43 minutes downtime/month)
- Alert threshold: >1% error rate over 5 minutes

### Key Metrics to Watch
| Metric | Source | Threshold |
|--------|--------|-----------|
| Error rate | Sentry | < 1% |
| Response time (p95) | Render metrics | < 2s |
| Memory usage | /health endpoint | < 80% of plan limit |
| Disk usage | /health endpoint | < 80% of disk limit |
| Failed jobs | Supabase jobs table | Alert on > 3 consecutive failures |

### Alert Channels
- Sentry → Email alerts to team
- Checkly → Email + Slack (configure in Checkly dashboard)
- Render → Built-in deploy notifications

---

## 6. Incident Response

### Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|---------------|---------|
| SEV1 | Service down, all users affected | 15 min | Web/orchestrator unreachable |
| SEV2 | Major feature broken | 1 hour | Audio generation failing |
| SEV3 | Minor feature broken | 4 hours | Admin dashboard data stale |
| SEV4 | Cosmetic/minor | Next business day | UI alignment issue |

### SEV1 Playbook
1. Acknowledge in team channel
2. Check Render dashboard for deploy status
3. Check Sentry for error spike
4. If recent deploy: rollback immediately
5. If infrastructure: check Render status page
6. Communicate status to affected users
7. Post-incident review within 24 hours

### Useful Commands
```bash
# Check service health
curl -s https://story-magic-orchestrator.onrender.com/health | jq .

# Check recent Sentry errors
# → Go to https://sentry.io/organizations/servicevision/issues/

# Check Render logs
# → Dashboard → Service → Logs

# Check Supabase for failed jobs
# → Dashboard → Table Editor → jobs → Filter: status = 'failed'
```
