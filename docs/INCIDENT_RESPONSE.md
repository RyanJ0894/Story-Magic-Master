# Story Magic — Incident Response Runbook

**Version:** 1.0 (Stub)  
**Date:** 2026-04-25  
**Owner:** Engineering / Operations  
**Review cycle:** Quarterly

---

## Severity Definitions

| Severity | Definition | Response SLA | Examples |
|----------|-----------|-------------|---------|
| SEV-1 (Critical) | Production down; data breach confirmed or suspected; payment processing failure | 15 min acknowledge, 2 hr resolve | DB unreachable, Clerk auth down, confirmed data exfiltration |
| SEV-2 (High) | Significant feature broken; performance severely degraded; potential security issue | 1 hr acknowledge, 8 hr resolve | Generation pipeline failure, audio upload failing, rate limit bypass |
| SEV-3 (Medium) | Non-critical feature broken; minor data anomaly | 4 hr acknowledge, 24 hr resolve | Export PDF failing, suggestion panel error |
| SEV-4 (Low) | Cosmetic issue; minor UX bug | Next sprint | UI misalignment, wrong icon |

---

## Incident Response Process

### Phase 1: Detection (0–15 min)

- **Automated:** Checkly heartbeat alert → PagerDuty / Slack `#incidents`
- **Manual:** User report → Slack `#support` or GitHub issue
- **Self-detected:** Sentry error spike alert

Actions:
1. Acknowledge incident in Slack `#incidents`
2. Assign incident commander (IC)
3. Assess severity (use table above)
4. Open incident channel: `#inc-YYYY-MM-DD-<slug>`

### Phase 2: Triage (15–60 min)

1. Check Render dashboard: service health, deploy history
2. Check Sentry: error volume, first occurrence, stack trace
3. Check Checkly: which health check failed, when
4. Check PostgreSQL: connection count, query performance
5. Check Redis: queue depth, consumer lag
6. Check audit logs: any unusual access patterns

```bash
# Quick health check
curl https://story-magic.onrender.com/health
curl https://story-magic-orchestrator.onrender.com/health

# Recent errors
# → Sentry dashboard: sentry.io/organizations/story-magic/

# Render logs
# → Render dashboard → service → logs tab
```

### Phase 3: Containment

**Data breach suspected:**
1. Rotate `CLERK_SECRET_KEY` immediately → Render env vars
2. Rotate `DATABASE_URL` password if DB access suspected
3. Rotate `FIELD_ENCRYPTION_KEY` if script text access suspected (triggers re-encryption)
4. Invalidate all Clerk sessions: Clerk dashboard → Users → Revoke all sessions
5. Notify Ryan (client) within 1 hour

**Service outage:**
1. Check if last deploy caused the issue: Render → Deploy history → Roll back
2. If DB issue: Render → PostgreSQL → connection strings → verify `connection_limit`
3. If Redis issue: Upstash dashboard → check queue consumer

### Phase 4: Eradication

1. Identify root cause
2. Write fix or revert
3. Test in staging
4. Deploy to production

### Phase 5: Recovery

1. Verify `/health` endpoints return `{"status":"ok"}`
2. Verify Checkly tests pass
3. Generate one test audio (smoke test)
4. Monitor Sentry for 30 min post-deploy

### Phase 6: Post-Incident

**Within 24 hours:**
- Write incident report in `docs/incidents/YYYY-MM-DD-<slug>.md`

**Report template:**
```markdown
## Incident: <title>

**Date:** YYYY-MM-DD  
**Severity:** SEV-N  
**Duration:** X hours  
**Impact:** N users affected; <description>

### Timeline
- HH:MM: Incident detected via <source>
- HH:MM: IC assigned
- HH:MM: Root cause identified
- HH:MM: Fix deployed
- HH:MM: Recovery confirmed

### Root Cause
<technical description>

### Contributing Factors
<what made this worse or harder to detect>

### Resolution
<what was done to fix it>

### Preventive Actions
- [ ] <action> | Owner: <name> | Due: <date>
```

---

## Contact List

| Role | Name | Contact |
|------|------|---------|
| Client / Product Owner | Ryan | Contact via iMessage (stored in Claude memory) |
| Engineering Lead | Chris Therriault | chris@servicevision.net |

---

## Key Systems Access

| System | URL | Access |
|--------|-----|--------|
| Render dashboard | https://dashboard.render.com | `chris@servicevision.net` |
| Clerk dashboard | https://dashboard.clerk.com | `chris@servicevision.net` |
| Sentry | https://sentry.io | `chris@servicevision.net` |
| Checkly | https://app.checklyhq.com | `chris@servicevision.net` |
| Upstash | https://console.upstash.com | `chris@servicevision.net` |
| Supabase | https://supabase.com/dashboard | `chris@servicevision.net` |

---

## Data Breach Notification Requirements

| Regulation | Threshold | Notification Deadline | Recipient |
|-----------|----------|----------------------|-----------|
| GDPR | Any personal data breach | 72 hours | Supervisory authority + affected users |
| CCPA | Personal data breach | Expedient | California AG + affected users |
| SOC 2 | Material breach | Per contractual terms | Customers |

**Current status:** No formal breach notification process in place. Legal review required before SOC 2 Type II engagement.

---

*Last updated: 2026-04-25. See also: `docs/SOC2_CONTROLS.md`, `docs/DATA_FLOW.md`*
