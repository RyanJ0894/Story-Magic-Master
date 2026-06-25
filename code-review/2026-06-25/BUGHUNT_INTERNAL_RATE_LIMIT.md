# Bug hunt — Issue 2: internal /orchestrate rate limit fails 50-scene jobs

## Root cause

**`x-ratelimit-limit: 3` is OUR limit.** It's `strictRateLimitMiddleware` from `packages/orchestrator/src/middleware/rate-limit.ts:330` — a strict-tier `RateLimiterRedis` configured at L194 with `points: 3, duration: 60` (three requests per 60 seconds). The same middleware is wired onto **`/orchestrate`, `/generate-scenes`, `/stitch-segments`, `/preview`** at `index.ts:132–136`.

### Why every internal call shares ONE bucket

The bucket identifier at `rate-limit.ts:337`:
```ts
const identifier = req.user?.id || req.ip || 'anonymous';
```

`serviceAuthMiddleware` at `auth.ts:150–171` **does not set `req.user`** when the `x-service-key` matches — it just calls `next()`. So:

1. Web → orchestrator with `x-service-key: <secret>` → service auth passes, `req.user` stays `undefined`
2. `strictRateLimitMiddleware` falls through to `req.ip` — the web service's single Render egress IP
3. **All users globally share one 3 req/min bucket** on every expensive route

The user's log confirms: `x-service-key: [Redacted]` is present, the call IS authenticated as internal, but the rate limit still fires.

### Why the user's job died at chunks 6–7

A 50-scene job in 7-scene chunks = ~7 sequential `/orchestrate` calls within seconds. Strict limit allows 3/min. Chunks 4+ are guaranteed 429 unless the previous chunk took >20 s elapsed (window stays full for 60 s on the 3rd request).

## Web-side retry is broken for 429

`packages/web/lib/orchestrator-fetch.ts:104–179` retries on retryable status, but:

- **Defaults to `retries = 2`** (3 attempts total) — L112
- **Hardcoded exponential delay**: `retryBaseDelayMs * Math.pow(2, attempt - 1)` = 1000ms, 2000ms — L168
- **`Retry-After` header is NEVER parsed.** The 429 body says `retryAfter: 60`, the orchestrator sets `Retry-After: 60` (rate-limit.ts:292), but `orchestratorFetch` waits 2000ms and gives up.

User's log proves it: `"retrying in 2000ms"` then immediately `chunk failed` despite the body's `retryAfter: 60`.

## Recommendation (do not fix yet — confirming approach)

### Orchestrator-side — exempt service-authenticated calls

Two equivalent shapes. Pick one:

**A. Set `req.user` in `serviceAuthMiddleware`** (auth.ts:164):
```ts
if (serviceKey === expectedKey) {
  req.user = { id: 'service:web', email: undefined };
  return next();
}
```
This routes the bucket to a stable, service-scoped identifier instead of the shared IP, but still caps at 3/min globally — only buys clarity, not throughput.

**B. Bypass the limit when service-authenticated** (rate-limit.ts:330, top of `strictRateLimitMiddleware`):
```ts
if (req.headers['x-service-key'] === process.env.SERVICE_SECRET_KEY) return next();
```
This is the correct fix. Rate-limiting exists to protect against external abuse; the web service IS the trusted caller. Internal traffic should be capacity-managed by the queue + connection pool, not by a 3/min limit designed for anonymous DDOS.

(`/analyze` uses the `normal` 10/min limit — same fix applies there.)

### Web-side — honor `Retry-After`

In `orchestrator-fetch.ts:167`:
```ts
const retryAfterHeader = response.headers.get('retry-after');
const serverDelay = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 0;
const backoff = retryBaseDelayMs * Math.pow(2, attempt - 1);
const delay = Math.min(Math.max(serverDelay, backoff), 90_000); // cap 90s
```

Also bump `retries = 4` for chunk calls so a 60s Retry-After can actually succeed within a job's lifetime.

### Bonus

The Pino response log shows `responseTime: 1ms` — the rate limit fires *before* any of the orchestrator's pipeline work runs. That's correct; just calling it out so the fix doesn't introduce surprising new latency.
