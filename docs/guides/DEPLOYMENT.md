# Deployment Guide

> Production deployment instructions for Story Magic

## Overview

Story Magic is deployed as a consolidated TypeScript service with the following components:

| Component | Platform | URL |
|-----------|----------|-----|
| Orchestrator API | Render.com | `https://api.storymagic.ai` |
| Web Frontend | Vercel | `https://storymagic.ai` |
| Database | Supabase | Managed PostgreSQL |
| Storage | Supabase | Managed object storage |

---

## Prerequisites

### Required Accounts

1. **Render.com** - API hosting
2. **Vercel** - Frontend hosting
3. **Supabase** - Database and storage
4. **OpenAI** - LLM provider
5. **ElevenLabs** - TTS provider

### Required API Keys

```bash
# LLM
OPENAI_API_KEY=sk-...

# TTS
ELEVENLABS_API_KEY=...

# Database
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Orchestrator Deployment (Render.com)

### 1. Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:

| Setting | Value |
|---------|-------|
| Name | `story-magic-orchestrator` |
| Root Directory | `packages/orchestrator` |
| Runtime | Node |
| Build Command | `pnpm install && pnpm build` |
| Start Command | `pnpm start` |
| Instance Type | Standard (2GB RAM minimum) |

### 2. Environment Variables

Add the following in Render's Environment tab:

```bash
NODE_ENV=production
PORT=22002

# LLM
OPENAI_API_KEY=sk-...

# TTS
ELEVENLABS_API_KEY=...

# Database
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional: Whisper
# WHISPER_CPP_PATH=/opt/whisper/main
# WHISPER_MODEL_PATH=/opt/whisper/models/ggml-base.en.bin
```

### 3. Health Check

Configure health check:
- **Path:** `/health`
- **Period:** 30 seconds
- **Timeout:** 10 seconds

### 4. Custom Domain

1. Add custom domain: `api.storymagic.ai`
2. Configure DNS CNAME record
3. Enable auto-renew SSL

---

## Frontend Deployment (Vercel)

### 1. Create Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import from GitHub
4. Configure:

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `packages/web` |
| Build Command | `pnpm build` |
| Output Directory | `.next` |

### 2. Environment Variables

Add in Vercel's Environment Variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://api.storymagic.ai

# Server-side only
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Custom Domain

1. Add domain: `storymagic.ai`
2. Configure DNS records as shown
3. SSL is automatic

---

## Database Setup (Supabase)

### 1. Create Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Configure region (closest to users)

### 2. Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref <project-id>

# Run migrations
supabase db push
```

### 3. Storage Buckets

Create the following storage buckets:

```sql
-- Audio output bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true);

-- TTS stems bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('stems', 'stems', false);
```

### 4. Row Level Security

Ensure RLS policies are configured:

```sql
-- Allow authenticated users to read their own projects
CREATE POLICY "Users can view own projects"
ON projects FOR SELECT
USING (auth.uid() = user_id);

-- Allow public read of audio bucket
CREATE POLICY "Public audio access"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio');
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
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
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm test

  deploy-api:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Render
        env:
          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
          RENDER_SERVICE_ID: ${{ secrets.RENDER_SERVICE_ID }}
        run: |
          curl -X POST "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" \
            -H "Authorization: Bearer $RENDER_API_KEY"

  deploy-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: packages/web
```

---

## Monitoring

### Health Checks

The `/health` endpoint returns:

```json
{
  "status": "healthy",
  "service": "story-magic-orchestrator",
  "version": "1.0.0",
  "timestamp": "2026-01-18T12:00:00.000Z"
}
```

### Logging

Logs are available in:
- **Render:** Dashboard → Service → Logs
- **Vercel:** Dashboard → Project → Logs
- **Supabase:** Dashboard → Database → Logs

### Error Tracking (Optional)

Add Sentry for error tracking:

```bash
# Environment variable
SENTRY_DSN=https://...
```

```typescript
// src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## Scaling

### Horizontal Scaling

Render.com supports auto-scaling:

1. Go to Service Settings
2. Enable "Auto-Scale"
3. Configure:
   - Min instances: 1
   - Max instances: 5
   - Target CPU: 70%

### Performance Tuning

| Setting | Development | Production |
|---------|-------------|------------|
| TTS Concurrency | 2 | 4 |
| LLM Timeout | 60s | 120s |
| Mix Timeout | 120s | 300s |

---

## Rollback

### Render.com

1. Go to Events tab
2. Find previous successful deploy
3. Click "Rollback to this deploy"

### Vercel

1. Go to Deployments tab
2. Find previous deployment
3. Click "..." → "Promote to Production"

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 503 Service Unavailable | Service starting | Wait 30-60 seconds |
| TTS failures | ElevenLabs rate limit | Reduce concurrency |
| Long generation times | Large script | Implement chunking |
| Database connection errors | Pool exhausted | Increase pool size |

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
DEBUG=story-magic:*
```

### Health Check Failures

If health checks fail:

1. Check service logs for errors
2. Verify environment variables
3. Test database connectivity
4. Verify external API keys

---

## Security Checklist

Before production deployment:

- [ ] All API keys in environment variables (not in code)
- [ ] HTTPS enforced on all endpoints
- [ ] Rate limiting enabled
- [ ] CORS configured for allowed origins
- [ ] Database RLS policies active
- [ ] Service accounts use minimal permissions
- [ ] Logs don't contain sensitive data
- [ ] Error messages don't expose internals
