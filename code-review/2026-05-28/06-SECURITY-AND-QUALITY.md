# Security and Quality — 2026-05-28

## Security Items Fixed This Session

| Item | Fix |
|------|-----|
| 5 console.log calls logging audio URLs and invite token prefixes to browser console | Removed — no longer leaks internal state to enterprise clients' devtools |

## Carried-Forward Security Items (from prior reviews)

### MEDIUM — Invite-accept TOCTOU (DT-27-2)
Duplicate alert fire risk on concurrent accepts. Rate-limited; low blast radius. Fix: serializable transaction around `findFirst` + `update` in new-member branch. Tracked in 08-DATA-TIERS.md. **Sprint B.**

## New Schema Security / Quality Items

### MEDIUM — `subscriptions.user_id` unindexed FK
Billing plan-check queries full-scan the `subscriptions` table. Migration `0029` adds `subscriptions_user_id_idx`. **Applied this session in schema; pending DB apply.**

### LOW — Redundant indexes on `Usage` and `Subscription`
`usage_user_id_period_idx` and `subscriptions_stripe_subscription_id_idx` both duplicate existing unique-constraint indexes. Migration `0029` drops them. Reduces index maintenance overhead.

### LOW — Orchestrator schema missing 8 columns (DT-28-4)
Running `prisma db push` from `packages/orchestrator/` would attempt to DROP those 8 columns from the production database. No runtime risk — orchestrator never queries them. Needs a prominent WARNING comment added. **Sprint B.**

## Quality Items

### console.log in `env.ts` (startup config dump)
`packages/orchestrator/src/lib/env.ts:167–179` logs configuration at startup. These are intentional startup-time visibility logs (not request-path), and they fire once at boot, not in hot paths. Acceptable as-is — Render logs capture them. No action needed.

### CSRF warning in test output
`console.warn('CSRF validation failed: origin https://malicious-site.com ...')` appears in test output 4 times. This is the CSRF test suite exercising the security boundary correctly. The `console.warn` at `lib/csrf.ts:65` is intentional — it is a security event log. No action needed.

## No-Issue Areas (verified clean)

- Helmet.js security headers: enabled in orchestrator (`src/index.ts`)
- Clerk JWT verification: all protected routes use `clerkMiddleware` (`web/middleware.ts`)
- IDOR protection on download endpoint: `path.basename` + ownership check maintained
- Rate limiting: Upstash Redis-backed rate limit on all sensitive endpoints
- RLS: No Supabase-managed tables with user data found (auth is Clerk, storage only for files)
- XSS: No `dangerouslySetInnerHTML` without `xss` or equivalent found in delta files
- CSRF: token-based validation in `lib/csrf.ts` covering non-GET routes
