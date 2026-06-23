# Runbook — Doppler secret changes without redeploy storms

**Last updated:** 2026-06-22
**Owner:** Chris Therriault
**Audience:** anyone changing secrets in Doppler for the `story-magic` project

## The problem

Our Doppler → Render native sync (live since 2026-06-09) auto-redeploys every Render service that consumes a config the moment a secret changes there. **Each `doppler secrets set` call is a separate sync event** — even when changing many keys in immediate succession. Sequential calls trigger sequential redeploys.

On 2026-06-22 we set four R2 keys (`AWS_S3_BUCKET`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `AWS_S3_PUBLIC_URL`) one at a time. Result: **3 back-to-back redeploys of `story-magic-web-dev`, 4 of `story-magic-orchestrator-dev`, 2 of `story-magic-worker-dev`** in 17 minutes. During each cutover, user requests `524`d at the Cloudflare edge — Ryan hit this twice in one session.

Render starter-plan single-instance services have an unavoidable ~1–2 min cutover window during deploys. Stacking redeploys multiplies that window.

## The rule

**One change-set = one `doppler secrets set` call.**

✅ Right — single sync event, single redeploy per consuming service:
```bash
doppler secrets set \
  AWS_S3_BUCKET=story-magic-audio-dev \
  R2_BUCKET_NAME=story-magic-audio-dev \
  R2_PUBLIC_URL=https://pub-xxx.r2.dev \
  AWS_S3_PUBLIC_URL=https://pub-xxx.r2.dev \
  --project story-magic --config dev --silent
```

❌ Wrong — N sync events, N redeploys per service:
```bash
doppler secrets set AWS_S3_BUCKET=story-magic-audio-dev --project story-magic --config dev
doppler secrets set R2_BUCKET_NAME=story-magic-audio-dev --project story-magic --config dev
doppler secrets set R2_PUBLIC_URL=https://pub-xxx.r2.dev --project story-magic --config dev
doppler secrets set AWS_S3_PUBLIC_URL=https://pub-xxx.r2.dev --project story-magic --config dev
```

## Why `--silent`

Skips the post-write summary table that scrolls the terminal. Doesn't affect the sync at all.

## How to confirm only one redeploy was triggered

```bash
RENDER_KEY=$(grep -oE 'rnd_[A-Za-z0-9]+' ~/.config/claude/credentials.md | head -1)

# Web-dev
curl -s "https://api.render.com/v1/services/srv-d8kc3suq1p3s73fdt4v0/deploys?limit=4" \
  -H "Authorization: Bearer $RENDER_KEY" \
  | python3 -c "
import json, sys
for d in json.load(sys.stdin):
    dep = d['deploy']
    print(f\"{dep['status']:14} {dep['createdAt']}\")
"
```

If you see one `live` and zero new entries created in the minute after your `doppler secrets set` call, you did it right. If you see 2+ recent `created`/`build_in_progress` entries spaced seconds apart, you batched wrong.

## Render dev service IDs

| Service | ID |
|---|---|
| `story-magic-web-dev` | `srv-d8kc3suq1p3s73fdt4v0` |
| `story-magic-orchestrator-dev` | `srv-d8kc3q6q1p3s73fdt1mg` |
| `story-magic-worker-dev` | `srv-d8rpsgpo3t8c73ed2hr0` |

## When you genuinely need multiple change-sets

If you must change secrets in separate calls (e.g. you're computing values from API responses between calls), **wait for each redeploy to land** before triggering the next:

```bash
# Set first batch
doppler secrets set K1=v1 K2=v2 --project story-magic --config dev --silent

# Wait for web-dev to come back live (check the deploys API or curl /health)
until curl -fsS https://dev.storymagicapp.net/api/health > /dev/null; do sleep 10; done

# Now safe to set the next batch
doppler secrets set K3=v3 --project story-magic --config dev --silent
```

## Out of scope

- **Render plan upgrade for zero-downtime deploys** — separate cost decision; not addressed here.
- **Disabling auto-redeploy on the sync** — we *want* secret changes to redeploy. We just don't want them to redeploy six times.
- **Batching across configs** — `dev` and `prd` are separate Doppler configs and separate Render services. Changing `dev` does not redeploy `prd`. The batching rule applies *per config*.

## Related

- Issue #369 (this runbook)
- Issue #368 / PR #370 — client-side retry to absorb the cutover window when batching slips
- Memory: `reference_doppler_render_sync_api.md` — endpoint details for the integration itself
