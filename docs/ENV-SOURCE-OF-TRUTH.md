# Environment Variable Source of Truth

**Status:** Authoritative as of 2026-06-13 (H3 of the hardening sprint)

---

## TL;DR

> **Doppler is the source of truth for environment variables in this project.**
> Edit env vars in the Doppler dashboard; the Doppler→Render native sync
> propagates them to the services and triggers a redeploy automatically.
> Do NOT add env vars to `render.yaml`, the Render service dashboard, or
> a hand-edited `.env.local` in prod.

---

## Why

Today's incident summary: today we shipped 11 production hotfixes in 24h.
Two of them traced to **env config drift across three places**:

1. The whisper.cpp install was specified in `render.yaml`'s `buildCommand`
   block — but Render does **not** auto-sync `render.yaml` to a running
   service after the initial provision. The service kept running the old
   `buildCommand` for weeks while we thought the new one was active.
2. We had `OPENAI_API_KEY` set in Doppler, but the value in production
   was exhausted before anyone noticed because the dashboards showing the
   key being "set" don't show the *current account state*.

The root cause is **multiple sources of truth for env config**: `render.yaml`,
Doppler, and per-service Render-dashboard overrides. Each can drift. Trying
to keep three lockstep across 12 vendor integrations × 3 environments
(dev/stg/prd) × 2 services is not realistic for the team size.

---

## The rule

| Setting | Source of truth |
|---|---|
| App env vars (API keys, URLs, secrets) | **Doppler** (`story-magic` project, `dev`/`stg`/`prd` configs) |
| `buildCommand` / `startCommand` | **Render service dashboard** (NOT render.yaml after initial provision) |
| Service resources (plan, region, disks, num instances) | `render.yaml` (one-time bootstrap, or Render dashboard) |
| Doppler→Render sync configuration | Doppler integration page (one-time setup) |

`render.yaml` exists for **initial provision only**. After a service is
created, it's frozen — read-only documentation, not operational config.

---

## How to change an env var in prod

1. Go to the Doppler dashboard:
   - **Production:** https://dashboard.doppler.com/workplace/projects/story-magic/configs/prd
2. Edit the variable
3. Save
4. Doppler→Render sync triggers a redeploy on the affected service(s) within ~30s
5. Watch the new deploy go live in the Render dashboard

**Do NOT:**
- Edit `render.yaml` in the repo to add env vars (the sync will overwrite)
- Edit the Render service dashboard's env-vars panel directly (Doppler will overwrite on next sync)
- Edit `.env.local` on a deployed service (it doesn't exist there)

---

## How to change a build command

Build commands changed today (whisper.cpp install) revealed that `render.yaml`
buildCommand changes do NOT propagate to existing services. The workflow:

1. Edit `buildCommand` directly in the Render service dashboard:
   - **Web:** https://dashboard.render.com/web/srv-d5mmo2emcj7s73c6ffs0/settings
   - **Orchestrator:** https://dashboard.render.com/web/srv-d5mmo2emcj7s73c6ffr0/settings
2. Save → triggers a new deploy automatically
3. Update `render.yaml` in the repo to reflect the same command (documentation
   for the next time someone has to provision a fresh service)

The CI lint added by H3 (see `scripts/check-env-source.js`) blocks PRs
that add `envVars:` blocks to `render.yaml` — that's a no-op in
production and would mislead a future contributor.

---

## How to verify what's actually in prod right now

H8 added a manifest endpoint:

```bash
curl -H 'Authorization: Bearer <admin clerk session>' \
  https://www.storymagicapp.net/api/admin/manifest | jq
```

Returns the commit, deploy time, and env-presence map for both services,
plus a `drift` block that flips true if web and orchestrator are on
different commits.

---

## Drift detection

The H8 manifest's `drift.commitMismatch` flag catches the most common
"web is on one commit, orch is on another" failure. Set up a weekly
Checkly probe to alert if it stays true for >10 min (a real deploy is
done in under that).

---

## Open exception: `.env.local` for local dev

Local development reads from `.env.local` at the repo root or per-package.
This file:
- Is gitignored
- Should mirror Doppler's `dev` config
- Can be re-generated from Doppler via `doppler secrets download --no-file --format env > .env.local`

This is the ONLY place .env files are valid. Production never uses them.

---

## CI enforcement

`scripts/check-env-source.js` runs on every PR. It fails the CI build if
`render.yaml` is modified to:
- Add a new `envVars:` block
- Change a `buildCommand:` (changes must be made in the Render service
  dashboard first, then mirrored in render.yaml for documentation)

To bypass intentionally (e.g., when bootstrapping a brand new service that
DOES need the initial buildCommand in render.yaml), add the line:

```
# h3-env-source-of-truth-allowed
```

immediately above the change. Reviewers should confirm this is a new-service
bootstrap, not an attempted edit to an existing one.
