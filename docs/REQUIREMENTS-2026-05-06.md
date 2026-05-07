# Story Magic — Product Requirements

**Date:** 2026-05-06
**Version:** v1.0.0-beta (pre-launch)
**Author:** Chris Therriault (chris@servicevision.net)
**Format:** Req ID | Feature | Priority | Planned Implementation | Status | Notes

> Legend: P0 = Must have (launch blocker) | P1 = High value (pre-launch) | P2 = Nice to have (post-launch)
> Status: COMPLETE | PARTIAL | NOT IMPL | DEFERRED | BLOCKED

---

## 1. Authentication & Identity

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| AUTH-1.1 | Email/password sign-up + sign-in | P0 | Clerk hosted UI | COMPLETE | |
| AUTH-1.2 | Google OAuth sign-in | P0 | Clerk social provider | COMPLETE | |
| AUTH-1.3 | Email verification gate | P1 | Clerk + `SETTING_KEYS.requireEmailVerification` toggle | COMPLETE | Toggle via Admin Settings |
| AUTH-1.4 | JWT-based session management | P0 | Clerk session tokens; 24h default, configurable | COMPLETE | |
| AUTH-1.5 | Clerk user → Profile sync | P0 | Webhook at `/api/webhooks/clerk` → `Profile` upsert | COMPLETE | |
| AUTH-1.6 | SSO callback routes | P1 | `/login/sso-callback`, `/signup/sso-callback` | COMPLETE | |
| AUTH-1.7 | Admin-only route guard | P0 | `isAdmin()` check in `withAdminAuth` middleware | COMPLETE | |
| AUTH-1.8 | Middleware route protection | P0 | `clerkMiddleware` in `packages/web/middleware.ts` | COMPLETE | |
| AUTH-1.9 | Enterprise SSO | P2 | Clerk Orgs + Teams | DEFERRED | Phase C |
| AUTH-1.10 | TOTP multi-factor auth | P1 | Clerk dashboard setting (Ryan action) | BLOCKED | Ryan must enable in Clerk dashboard |

---

## 2. Script Processing Pipeline

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| PIPE-2.1 | PDF script ingestion | P0 | `pdf-parse` → text extraction in orchestrator | COMPLETE | |
| PIPE-2.2 | 3-pass Director pipeline (parse → voice assign → validate) | P0 | `director/pipeline.ts`, LLM agents per pass | COMPLETE | Eliminates JSON truncation on long scripts |
| PIPE-2.3 | Character voice assignment | P0 | LLM agent + ElevenLabs voice catalog (80 voices) | COMPLETE | Gender/age/ethnicity inference |
| PIPE-2.4 | Music & ambience selection | P0 | Director Pass 2 — genre + mood + scene beat matching | COMPLETE | |
| PIPE-2.5 | Script chunked extraction (long-form) | P0 | `chunkScriptForScoring()` for >80K chars | COMPLETE | BL-06 shipped |
| PIPE-2.6 | Token budget enforcement | P1 | 90K token hard cap; configurable per tier | COMPLETE | Sprint 5 |
| PIPE-2.7 | Script size validation (page limits) | P1 | 120-page max (standard), 90-page safety cutoff | COMPLETE | Sprint 5 |
| PIPE-2.8 | Advanced Analysis (Claude Opus) | P1 | Opus 4.6 for Passes 1 + 3 on paid upgrade | COMPLETE | $9.99/project; server-side model selection only |
| PIPE-2.9 | TTS — ElevenLabs turbo model | P0 | `eleven_turbo_v2_5`, PCM 24kHz, 30s timeout | COMPLETE | perf(tts) commit 33ffc75 |
| PIPE-2.10 | TTS voice fallback on 404 | P1 | Fallback to Adam/Rachel when unknown voice | COMPLETE | |
| PIPE-2.11 | TTS mock mode | P1 | `ELEVENLABS_MOCK=true` — skips API, uses silence | COMPLETE | Dev/test only |
| PIPE-2.12 | Audio mixing + timeline | P0 | `orchestrator/pipeline.ts` — FFmpeg crossfades, LUFS normalisation | COMPLETE | -16 LUFS EBU R128 target |
| PIPE-2.13 | M4A output export | P0 | AAC 48kHz 192kbps via FFmpeg | COMPLETE | |
| PIPE-2.14 | Stem export (individual tracks) | P1 | `GET /stems/:id` + `/stems/:id/zip` + web proxy `/api/projects/[id]/export/stems` | COMPLETE | BL-08 shipped |
| PIPE-2.15 | Audio quality validation | P1 | `validateAudioQuality()` + EBU R128 loudness parsing | COMPLETE | BL-46 shipped; 27 tests |
| PIPE-2.16 | Mixer timeout guard | P1 | Configurable timeout; fails job cleanly on overrun | COMPLETE | Sprint 5 |
| PIPE-2.17 | Retry on Director re-parse | P1 | Skip director JSON re-parse if `directorJson` already set | COMPLETE | |
| PIPE-2.18 | Concurrent TTS with concurrency limit | P1 | `p-limit` in orchestrator worker | COMPLETE | perf(tts) |
| PIPE-2.19 | Scene-level audio regeneration | P2 | `POST /api/projects/[id]/regenerate-scene` | COMPLETE | |
| PIPE-2.20 | Preview generation | P2 | `POST /preview` orchestrator + `/api/preview` web proxy | COMPLETE | |
| PIPE-2.21 | Demo script generation | P2 | `POST /api/generate-demo-script` — seeded example | COMPLETE | |
| PIPE-2.22 | Fountain native parser | P1 | `orchestrator/src/director/parsers/fountain.ts` — spec-compliant `.fountain` → internal `ParsedScript` | NOT IMPL | Issue #33 |
| PIPE-2.23 | Final Draft (FDX) XML parser | P1 | `orchestrator/src/director/parsers/fdx.ts` — `.fdx` XML → `ParsedScript`; FD10/FD12 variant handling | NOT IMPL | Issue #33 |
| PIPE-2.24 | Director notes prompt injection | P1 | `director/pipeline.ts` Pass 1 — inject `project.directorNotes` as structured read-only context; sanitized | NOT IMPL | Issue #36 — prompt injection safety required |
| PIPE-2.25 | Emotion override in TTS | P2 | Apply `project.emotionOverrides` map before ElevenLabs TTS call; ElevenLabs v3 audio tags where supported | NOT IMPL | Issue #37 |

---

## 3. Projects

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| PROJ-3.1 | Project CRUD | P0 | `GET/POST/PATCH/DELETE /api/projects` + `[id]` | COMPLETE | |
| PROJ-3.2 | Script upload (PDF / plain text) | P0 | `POST /api/projects/upload` — multipart; IDOR-protected | COMPLETE | |
| PROJ-3.3 | Script generation trigger | P0 | `POST /api/generate` — queues job, returns jobId | COMPLETE | |
| PROJ-3.4 | Job status polling | P0 | `GET /api/jobs/[id]/status` — SSE-ready, rate-limited | COMPLETE | `loose` rate-limit tier |
| PROJ-3.5 | Job cancellation | P1 | `POST /api/jobs/[id]/cancel` | COMPLETE | |
| PROJ-3.6 | Run history with timestamps | P1 | Multiple runs per project; timestamps displayed in selector | COMPLETE | |
| PROJ-3.7 | Revision history | P1 | `GET/POST /api/projects/[id]/revisions`, diff via `[id]/compare` | COMPLETE | |
| PROJ-3.8 | Script revision compare | P1 | `GET /api/revisions/[id]/compare/[toId]` | COMPLETE | |
| PROJ-3.9 | Audio override controls | P1 | `PATCH /api/projects/[id]/audio-overrides` | COMPLETE | |
| PROJ-3.10 | Workflow mode toggle | P1 | `PATCH /api/projects/[id]/workflow-mode` | COMPLETE | |
| PROJ-3.11 | Project notes | P2 | `GET/POST /api/projects/[id]/notes` | COMPLETE | |
| PROJ-3.12 | Project deletion (HTTP DELETE) | P2 | Use `DELETE /api/projects/[id]` not POST | PARTIAL | Currently POST to /delete — TD-025 |
| PROJ-3.13 | Queue position display | P1 | `GET /api/jobs/[id]/position` | COMPLETE | |
| PROJ-3.14 | Queue status overview | P1 | `GET /api/queue/status` | COMPLETE | |

---

## 4. Audio & Playback

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| AUDIO-4.1 | Audio player on listen page | P0 | `packages/web/components/player/` | COMPLETE | Empty-array bug + isCompleted check fixed |
| AUDIO-4.2 | M4A/MP3 streaming | P0 | Cloudflare R2 signed URLs via audio proxy | COMPLETE | |
| AUDIO-4.3 | Audio preview on project page | P1 | `/app/api/audio-preview/[...path]` proxy | COMPLETE | CORP header set cross-origin |
| AUDIO-4.4 | Stem download (individual tracks) | P1 | `GET /api/projects/[id]/export/stems` → zip | COMPLETE | |
| AUDIO-4.5 | Scene-level script + audio sync | P2 | Director JSON drives timeline display | COMPLETE | |
| AUDIO-4.6 | Voice assignments UI | P1 | `PATCH /api/projects/[id]/voice-assignments` | COMPLETE | |
| AUDIO-4.7 | Voice persistence across runs | P1 | Voice assignments saved to DB; re-used on retry | COMPLETE | |
| AUDIO-4.8 | Voice catalog browser | P2 | `GET /api/voices` — 80 ElevenLabs voices | COMPLETE | |
| AUDIO-4.9 | Voice marketplace interest | P2 | `POST /api/voices` — waitlist interest capture | COMPLETE | Migration 0006 |

---

## 5. Billing & Plans

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| BILL-5.1 | Stripe Checkout (subscription) | P0 | `POST /api/stripe/checkout` → Stripe hosted page | COMPLETE | |
| BILL-5.2 | Stripe Customer Portal | P0 | `POST /api/stripe/portal` | COMPLETE | |
| BILL-5.3 | Stripe Webhook handler | P0 | `POST /api/stripe/webhook` — idempotent upsert | COMPLETE | Migration 0011 unique constraint |
| BILL-5.4 | Subscription model (Prisma) | P0 | `Subscription` table; `Usage` tracking | COMPLETE | |
| BILL-5.5 | Free / Pro / Enterprise plans | P0 | Tier gates via `lib/features/flags.ts` + `FeatureGate` | COMPLETE | |
| BILL-5.6 | Trial period (configurable) | P1 | Admin Settings `trial_days` → Stripe trial param | COMPLETE | Default 7 days |
| BILL-5.7 | Grace period on payment failure | P1 | Admin Settings `grace_period_days` | COMPLETE | Default 3 days |
| BILL-5.8 | Advanced Analysis add-on ($9.99) | P1 | `POST /api/projects/[id]/advanced-analysis` → Stripe Checkout | COMPLETE | Per-project; Claude Opus 4.6; idempotent webhook |
| BILL-5.9 | Enterprise direct upgrade | P1 | `POST /api/upgrade` + referral codes | COMPLETE | |
| BILL-5.10 | Referral code system | P2 | `GET /api/referral/upgrade` | COMPLETE | |
| BILL-5.11 | Stripe production keys | P0 | Doppler prd config; Ryan must migrate from DBBuilder account | BLOCKED | BK-003 — Ryan action |
| BILL-5.12 | Stripe webhook verification (events list) | P0 | `checkout.session.completed` in Stripe dashboard | BLOCKED | Ryan action in Stripe dashboard |
| BILL-5.13 | Donation flow (Impact) | P2 | `POST /api/stripe/donate` + `POST /api/stripe/webhook` impact path | COMPLETE | |
| BILL-5.14 | Purchase seed fixtures | P2 | Dev/test fixtures for `Purchase` model | NOT IMPL | BK-004 (~2 SP) |
| BILL-5.15 | Credit balance on Profile | P1 | `Profile.credits Int @default(0)` + `CreditTransaction` model; migration | NOT IMPL | Issue #34 |
| BILL-5.16 | Credit pack purchase (Stripe) | P1 | `POST /api/credits/purchase` → Stripe Checkout one-time payment; $9.99/20 credits | NOT IMPL | Issue #34 |
| BILL-5.17 | Credit deduction on generation | P1 | Atomic deduct in `POST /api/generate`; free tier gated; Pro/Enterprise bypass | NOT IMPL | Issue #34 |
| BILL-5.18 | Signup bonus credits | P2 | 3 credits added on new `Profile` creation | NOT IMPL | Issue #34 |

---

## 6. StoryScore & AI Intelligence

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| SCORE-6.1 | StoryScore analysis (per project) | P0 | `POST /api/projects/[id]/score` → Claude Sonnet 4.6 | COMPLETE | |
| SCORE-6.2 | StoryScore display on project page | P0 | `components/storyscore/` | COMPLETE | |
| SCORE-6.3 | Comparable scripts | P1 | `GET /api/projects/[id]/comparables` → pgvector similarity | COMPLETE | Requires OPENAI_API_KEY in prod |
| SCORE-6.4 | Suggestions (AI script improvement) | P1 | `GET/POST /api/projects/[id]/suggestions` | COMPLETE | |
| SCORE-6.5 | Suggestion rewrites | P1 | `POST /api/projects/[id]/suggestions/[id]/rewrite` | COMPLETE | |
| SCORE-6.6 | Rewrite modal (style selection) | P1 | `RewriteModal.tsx` | PARTIAL | Style preference not persisted — UX-004 |
| SCORE-6.7 | Story Adviser (4-step wizard) | P1 | `app/projects/[id]/adviser/page.tsx` + wizard UI | COMPLETE | Feature-flagged; `FF_STORY_ADVISER` must be enabled in Doppler prd |
| SCORE-6.8 | Story Adviser feature flag enable | P1 | `NEXT_PUBLIC_FF_STORY_ADVISER=true` in Doppler prd | BLOCKED | BK-001 — manual Doppler config |
| SCORE-6.9 | Corpus ingestion pipeline | P1 | `pnpm ingest:training && pnpm score:corpus` | BLOCKED | BK-002 — requires AI keys on Render |
| SCORE-6.10 | Script corpus admin UI | P1 | `/admin/corpus` — browse, populate, export CSV | COMPLETE | |
| SCORE-6.11 | Corpus CSV export | P2 | `GET /api/admin/corpus/export` | COMPLETE | |
| SCORE-6.12 | Admin corpus populate | P1 | `POST /api/admin/corpus/populate` | COMPLETE | |
| SCORE-6.13 | Script reviews | P2 | `GET/POST /api/projects/[id]/reviews` | COMPLETE | Migration 0009 |

---

## 7. Script Exchange & Writer Hub

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| EXCH-7.1 | Exchange marketplace browse | P2 | `GET /api/exchange` + `/app/exchange` | COMPLETE | Migration 0009 |
| EXCH-7.2 | Exchange listing page | P2 | `GET /api/exchange/[slug]` + `/app/exchange/[slug]` | COMPLETE | |
| EXCH-7.3 | Exchange listing submit | P2 | `POST /api/projects/[id]/exchange` | COMPLETE | |
| EXCH-7.4 | Exchange listing submit — success toast | P2 | Toast after form submit | NOT IMPL | UX-006 (~1 SP) |
| EXCH-7.5 | Writer public profile | P2 | `/app/writer/[writerId]` | COMPLETE | |
| EXCH-7.6 | Writer dashboard | P2 | `/app/writer/dashboard` | COMPLETE | |
| EXCH-7.7 | Writer subscription | P2 | `POST /api/writers/[id]/subscribe` | COMPLETE | |
| EXCH-7.8 | Reader library | P2 | `GET/POST/DELETE /api/reader/library` | COMPLETE | |
| EXCH-7.9 | Reader library — favorites | P2 | `POST /api/reader/library/[id]/favorite` | COMPLETE | |
| EXCH-7.10 | Reader library — position tracking | P2 | `PATCH /api/reader/library/[id]/position` | COMPLETE | |
| EXCH-7.11 | Reader upload (paid) | P2 | `POST /api/reader/upload/create-payment` + `process` | COMPLETE | |

---

## 8. Sharing & Collaboration

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| SHARE-8.1 | Create share link | P1 | `POST /api/shares` → `ScriptShare` + token | COMPLETE | |
| SHARE-8.2 | Share access by code | P1 | `GET /api/shares/access/[code]` | COMPLETE | |
| SHARE-8.3 | Share play tracking | P1 | `POST /api/shares/access/[code]/play` | COMPLETE | |
| SHARE-8.4 | Share modal (2-tab: Share + QR) | P1 | `components/dashboard/share-modal.tsx` | COMPLETE | Consolidated from 3 tabs (UX-007 fixed) |
| SHARE-8.5 | Share modal — existing shares list | P2 | Shows up to 5 active shares | COMPLETE | |
| SHARE-8.6 | Share modal — "View all" > 5 shares | P2 | Pagination/expand for > 5 active shares | NOT IMPL | UX-008 (~2 SP) |
| SHARE-8.7 | Share link short URL (`/s/[code]`) | P1 | `/app/s/[code]` → redirect to listen page | COMPLETE | |
| SHARE-8.8 | Share management (revoke) | P1 | `DELETE /api/shares/[shareId]` | COMPLETE | |
| SHARE-8.9 | Team creation | P2 | `POST /api/teams` | COMPLETE | |
| SHARE-8.10 | Team member management | P2 | `GET/POST /api/teams/[id]/members` | COMPLETE | |
| SHARE-8.11 | Team share (project access) | P2 | `POST /api/teams/share` | COMPLETE | Migration 0010 enterprise_activity_notes |
| SHARE-8.12 | Team activity log | P2 | `GET /api/teams/[id]/activity` | COMPLETE | |
| SHARE-8.13 | Invite by token | P1 | `GET/POST /api/invite/[token]` | COMPLETE | |
| SHARE-8.14 | Feedback modal (per project) | P2 | `PATCH /api/projects/[id]/feedback` | PARTIAL | 1.5s auto-close should be removed — UX-005 |
| SHARE-8.15 | ScriptShare scene index | P1 | `ScriptShare.sceneIndex Int?` + `sceneStartMs Int?`; migration | NOT IMPL | Issue #35 |
| SHARE-8.16 | Scene share URL generation | P1 | `POST /api/shares` accepts `{ sceneIndex?, sceneStartMs? }`; "Share scene" button per scene card | NOT IMPL | Issue #35 |
| SHARE-8.17 | Listen page scene seek | P1 | `?scene=N` param seeks player to `sceneStartMs` on mount; "Sharing: Scene N" banner | NOT IMPL | Issue #35 |

---

## 9. Impact StoryBuilder

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| IMPT-9.1 | Impact story creation (800-word cap) | P1 | `POST /api/impact/stories/produce` — auth-gated | COMPLETE | 24h rate limit |
| IMPT-9.2 | Impact story listing | P1 | `GET /api/impact/stories` | COMPLETE | |
| IMPT-9.3 | Impact story detail | P1 | `GET /api/impact/stories/[id]` | COMPLETE | |
| IMPT-9.4 | Impact story admin approval | P1 | `POST /api/admin/impact/stories/[id]/approve` | COMPLETE | |
| IMPT-9.5 | Impact story audio pipeline | P1 | Orchestrator M4A → Cloudflare R2 permanent URL | COMPLETE | |
| IMPT-9.6 | Impact story preview | P1 | `POST /api/impact/stories/preview` | COMPLETE | |
| IMPT-9.7 | Impact partners | P2 | `GET /api/impact/partners` | COMPLETE | |
| IMPT-9.8 | Impact donations (Stripe) | P2 | `POST /api/stripe/donate` + `ImpactDonation` model | COMPLETE | Migration 0005 |
| IMPT-9.9 | Monthly prize draw cron | P2 | `GET /api/cron/prize-draw` — `CRON_SECRET` gated | COMPLETE | |
| IMPT-9.10 | Impact transactional emails | P1 | 6 email types via Resend | COMPLETE | |
| IMPT-9.11 | Impact attestation gate | P1 | User must accept T&C before submitting | COMPLETE | |

---

## 10. Admin Panel

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| ADMIN-10.1 | Admin dashboard overview | P0 | `/admin` — stats + health | COMPLETE | |
| ADMIN-10.2 | User management (list/edit) | P0 | `GET/PATCH /api/admin/users` | COMPLETE | |
| ADMIN-10.3 | Subscription management | P0 | `GET/PATCH/DELETE /api/admin/subscriptions` | COMPLETE | |
| ADMIN-10.4 | Corpus management | P1 | `/admin/corpus` — populate, export, view | COMPLETE | |
| ADMIN-10.5 | Platform settings (collapsible) | P0 | `admin-settings-client.tsx` — 5 sections, all collapsible | COMPLETE | UX-002 fixed |
| ADMIN-10.6 | Audit log | P1 | `GET /api/admin/audit-logs` + `/admin/audit-log` | COMPLETE | |
| ADMIN-10.7 | Impact admin queue | P1 | `/admin/impact` — approve/reject stories | COMPLETE | |
| ADMIN-10.8 | Admin analytics | P1 | `/admin/analytics` | COMPLETE | |
| ADMIN-10.9 | Alert management | P2 | `GET/POST /api/alerts` + preferences | COMPLETE | |
| ADMIN-10.10 | Admin stats API | P1 | `GET /api/admin/stats` | COMPLETE | |

---

## 11. Marketing & Public Pages

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| MKT-11.1 | Marketing homepage | P0 | `/app/page.tsx` (main app) | COMPLETE | |
| MKT-11.2 | Pricing page | P0 | `/app/pricing` | COMPLETE | |
| MKT-11.3 | Enterprise landing page | P1 | `/app/enterprise` | COMPLETE | |
| MKT-11.4 | Enterprise plans comparison | P1 | `/app/enterprise-plans` | COMPLETE | |
| MKT-11.5 | How-to guide | P2 | `/app/guide` | COMPLETE | |
| MKT-11.6 | Privacy policy + Terms | P0 | `/app/privacy`, `/app/terms` | COMPLETE | |
| MKT-11.7 | Referral landing page | P2 | `/app/referral` | COMPLETE | |
| MKT-11.8 | Waitlist signup | P2 | `POST /api/waitlist` | COMPLETE | |
| MKT-11.9 | Docs API reference | P2 | `GET /api/docs` + `/app/docs` | COMPLETE | |

---

## 12. Infrastructure & Security

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| INFRA-12.1 | Render.com deployment (web + orchestrator) | P0 | `render.yaml` IaC | COMPLETE | Live at story-magic-web.onrender.com |
| INFRA-12.2 | Doppler secrets management | P0 | `story-magic/prd` — 44 secrets; `sync-doppler-to-render.sh` | COMPLETE | |
| INFRA-12.3 | DNS cutover | P0 | `app.storymagicapp.net` CNAME → Render | BLOCKED | Ryan/GoDaddy — last launch blocker |
| INFRA-12.4 | Sentry error monitoring | P1 | `@sentry/nextjs` + orchestrator Sentry client | COMPLETE | |
| INFRA-12.5 | Rate limiting (per-route tiers) | P0 | `packages/web/lib/ratelimit.ts` — tight/loose/api tiers | COMPLETE | |
| INFRA-12.6 | Clerk production keys | P0 | `pk_live_*` / `sk_live_*` — Ryan action | BLOCKED | Already in Doppler prd (Ryan confirmed May 2026) |
| INFRA-12.7 | Field encryption (AES-256-GCM) | P1 | `FIELD_ENCRYPTION_KEY` — script text at-rest encryption | COMPLETE | |
| INFRA-12.8 | IDOR protection on downloads | P0 | Path traversal + ownership check in download endpoint | COMPLETE | |
| INFRA-12.9 | CSP nonce headers | P0 | `next.config.ts` — nonce-based script-src | COMPLETE | BL-11 |
| INFRA-12.10 | CORS / CORP headers | P1 | `Cross-Origin-Resource-Policy: cross-origin` on audio routes | COMPLETE | |
| INFRA-12.11 | Checkly heartbeat monitors | P1 | Uptime checks on health endpoint | COMPLETE | |
| INFRA-12.12 | Connection pooling | P1 | 8 connections/service (16 total) vs 20-connection PG limit | COMPLETE | |
| INFRA-12.13 | TOTP enforcement (admin org) | P1 | Clerk dashboard: enable Authenticator app for admin org | BLOCKED | Ryan action |
| INFRA-12.14 | SOC 2 prep (audit logging) | P2 | `AuditLog` model; 7-year retention design | COMPLETE | Sprint 6-7 |
| INFRA-12.15 | Email testing mode | P1 | `EMAIL_TESTING_MODE=false` for real send | COMPLETE | Default true in dev |

---

## 13. Creative Direction & Performance (Competitive Sprint D)

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| CDIR-13.1 | Director Notes model | P1 | `Project.directorNotes Json?` — shape: `{ characters: { [name]: string }, global: string }` | NOT IMPL | Issue #36 |
| CDIR-13.2 | Director Notes API | P1 | `GET/PUT /api/projects/[id]/director-notes` — Clerk auth, ownership check | NOT IMPL | Issue #36 |
| CDIR-13.3 | Director Notes panel UI | P1 | Collapsible pre-generation panel; per-character + global notes; auto-save on blur | NOT IMPL | Issue #36 |
| CDIR-13.4 | Emotion overrides model | P2 | `Project.emotionOverrides Json?` — map `{ [dialogueId]: emotion }`; migration | NOT IMPL | Issue #37 |
| CDIR-13.5 | Emotion overrides API | P2 | `GET/PUT /api/projects/[id]/emotion-overrides` | NOT IMPL | Issue #37 |
| CDIR-13.6 | Performance direction panel UI | P2 | "Performance" tab; emotion Select per dialogue line; "Re-render scene" button per scene | NOT IMPL | Issue #37 |
| CDIR-13.7 | Fountain/FDX upload UI | P1 | File input `accept` extended; upload label updated; file type badge in project header | NOT IMPL | Issue #33 |

---

## 14. Distribution & Podcast (Competitive Sprint E)

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| DIST-14.1 | PodcastFeed model | P2 | `id`, `projectId` (unique), `episodeTitle`, `description`, `coverArtUrl?`, `rssFeedSlug` (unique), `published`, `publishedAt?`; migration | NOT IMPL | Issue #38 |
| DIST-14.2 | Podcast publish API | P2 | `POST /api/projects/[id]/podcast/publish` — creates feed; validates completed audio; sets R2 object to public-read | NOT IMPL | Issue #38 |
| DIST-14.3 | RSS 2.0 feed endpoint | P2 | `GET /listen/[code]/podcast.rss` — valid RSS XML with `<enclosure>` M4A URL, `<itunes:duration>` | NOT IMPL | Issue #38 |
| DIST-14.4 | Public podcast page | P2 | `/listen/[code]/podcast` — cover art, inline player, "Subscribe via RSS", "Add to Apple Podcasts" deep link | NOT IMPL | Issue #38 |
| DIST-14.5 | Publish podcast UI | P2 | "Publish as Podcast" button on completed project; publish modal with title/description/cover art | NOT IMPL | Issue #38 |

---

## 15. Gap Analysis

| Feature | Status | Gap | Impact | Resolution Plan | Target | Priority |
|---------|--------|-----|--------|-----------------|--------|---------|
| DNS cutover | BLOCKED | Ryan has not updated GoDaddy CNAME | App unreachable on custom domain | Ryan updates GoDaddy | Pre-launch | P0 |
| Stripe production keys | BLOCKED | Still on DBBuilder shared Stripe account | Revenue goes to wrong account | Ryan creates Story Magic Stripe, sends keys | Pre-launch | P0 |
| TOTP enforcement | BLOCKED | Clerk dashboard setting not applied | Admin accounts unprotected by MFA | Ryan enables in Clerk dashboard | Pre-launch | P1 |
| Story Adviser flag | BLOCKED | `NEXT_PUBLIC_FF_STORY_ADVISER` not set in Doppler prd | Feature hidden from users | Set flag in Doppler prd + sync to Render | Pre-launch | P1 |
| Corpus ingestion | BLOCKED | AI keys not confirmed on Render orchestrator | Comparables + StoryScore degraded | Verify OPENAI + ANTHROPIC keys, run `ingest:training` | Post-launch | P1 |
| Project delete verb | PARTIAL | Uses POST to /delete, not HTTP DELETE | Minor REST hygiene | Change to `DELETE /api/projects/[id]` | Sprint C | P2 |
| RewriteModal style persistence | PARTIAL | Style preference lost on close | UX friction for power users | `localStorage` save/restore | Sprint B | P2 |
| FeedbackModal auto-close | PARTIAL | 1.5s auto-close surprises users | User can't read feedback | Remove `setTimeout` auto-close | Sprint B | P2 |
| Exchange submit toast | NOT IMPL | No success confirmation after listing | User uncertainty | `useToast` after submit | Sprint B | P2 |
| Share modal "View all" | NOT IMPL | Truncated at 5 shares | Active sharers can't manage older links | Expand/paginate list | Sprint B | P2 |
| Purchase test fixtures | NOT IMPL | No dev fixtures for `Purchase` model | Billing tests need manual setup | Seed script for dev | Sprint C | P2 |

---

*Requirements baseline as of 2026-05-06 — v1.0.0-beta. 1,370 tests (862 web + 508 orchestrator), 0 TypeScript errors. 3 P0 external blockers remain (DNS, Stripe account, Stripe webhook). Updated 2026-05-07 with 19 new competitive REQ entries (Issues #33–#38). See ROADMAP-2026-05-07.md for sprint plan.*
