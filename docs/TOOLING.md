# Production Tooling Guide

This document outlines the recommended tools for production readiness across observability, monitoring, and reliability.

---

## 1. Error Tracking: Sentry

**Status:** Ready for integration
**DSN:** `https://b06f55eedd1ad8fdedc4cabc42c48c12@o4510606462550016.ingest.us.sentry.io/4510733770948608`

### Installation

**Web (Next.js):**
```bash
cd packages/web
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Orchestrator (Node.js):**
```bash
cd packages/orchestrator
pnpm add @sentry/node
```

### Configuration

**packages/web/sentry.client.config.ts:**
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://b06f55eedd1ad8fdedc4cabc42c48c12@o4510606462550016.ingest.us.sentry.io/4510733770948608',
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

**packages/orchestrator/src/lib/sentry.ts:**
```typescript
import * as Sentry from '@sentry/node';

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || 'https://b06f55eedd1ad8fdedc4cabc42c48c12@o4510606462550016.ingest.us.sentry.io/4510733770948608',
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });
}
```

### Key Features
- Automatic error capture
- Performance monitoring
- Session replay (web)
- Release tracking
- User context for debugging

---

## 2. Structured Logging: Pino

**Status:** Recommended for all services
**Why Pino:** Fastest Node.js logger, JSON output, low overhead

### Installation

```bash
cd packages/orchestrator
pnpm add pino pino-http pino-pretty
```

### Configuration

**packages/orchestrator/src/lib/logger.ts:**
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: {
    service: 'orchestrator',
    version: process.env.npm_package_version,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export const requestLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
      requestId: req.headers['x-request-id'],
    });
  });
  next();
};
```

### Usage
```typescript
import { logger } from './lib/logger.js';

logger.info({ projectId: 'abc123' }, 'Starting generation');
logger.error({ err, projectId }, 'Generation failed');
```

---

## 3. Uptime Monitoring: Checkly

**Status:** Recommended for production
**Why Checkly:** Playwright-based monitoring, API checks, alerting

### Setup

1. Create account at https://www.checklyhq.com/	
2. Install CLI:
```bash
npm install -g checkly
```

3. Create `checkly.config.ts`:
```typescript
import { defineConfig } from 'checkly';

export default defineConfig({
  projectName: 'Story Magic',
  logicalId: 'story-magic',
  checks: {
    frequency: 5, // Every 5 minutes
    locations: ['us-east-1', 'eu-west-1'],
    runtimeId: '2024.02',
    browserChecks: {
      testMatch: 'e2e/**/*.check.ts',
    },
  },
});
```

### API Health Check

**checkly/api-health.check.ts:**
```typescript
import { ApiCheck, Frequency } from 'checkly/constructs';

new ApiCheck('orchestrator-health', {
  name: 'Orchestrator API Health',
  request: {
    method: 'GET',
    url: '{{ORCHESTRATOR_URL}}/health',
  },
  assertions: [
    { source: 'STATUS_CODE', comparison: 'EQUALS', target: '200' },
    { source: 'RESPONSE_TIME', comparison: 'LESS_THAN', target: '2000' },
  ],
  frequency: Frequency.EVERY_5M,
});
```

### Alternative: BetterStack (simpler)

If Checkly is too complex, consider **BetterStack** (formerly BetterUptime):
- Simple uptime monitoring
- Incident management
- Status pages
- Free tier available

---

## 4. Log Aggregation: Options

### Option A: Render.com Built-in (Simplest)

If deploying on Render, use their built-in log streaming:
- Automatic capture of stdout/stderr
- Log search and filtering
- No additional setup required

### Option B: Logtail (Recommended for Production)

**Why Logtail:** Good free tier, fast search, Pino integration

```bash
pnpm add @logtail/pino
```

```typescript
import { Logtail } from '@logtail/pino';
import pino from 'pino';

const logtail = new Logtail(process.env.LOGTAIL_TOKEN);
const logger = pino(logtail);
```

### Option C: Papertrail

Legacy option, works well for simple setups:
```bash
# Add to render.yaml or docker-compose
LOG_DESTINATION: "logs.papertrailapp.com:PORT"
```

---

## 5. APM (Application Performance Monitoring)

### Option A: Sentry Performance (Recommended - Already Integrated)

If using Sentry for errors, enable performance monitoring:
```typescript
Sentry.init({
  // ...
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0, // For CPU profiling
});
```

### Option B: New Relic (Enterprise)

Better for larger deployments:
```bash
pnpm add newrelic
```

Create `newrelic.js` in project root.

---

## 6. Rate Limiting

### Upstash Redis (Serverless Rate Limiting)

**Why Upstash:** Serverless Redis, perfect for rate limiting, generous free tier

```bash
pnpm add @upstash/redis @upstash/ratelimit
```

**packages/orchestrator/src/middleware/rate-limit.ts:**
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
});

export async function rateLimitMiddleware(req: any, res: any, next: any) {
  const userId = req.user?.id || req.ip;
  const { success, limit, reset, remaining } = await ratelimit.limit(userId);

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);

  if (!success) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
}
```

---

## 7. CI/CD: GitHub Actions

**Status:** Required for production

**`.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Type check
        run: pnpm --filter @story-magic/web typecheck

      - name: Lint
        run: pnpm --filter @story-magic/web lint

      - name: Unit tests
        run: pnpm --filter @story-magic/orchestrator test

      - name: Build
        run: pnpm --filter @story-magic/web build

  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm --filter @story-magic/web exec playwright install --with-deps

      - name: Run E2E tests
        run: pnpm --filter @story-magic/web test:e2e
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:22000
```

---

## 8. Summary of Recommended Tools

| Category | Tool | Priority | Cost |
|----------|------|----------|------|
| Error Tracking | Sentry | P0 | Free tier → $29/mo |
| Logging | Pino | P0 | Free |
| Log Aggregation | Logtail | P1 | Free tier → $25/mo |
| Uptime Monitoring | Checkly or BetterStack | P1 | Free tier → $29/mo |
| Rate Limiting | Upstash Redis | P1 | Free tier → $10/mo |
| APM | Sentry Performance | P2 | Included with Sentry |
| CI/CD | GitHub Actions | P0 | Free for public repos |

### Total Monthly Cost (Production)

| Tier | Monthly Cost |
|------|--------------|
| Minimal (free tiers) | $0 |
| Standard | ~$50-100 |
| Growth | ~$200-300 |

---

## 9. Environment Variables

Add these to your environment configuration:

```bash
# Sentry
SENTRY_DSN=https://b06f55eedd1ad8fdedc4cabc42c48c12@o4510606462550016.ingest.us.sentry.io/4510733770948608
SENTRY_AUTH_TOKEN=<from sentry dashboard>

# Logtail (optional)
LOGTAIL_TOKEN=<from logtail dashboard>

# Upstash Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=https://huge-finch-40198.upstash.io
UPSTASH_REDIS_REST_TOKEN=AZ0GAAIncDExODA3M2QzNDNmNGE0OTI0YjY3MDcwOWJlOGNjMWE4OXAxNDAxOTg

# Checkly
CHECKLY_PING_URL=https://ping.checklyhq.com/a1a3f468-b4d8-4328-968c-548962424c1d
```

---

## 10. Implementation Order

1. **Week 1 (Critical):**
   - [x] Add data-testid attributes
   - [ ] Set up Playwright E2E infrastructure
   - [ ] Configure Sentry error tracking
   - [ ] Set up GitHub Actions CI

2. **Week 2 (High Priority):**
   - [ ] Add Pino structured logging
   - [ ] Implement rate limiting with Upstash
   - [ ] Set up Checkly/BetterStack monitoring

3. **Week 3 (Important):**
   - [ ] Configure log aggregation (Logtail)
   - [ ] Enable Sentry performance monitoring
   - [ ] Create status page
