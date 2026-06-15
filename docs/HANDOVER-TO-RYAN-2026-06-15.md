# Story Magic — Handover Plan to Ryan's Accounts

**Date:** 2026-06-15
**Author:** Chris Therriault
**Purpose:** Move every production resource from DBBuilder-owned accounts onto accounts Ryan owns directly, so Story Magic is operable independently. Step-by-step per platform, ordered to minimize downtime.

---

## Current ownership snapshot

Everything below is currently under **DBBuilder Inc / Chris Therriault**. Some are shared with other client projects (Smart Streamer, Video Magic, U-Rent, FireProof, etc.) and need clean separation before transfer.

| Platform | What's hosted | Shared with other clients? | Transfer mechanism |
|---|---|---|---|
| **GitHub** | `dbbuilder-org/story-magic` repo | No (single repo) | Repo transfer or grant admin |
| **Render** | web, orch, worker services + Postgres DB + Redis + Blueprint | No (dedicated services) | Workspace invite/transfer |
| **Doppler** | `story-magic` project (dev/stg/prd configs, 91+ secrets) | No (dedicated project) | Project transfer |
| **Cloudflare** | `storymagicapp.net` zone + email routing + R2 buckets | Account-level shared | Domain/zone transfer + R2 bucket export-import |
| **Clerk** | Production app (auth domain `storymagicapp.net`) | No (dedicated app) | Transfer / app re-creation |
| **Stripe** | `acct_*` with live keys + 6 prices + 1 webhook | **YES — shared account** | Requires net-new Stripe account |
| **Sentry** | `servicevision.sentry.io/story-magic` project | Org shared with other clients | New org or sub-team |
| **ElevenLabs** | Grant-tier account `tier=grant_tier_2_2025_07_23` | No (Ryan's grant) | Already Ryan's |
| **OpenAI / Anthropic / Groq / Google** | API keys under DBBuilder billing | Some shared | New API keys on Ryan's accounts |
| **Resend** | `noreply@servicevision.io` from-address + API key | Shared | New Resend account + domain |
| **Checkly** | Heartbeat URLs | Shared | New Checkly account or share |
| **GitHub Actions** | CI workflows + secrets (CODECOV, etc.) | No (per-repo) | Transfers with repo |

**Total estimated effort:** ~6–8 hours of Ryan's time spread across two days + a 2-hour cutover window with both parties online.

---

## Suggested order

The path below is ordered so each step's dependencies are already done. Most disruptive items (DNS, Stripe, Clerk) come last and need a planned cutover window.

| Day | Step | Effort | Risk |
|---|---|---|---|
| 1 | 1. Ryan creates accounts everywhere (no traffic affected) | 1 h | None |
| 1 | 2. AI provider keys (OpenAI, Anthropic, Groq, Google) | 30 min | None |
| 1 | 3. Sentry org + project | 30 min | None — telemetry-only |
| 1 | 4. Resend domain verification | 1 h (DNS waits) | None |
| 1 | 5. Cloudflare R2 buckets (audio + voices) | 1 h | Medium — content migration |
| 2 | 6. GitHub repo transfer | 15 min | Low |
| 2 | 7. Render workspace + Postgres + Redis transfer | 1 h | Medium — DB connection strings change |
| 2 | 8. Doppler project transfer | 30 min | Low |
| 2 | 9. Clerk app re-creation | 1 h | High — auth flow break |
| 2 | 10. Stripe account separation | 1 h | High — payment flow break |
| 2 | 11. Cloudflare zone transfer + final DNS cutover | 1 h | High — site downtime if mis-sequenced |
| 2 | 12. Verification + UAT pass | 1 h | — |

---

## 1. Ryan creates accounts (no traffic affected)

Ryan needs admin-level accounts on each platform before anything moves. None of these affect production yet — pure prep.

```
[ ] GitHub: ryanjae@gmail.com (or company address) — generate a personal access token with `repo` + `admin:org` scopes if a Ryan-owned org will host the repo
[ ] Render: dashboard.render.com — create workspace "Story Magic" (or use existing)
[ ] Doppler: doppler.com — create workspace "Story Magic"
[ ] Cloudflare: dash.cloudflare.com — sign up under Ryan's email (free tier OK to start)
[ ] Clerk: clerk.com — sign up
[ ] Stripe: stripe.com — sign up. Will need EIN + bank account for live mode. Test mode works immediately.
[ ] Sentry: sentry.io — sign up (developer plan = $0 for 1 project)
[ ] Resend: resend.com — sign up
[ ] OpenAI: platform.openai.com — Ryan's existing account, generate new project + key
[ ] Anthropic: console.anthropic.com — sign up (or use existing)
[ ] Groq: console.groq.com — sign up (free tier covers Whisper API)
[ ] Google AI Studio: aistudio.google.com — sign up (free Gemini Flash tier)
[ ] Checkly: checklyhq.com — sign up (or skip; replaceable with UptimeRobot)
```

**Output of this step:** Ryan has dashboards open and verified emails on all 12 platforms.

---

## 2. AI provider keys — fastest path, no cutover

These can be swapped at any time via Doppler with **zero downtime** because the apps re-read env on each request. Best to do this early — gives Ryan first-hand cost visibility from day one.

### 2.1 OpenAI

Used for: GPT-4 / GPT-4.1 for scoring + adviser, text-embedding-3-small for audio search, Whisper API fallback.

```
[ ] platform.openai.com → Projects → New Project "Story Magic Production"
[ ] Add payment method (Ryan's card). Set spending limit to $50/mo initial cap.
[ ] API keys → Create new secret key, name "story-magic-prd". Copy.
[ ] In Doppler (story-magic / prd): set OPENAI_API_KEY to new value.
       doppler secrets set OPENAI_API_KEY=sk-proj-... --project story-magic --config prd
[ ] Wait for Render auto-sync (~1–2 min). Verify on /api/health that "openai" check is "healthy".
[ ] Delete the old DBBuilder OpenAI key from platform.openai.com after 24 h of green health checks.
```

### 2.2 Anthropic

Used for: Claude Sonnet 4.6 for production scoring, Haiku 4.5 for voice/audio director, prompt caching.

```
[ ] console.anthropic.com → Workspaces → create "Story Magic Production"
[ ] Add payment method (Ryan's card). Initial $50/mo limit.
[ ] API keys → Create key, name "story-magic-prd".
[ ] Doppler: doppler secrets set ANTHROPIC_API_KEY=sk-ant-... --project story-magic --config prd
[ ] Verify /api/health "anthropic" health (will be "healthy" within 2 min).
[ ] If applying for Anthropic's startup program ($1000/mo credit for ~12 months), use the same workspace.
```

### 2.3 Groq (Whisper API fallback)

Used for: Whisper alignment fallback when local whisper.cpp is unavailable.

```
[ ] console.groq.com → API Keys → Create
[ ] Doppler: doppler secrets set GROQ_API_KEY=gsk_... --project story-magic --config prd
[ ] No verification needed — alignment fallback is rarely used in prod (whisper-local is primary).
```

### 2.4 Google Generative AI (Gemini Flash)

Used for: corpus batch scoring (`pnpm score:corpus`).

```
[ ] aistudio.google.com → API Keys → Create
[ ] Doppler: doppler secrets set GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy... --project story-magic --config prd
[ ] Verification: only matters when corpus batch jobs run. Test via `pnpm score:corpus --dry-run` from local.
```

### 2.5 ElevenLabs

**This is already Ryan's** — the grant-tier account (`tier=grant_tier_2_2025_07_23`, 660 voice slots, 33M chars/period) belongs to him. No action needed; the key already in Doppler points to his account. **Document the key in Ryan's password manager** so DBBuilder can rotate the credentials.md entry off.

```
[ ] elevenlabs.io → Profile → API → rotate the key.
[ ] Doppler: doppler secrets set ELEVENLABS_API_KEY=sk_9069aa515... --project story-magic --config prd
[ ] DBBuilder removes the entry from ~/.config/claude/credentials.md
[ ] Verify orchestrator boot: /health.voiceCatalog should still show 137 active voices.
```

---

## 3. Sentry org + project

Risk: zero — error reporting is purely additive. Old project keeps receiving events until you flip the DSN.

```
[ ] sentry.io → New Organization → "Story Magic"
[ ] Create project: "story-magic-web" (Next.js platform)
[ ] Create project: "story-magic-orchestrator" (Node.js platform)
[ ] Get DSN from each: Project Settings → Client Keys (DSN)
[ ] Generate Auth Token: User → Account → API → Auth Tokens
     scopes: project:read + project:write + project:releases + org:read
[ ] Doppler: 
       doppler secrets set SENTRY_DSN="https://<key>@<host>.ingest.sentry.io/<id>" --project story-magic --config prd
       doppler secrets set SENTRY_AUTH_TOKEN="sntrys_..." --project story-magic --config prd
       doppler secrets set SENTRY_ORG=story-magic --project story-magic --config prd
       doppler secrets set NEXT_PUBLIC_SENTRY_DSN=<same-DSN> --project story-magic --config prd
[ ] Render: native sync propagates within 1–2 min. Verify by triggering a test error and watching it land in new org.
[ ] After 7 days of confirmed new-org events, deactivate the old servicevision.sentry.io/story-magic project.
```

---

## 4. Resend domain verification

Risk: medium — outbound email (notifications, share invites, talent invites) breaks if cutover is misordered.

### 4.1 New Resend account

```
[ ] resend.com → sign up as Ryan
[ ] Domains → Add Domain → "storymagicapp.net"
[ ] Resend shows 3 DNS records (TXT for SPF, CNAME for DKIM, MX optional)
[ ] Add records via Cloudflare DNS (storymagicapp.net zone — still DBBuilder-owned at this point; Chris adds for now)
[ ] Wait for Resend to mark domain "Verified" (5–30 min after DNS propagates)
[ ] API Keys → Create — name "story-magic-prd", scope "sending access"
[ ] Doppler: doppler secrets set RESEND_API_KEY=re_... --project story-magic --config prd
       doppler secrets set RESEND_FROM_ADDRESS="Story Magic <noreply@storymagicapp.net>" --project story-magic --config prd
[ ] Test: send yourself a test email via /api/admin/test-email (route exists for this)
```

### 4.2 Talent address

The `talent@storymagicapp.net` address is Cloudflare email-routed → `info@servicevision.io`. After domain transfer, repoint to Ryan's preferred mailbox.

```
[ ] Cloudflare → storymagicapp.net → Email → Email Routing
[ ] Change destination for talent@ from info@servicevision.io to ryan's preferred address
[ ] Send a test from external — verify forwarding works
```

---

## 5. Cloudflare R2 buckets

Two buckets currently:
- `story-magic-voices` — voice clone audio (read-heavy, served via R2 public URL)
- `story-magic-impact-audio` — impact-feature audio (read-only catalog)

Plus the audio output bucket (Render disk + S3 mirror).

Risk: medium — content needs to migrate; URL paths embedded in DB rows for voice clones.

### 5.1 Create new R2 buckets under Ryan's Cloudflare account

```
[ ] Ryan's Cloudflare → R2 → Create Bucket → "story-magic-voices"
[ ] Create Bucket → "story-magic-impact-audio"
[ ] For each, enable Public Access if currently public
[ ] Generate R2 API tokens for each bucket: R2 → Manage R2 API Tokens → Create
     scope: Object Read & Write for both buckets
[ ] Capture: Account ID, Access Key ID, Secret Access Key, public URL
```

### 5.2 Copy content with rclone

```bash
# Install rclone if needed (brew install rclone)

# Configure source (DBBuilder R2) and destination (Ryan R2) — interactive
rclone config

# Then sync each bucket
rclone sync source-r2:story-magic-voices ryan-r2:story-magic-voices --progress
rclone sync source-r2:story-magic-impact-audio ryan-r2:story-magic-impact-audio --progress

# Verify counts match
rclone size source-r2:story-magic-voices
rclone size ryan-r2:story-magic-voices
```

### 5.3 Cut over env vars

```
[ ] Doppler:
       doppler secrets set R2_ACCOUNT_ID=<new> --project story-magic --config prd
       doppler secrets set R2_ACCESS_KEY_ID=<new> --project story-magic --config prd
       doppler secrets set R2_SECRET_ACCESS_KEY=<new> --project story-magic --config prd
       doppler secrets set R2_BUCKET_NAME=story-magic-impact-audio --project story-magic --config prd
       doppler secrets set R2_PUBLIC_URL=<new-public-url> --project story-magic --config prd
       doppler secrets set R2_VOICES_ACCOUNT_ID=<new> --project story-magic --config prd
       doppler secrets set R2_VOICES_ACCESS_KEY_ID=<new> --project story-magic --config prd
       doppler secrets set R2_VOICES_SECRET_ACCESS_KEY=<new> --project story-magic --config prd
       doppler secrets set R2_VOICES_BUCKET_NAME=story-magic-voices --project story-magic --config prd
[ ] Verify a new voice clone uploads + plays back successfully.
[ ] After 7 days, delete content from old DBBuilder R2 buckets.
```

### 5.4 R2 public URL — domain implications

If the public URL is a `*.r2.dev` subdomain it just works. If it's been mapped to a custom domain (e.g., `audio.storymagicapp.net`), that mapping needs to move with the zone (see step 11).

---

## 6. GitHub repo transfer

```
[ ] github.com/dbbuilder-org/story-magic → Settings → Transfer
[ ] Destination: Ryan's GitHub username or his organization
[ ] Ryan accepts the transfer notification on his end
[ ] GitHub auto-creates a redirect from old URL — won't break anything immediately
[ ] Local git remotes: each developer runs:
       git remote set-url origin git@github.com:<ryan-handle>/story-magic.git
[ ] Update Render: Settings → Build & Deploy → Repository → reconnect to new URL
       (this needs to happen BEFORE further commits or Render won't auto-deploy)
[ ] Update Doppler integration GitHub App if used
[ ] Update any external links: README badges, Sentry releases integration, etc.
```

GitHub Actions secrets transfer with the repo. CI continues to work without intervention.

---

## 7. Render workspace + Postgres + Redis transfer

This is the most involved step. Render has a workspace-transfer API but it doesn't move databases — those need explicit migration.

### 7.1 Workspace invite (simplest path)

If acceptable, the easiest version of "transfer" is to **add Ryan as Admin on the existing DBBuilder Render workspace**, then later remove DBBuilder members. This avoids DB migration entirely.

```
[ ] Render → Workspace Settings → Members → Invite Ryan as Admin
[ ] Ryan accepts invite
[ ] Skip to step 8 (Doppler)
```

### 7.2 True transfer (Ryan's own workspace)

If Ryan wants services entirely under his own Render workspace, you need to recreate services and migrate the DB. Roughly 2 hours of work + DNS propagation.

```
[ ] Ryan's Render workspace → New Postgres → "story-magic-db"
     plan: basic-256mb (matches current) — $7/mo
[ ] Run pg_dump on the current DB:
       PGPASSWORD=<current-pw> pg_dump -h <current-host> -p 5432 -U <current-user> -d <current-db> \
         --format=custom --no-owner --no-acl -f story-magic-db-backup.dump
[ ] Restore to new DB:
       PGPASSWORD=<new-pw> pg_restore -h <new-host> -p 5432 -U <new-user> -d <new-db> \
         --no-owner --no-acl story-magic-db-backup.dump
[ ] Verify row counts match across critical tables:
       SELECT 'projects', count(*) FROM projects
       UNION SELECT 'jobs', count(*) FROM jobs
       UNION SELECT 'subscriptions', count(*) FROM subscriptions
       UNION SELECT 'profiles', count(*) FROM profiles;
[ ] Create New Redis "story-magic-redis" in Ryan's workspace (starter plan, $0)
[ ] Create New Blueprint or manually create the three services (web, orchestrator, worker)
     using the same render.yaml from this repo
[ ] Update Doppler DATABASE_URL + REDIS_URL to the new internal hostnames
[ ] Render's Doppler→Render native sync pushes the new URLs in 1–2 min
[ ] Wait for all three services to come live on new DB
[ ] Sanity test: log in to app, view a project, verify data is intact
[ ] Suspend old DBBuilder services
[ ] After 7 days of confirmed operation, delete old services + DB
```

**Recommendation: start with 7.1 (workspace invite). Do 7.2 later if/when Ryan wants billing separation.**

---

## 8. Doppler project transfer

Doppler supports workspace transfer natively.

```
[ ] Doppler (DBBuilder workspace) → Projects → story-magic → Settings → Transfer
[ ] Destination: Ryan's Doppler workspace
[ ] Ryan accepts in his workspace
[ ] All secrets + Render native sync integrations move with the project
[ ] DBBuilder is removed as collaborator automatically (or manually remove)
[ ] Verify Render sync still works: change a non-critical env value and watch Render redeploy
```

If Ryan doesn't want a Doppler subscription ($), the alternative is to set all 91 secrets directly on Render's dashboard — labor-intensive and loses the audit trail. **Recommend Doppler Team plan, $7/user/mo.**

---

## 9. Clerk app re-creation

Clerk does NOT support app transfer. You must create a fresh app on Ryan's account and migrate users.

### 9.1 Create new Clerk app

```
[ ] clerk.com (Ryan's account) → Create Application "Story Magic"
[ ] Plan: Free tier covers ≤10K MAU. Upgrade later if needed.
[ ] Configure providers (Google sign-in, email/password — match current setup)
[ ] Configure paths (matches current):
       Sign-in URL: /login
       Sign-up URL: /sign-up
       Fallback redirect after sign-in: /dashboard
       Fallback redirect after sign-up: /dashboard
[ ] Verify the production domain: storymagicapp.net (DNS records will need updating in CF; see step 11)
[ ] Capture: Publishable Key, Secret Key, Webhook Signing Secret
```

### 9.2 Migrate users

Clerk's user-export → user-import flow:

```
[ ] Old Clerk dashboard → Users → Export → CSV
[ ] New Clerk dashboard → Users → Import → upload CSV
[ ] Clerk preserves emails + Google sign-in linkage if those are configured the same
[ ] Users with password sign-in will need to reset password on first login (Clerk doesn't export password hashes)
[ ] All Story Magic users are Google-sign-in based, so this is non-disruptive
```

### 9.3 Cut over

```
[ ] Doppler:
       doppler secrets set CLERK_SECRET_KEY=sk_live_... --project story-magic --config prd
       doppler secrets set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... --project story-magic --config prd
       doppler secrets set CLERK_WEBHOOK_SECRET=whsec_... --project story-magic --config prd
[ ] Update Clerk webhook URL in new Clerk dashboard to: https://app.storymagicapp.net/api/webhooks/clerk
[ ] Render redeploy triggered automatically
[ ] Verify: log out and log back in with a Google account — should succeed
[ ] After 7 days of green logins, deactivate the old Clerk app
```

---

## 10. Stripe account separation

**This is genuinely complex.** Stripe doesn't allow account transfer. The current account is DBBuilder's (`acct_*`) and is shared with Smart Streamer + Video Magic. You need a new Stripe account for Ryan and migrate just the Story Magic pieces.

### 10.1 Ryan creates new Stripe account

```
[ ] stripe.com → Create account
[ ] Activate live mode: requires business name, EIN (or SSN if sole proprietor), bank account
[ ] Approval: 1–3 business days
[ ] During wait, Test mode is fully functional — can do walkthrough in test mode
```

### 10.2 Re-create products + prices

```
[ ] Stripe → Products → Create:
       - Creator (matches DBBuilder's "story-magic-creator")
       - Pro     
       - Studio
[ ] For each, create Monthly + Yearly prices matching the current amounts
       (read from old Stripe: stripe prices list --account <old> --product <prod>)
[ ] Capture new price IDs:
       STRIPE_PRICE_CREATOR_MONTHLY=price_1...
       STRIPE_PRICE_CREATOR_YEARLY=price_1...
       STRIPE_PRICE_PRO_MONTHLY=...
       STRIPE_PRICE_PRO_YEARLY=...
       STRIPE_PRICE_STUDIO_MONTHLY=...
       STRIPE_PRICE_STUDIO_YEARLY=...
```

### 10.3 Webhook endpoint

```
[ ] Stripe → Developers → Webhooks → Add endpoint
       URL: https://app.storymagicapp.net/api/webhooks/stripe
       Events: customer.subscription.*, invoice.*, checkout.session.completed, charge.*
[ ] Copy the signing secret: whsec_...
```

### 10.4 Existing subscribers — the hard part

Live subscribers cannot be auto-transferred. Options:

**Option A (clean, customer-facing):** email all subscribers, cancel old subscriptions, ask them to re-subscribe via the new prices. Refund any prorated amounts. ~30 customers maximum at this stage; manageable.

**Option B (silent, finance-only):** keep the old account active just for legacy subscription billing. New signups flow to Ryan's account. Eventually attrit through cancellations.

**Recommend Option B** since:
- Friendly cohort hasn't subscribed yet (still in test mode)
- Live mode has never been exercised end-to-end (per memory + the open GTM walkthrough task)
- Zero migration risk if no live subscribers exist

### 10.5 Cut over env vars

```
[ ] Doppler:
       doppler secrets set STRIPE_SECRET_KEY=sk_live_<ryan-account>... --project story-magic --config prd
       doppler secrets set STRIPE_WEBHOOK_SECRET=whsec_<new>... --project story-magic --config prd
       doppler secrets set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<ryan>... --project story-magic --config prd
       doppler secrets set STRIPE_PRICE_CREATOR_MONTHLY=price_<new> --project story-magic --config prd
       (and the 5 other STRIPE_PRICE_* vars)
[ ] Render redeploys
[ ] Verify: hit /billing/checkout?plan=creator → Stripe checkout opens with new account branding
[ ] Run Chris's live-mode walkthrough (docs/STRIPE-LIVE-WALKTHROUGH-2026-06-13.md) on new account
```

---

## 11. Cloudflare zone transfer + DNS

Risk: **highest of all steps.** Misordered DNS = site down. Do this last after every other piece is verified working.

### 11.1 Two options

**Option A — full zone transfer.** Cloudflare supports this if Ryan has a Cloudflare account:

```
[ ] DBBuilder Cloudflare → storymagicapp.net → Settings → Transfer (or contact CF support for assistance)
[ ] Ryan accepts the transfer in his account
[ ] All DNS records, page rules, R2 custom domain mappings, email routing config move automatically
[ ] No DNS propagation needed — same nameservers
```

**Option B — registrar-level transfer (if zone transfer isn't available).** Move the registration to Ryan's preferred registrar (Namecheap, Google Domains, etc.), then re-add to Ryan's Cloudflare:

```
[ ] Get auth code from current registrar (DBBuilder side)
[ ] Initiate transfer at Ryan's chosen registrar
[ ] Wait for 5-7 day transfer window
[ ] Once transferred, add zone to Ryan's Cloudflare
[ ] Manually re-create DNS records (export DBBuilder's CF zone first as JSON)
[ ] Update nameservers at the new registrar to Cloudflare's nameservers
[ ] Wait 24-48h for global DNS propagation
```

**Strongly recommend Option A.**

### 11.2 Validate

```
[ ] dig storymagicapp.net @1.1.1.1 — should still resolve to Render's CNAME target
[ ] dig www.storymagicapp.net — should resolve to story-magic-web.onrender.com
[ ] dig app.storymagicapp.net (Clerk apex) — should resolve to Clerk's frontendApi target
[ ] dig _dmarc.storymagicapp.net, _domainkey.* — Resend DKIM should still resolve
[ ] curl https://app.storymagicapp.net/api/health — should return JSON status:healthy
```

---

## 12. Verification + UAT pass

```
[ ] Run docs/UAT-2026-06-14.md — at least P0 and P1 test cases
[ ] Sign up a fresh user end-to-end (Google sign-in)
[ ] Create a project, upload a 3-page script, generate audio
[ ] Subscribe to Creator tier — Stripe checkout, real card or test card, depending on which account
[ ] Verify Sentry receives a test error (sign in with a deliberately bad URL → 404 → captured?)
[ ] Verify email notifications: test the share-invite + generation-complete flows
[ ] Check /api/admin/manifest — should report new build commit + new envHash
```

---

## Sequencing checklist (master)

Copy this into a Linear / Trello / GitHub issue and check off as you go:

```
[ ] 1.  Ryan creates accounts on all 12 platforms
[ ] 2.  AI provider keys rotated in Doppler (OpenAI, Anthropic, Groq, Google)
[ ] 3.  Sentry new org + project + DSN updated in Doppler
[ ] 4.  Resend new domain verified + RESEND_API_KEY updated
[ ] 5.  Cloudflare R2 buckets created + content synced + env updated
[ ] 6.  GitHub repo transferred + Render reconnected to new URL
[ ] 7.  Render — either workspace invite (fast) or full DB migration (clean)
[ ] 8.  Doppler project transferred to Ryan's workspace
[ ] 9.  Clerk new app created + users imported + DSN updated in Doppler
[ ] 10. Stripe new account live + products/prices re-created + env updated
[ ] 11. Cloudflare zone transferred to Ryan's account
[ ] 12. UAT pass + decommission DBBuilder-side resources after 7-day grace
```

---

## Gotchas worth flagging up front

1. **Stripe shared account is the trickiest piece.** Plan ahead: Ryan needs to start his Stripe account verification ~3 business days before cutover (live-mode activation takes time).
2. **Don't transfer the GitHub repo before reconnecting Render.** Render will fail to auto-deploy on the next commit if the repo URL changes without dashboard intervention.
3. **R2 public URLs are mapped to the bucket UUID by default.** If you've mapped a custom domain (e.g., `audio.storymagicapp.net`) to the bucket, that mapping must move with the zone, OR you need to re-map after the zone moves. Easy to miss; results in 404s on every audio file.
4. **Clerk's user-import doesn't migrate password hashes.** Anyone using email/password sign-in (not Google) will need to reset. Story Magic doesn't have email/password sign-in enabled today, so this is moot — but if it ever changes, plan around it.
5. **The Doppler→Render native sync is per-service.** Each service has its own sync configuration. If you replicate services into a new Render workspace, re-establish the sync per-service before flipping env values.
6. **Backups before any destructive step.** Always:
   - Render DB: pg_dump before any DB-touching cutover
   - Render env: GET /env-vars before any PUT
   - Doppler: export project before transfer (`doppler secrets download --format json > backup.json`)
7. **Stripe webhook secret cannot be retrieved after creation.** Capture it at creation time; if lost, you must delete + re-create the webhook endpoint.

---

## After successful handover

1. **Document the new ownership** in `~/.config/claude/credentials.md` (or whatever Ryan uses) so future Claude sessions reference his accounts, not DBBuilder's.
2. **Decommission DBBuilder-side resources** after 7 days of confirmed operation on Ryan's accounts:
   - Old Render services: suspend, then delete after 30 days
   - Old DB: drop after backup retained for 30 days
   - Old Doppler project: archive
   - Old Sentry project: deactivate
   - Old Clerk app: deactivate
   - Old Cloudflare zone: only delete after zone transfer is confirmed
   - Old AI keys: revoke
3. **Update README + CLAUDE.md** in the repo with the new dashboards/URLs/contact info.
4. **Update the credentials.md template** — story-magic entries point to Ryan.
5. **Hand Ryan the runbooks** in `docs/` so he can operate without Chris in the loop:
   - `docs/QUEUE-WORKER-SPLIT-RUNBOOK-2026-06-14.md`
   - `docs/STRIPE-LIVE-WALKTHROUGH-2026-06-13.md`
   - `docs/CLOUDFLARE-RENDER-525-PRIMER-2026-06-13.md`
   - `docs/ROADMAP-2026-06-14.md`
   - `docs/REQUIREMENTS-2026-06-14.md`
   - `docs/UAT-2026-06-14.md`

---

*Single source of truth for the resource handover. Each step is independently verifiable; if anything breaks, you can roll back the env vars to DBBuilder-owned values via the splice-and-PUT pattern in `/render-env` skill.*
