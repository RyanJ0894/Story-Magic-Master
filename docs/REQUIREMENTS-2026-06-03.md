# Story Magic — Product Requirements

**Date:** 2026-06-03
**Version:** v3.3.0 (Sprint C remediation complete)
**Author:** Chris Therriault (chris@servicevision.net)
**Format:** Req ID | Feature | Priority | Planned Implementation | Status | Notes
**Supersedes:** `docs/REQUIREMENTS-2026-05-27.md`

> Legend: P0 = Must have (launch blocker) | P1 = High value (pre-launch) | P2 = Nice to have (post-launch)
> Status: COMPLETE | PARTIAL | NOT IMPL | DEFERRED | BLOCKED
>
> **Since 2026-05-27:** Enterprise platform (tier gating, multi-team, master/sub-account, admin
> provisioning), Sprint C remediation (TOCTOU fix, GDPR cascades, subscriptions sync, content-log
> retention, Doppler native CLI). Sentry monitoring COMPLETE. Section 24 (Enterprise Platform) NEW.
> All prior sections carried forward; statuses updated where shipped.

---

## 1. Authentication & Identity

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| AUTH-1.1 | Email/password sign-up + sign-in | P0 | Clerk hosted UI | COMPLETE | |
| AUTH-1.2 | Google OAuth sign-in | P0 | Clerk social provider | COMPLETE | |
| AUTH-1.3 | Email verification gate | P1 | Clerk + `SETTING_KEYS.requireEmailVerification` toggle | COMPLETE | Toggle via Admin Settings |
| AUTH-1.4 | JWT-based session management | P0 | Clerk session tokens; 24h default, configurable | COMPLETE | |
| AUTH-1.5 | Clerk user → Profile sync | P0 | Webhook at `/api/webhooks/clerk` → `Profile` upsert | COMPLETE | |
| AUTH-1.6 | SSO callback routes (catch-all) | P1 | `/login/[[...sign-in]]`, `/signup/[[...sign-up]]` — catch-all routes for Clerk redirects | COMPLETE | PR #126 — catch-all routes fix invite redirects |
| AUTH-1.7 | Admin-only route guard | P0 | `isAdmin()` check in `withAdminAuth` middleware | COMPLETE | |
| AUTH-1.8 | Middleware route protection | P0 | `clerkMiddleware` in `packages/web/middleware.ts` | COMPLETE | |
| AUTH-1.9 | Enterprise SSO | P2 | Clerk Orgs + Teams | DEFERRED | Phase C |
| AUTH-1.10 | TOTP multi-factor auth | P1 | Clerk dashboard setting (Ryan action) | BLOCKED | Ryan must enroll TOTP; pre-launch security |

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
| PIPE-2.14 | Stem export (individual tracks) | P1 | `GET /stems/:id` + `/stems/:id/zip` + web proxy | COMPLETE | BL-08 shipped |
| PIPE-2.15 | Audio quality validation | P1 | `validateAudioQuality()` + EBU R128 loudness parsing | COMPLETE | BL-46 shipped; 27 tests |
| PIPE-2.16 | Mixer timeout guard | P1 | Configurable timeout; fails job cleanly on overrun | COMPLETE | Sprint 5 |
| PIPE-2.17 | Retry on Director re-parse | P1 | Skip director JSON re-parse if `directorJson` already set | COMPLETE | |
| PIPE-2.18 | Concurrent TTS with concurrency limit | P1 | `p-limit` in orchestrator worker | COMPLETE | perf(tts) |
| PIPE-2.19 | Scene-level audio regeneration | P2 | `POST /api/projects/[id]/regenerate-scene` | COMPLETE | |
| PIPE-2.20 | Preview generation | P2 | `POST /preview` orchestrator + `/api/preview` web proxy | COMPLETE | |
| PIPE-2.21 | Demo script generation | P2 | `POST /api/generate-demo-script` — seeded example | COMPLETE | |
| PIPE-2.22 | Fountain native parser | P1 | `orchestrator/src/director/parsers/fountain.ts` — spec-compliant | COMPLETE | PR #39 — Sprint D |
| PIPE-2.23 | Final Draft (FDX) XML parser | P1 | `orchestrator/src/director/parsers/fdx.ts` — FD10/FD12 | COMPLETE | PR #39 — Sprint D |
| PIPE-2.24 | Director notes prompt injection | P1 | Pass 1 injects `project.directorNotes`; sanitized | COMPLETE | PR #58 — Sprint D |
| PIPE-2.25 | Emotion override in TTS | P2 | `project.emotionOverrides` map before ElevenLabs TTS call | COMPLETE | PR #43 — Sprint E |
| PIPE-2.26 | Silent failure on missing episode file | P0 | Pipeline throws (not continues) when episode file absent | COMPLETE | PR #56 — closed Issue #15 |
| PIPE-2.27 | Full-script chunking (14 scenes/chunk) | P0 | `chunkScript(text, scenesPerChunk=14)` splits at INT./EXT. headings; wraps scene-level TTS | COMPLETE | Sprint K — 17 unit tests; 150-page scripts supported |
| PIPE-2.28 | Character voice consistency (VoiceMap) | P1 | Character extraction runs once per project; VoiceMap persisted to `project.voiceAssignments`; injected into all chunks | COMPLETE | Sprint L — commit e27af1c |
| PIPE-2.29 | Genre/tone context injection | P1 | `extractScriptContext()` heuristics (~1ms); context block prepended to AudioDirectorAgent prompt; 8 genre mappings | COMPLETE | Sprint L — commit 9de0e99 |
| PIPE-2.30 | LLM auto-failover on generation | P1 | `buildFailoverChain()` — retries 402/429/529 on provider rotation | COMPLETE | Sprint v3.2 — commit 8e7bd69 |

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
| PROJ-3.12 | Project deletion (HTTP DELETE) | P2 | `DELETE /api/projects/[id]` | COMPLETE | PR #46 — Sprint C |
| PROJ-3.13 | Queue position display | P1 | `GET /api/jobs/[id]/position` | COMPLETE | |
| PROJ-3.14 | Queue status overview | P1 | `GET /api/queue/status` | COMPLETE | |
| PROJ-3.15 | Per-segment job progress events | P1 | Job status returns `segments[]`, `firstAudioUrl`; progress: "Generating audio for scenes 1–14…" | COMPLETE | Sprint K |
| PROJ-3.16 | Segment stitch on completion | P1 | `/stitch-segments` orchestrator route; final URL saved to `job.audioUrl`; segments preserved in `job.segments` | COMPLETE | Sprint K — commit 84e3a85 |
| PROJ-3.17 | Project page IDOR protection | P0 | Query scoped to authenticated `userId`; 404 on foreign project | COMPLETE | PR #118 — commit 3cfb40e |

---

## 4. Audio & Playback

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| AUDIO-4.1 | Audio player on listen page | P0 | `packages/web/components/player/` | COMPLETE | |
| AUDIO-4.2 | M4A/MP3 streaming | P0 | Cloudflare R2 signed URLs via audio proxy | COMPLETE | |
| AUDIO-4.3 | Audio preview on project page | P1 | `/app/api/audio-preview/[...path]` proxy | COMPLETE | CORP header set cross-origin |
| AUDIO-4.4 | Stem download (individual tracks) | P1 | `GET /api/projects/[id]/export/stems` → zip | COMPLETE | |
| AUDIO-4.5 | Scene-level script + audio sync | P2 | Director JSON drives timeline display | COMPLETE | |
| AUDIO-4.6 | Voice assignments UI | P1 | `PATCH /api/projects/[id]/voice-assignments` | COMPLETE | |
| AUDIO-4.7 | Voice persistence across runs | P1 | Voice assignments saved to DB; re-used on retry | COMPLETE | |
| AUDIO-4.8 | Voice catalog browser | P2 | `GET /api/voices` — 80 ElevenLabs voices | COMPLETE | |
| AUDIO-4.9 | Voice marketplace interest | P2 | `POST /api/voices` — waitlist interest capture | COMPLETE | Migration 0006 |
| AUDIO-4.10 | Audio preview hint on completion | P2 | 15s contextual preview auto-plays; iOS install hint | COMPLETE | PR #52 — Sprint F |
| AUDIO-4.11 | Progressive playback (Fast Start) | P1 | `firstAudioUrl` set after first segment; player starts immediately; `segmentUrls[]` appended as segments complete; "Fast Start" tooltip | COMPLETE | Sprint L |
| AUDIO-4.12 | Segment queue player with buffer indicator | P1 | `AudioPlayer` `segmentUrls[]` prop; `activeSegmentIndex` advances on `ended`; `isBuffering` state + "preparing…" indicator | COMPLETE | Sprint L |
| AUDIO-4.13 | Audio catalog enriched (genre/tone knowledge) | P2 | `audio_selection_knowledge.json` enriched: 6 rules, 15 examples, `genre_to_music_group_quick_reference` map | COMPLETE | Sprint L |

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
| BILL-5.10 | Referral code system | P2 | `POST /api/referral/upgrade` — constant-time HMAC compare; `REFERRAL_CODES` env merge | COMPLETE | PR #131 security fix — constant-time check |
| BILL-5.11 | Stripe production keys | P0 | Doppler prd config; DBBuilder account (dbbuilderio@gmail.com) | COMPLETE | charges_enabled, payouts_enabled ✅ (2026-05-15) |
| BILL-5.12 | Stripe webhook events list | P1 | `checkout.session.completed` + price IDs in Stripe dashboard | NOT IMPL | Ryan to verify event list; webhook secret already live |
| BILL-5.13 | Donation flow (Impact) | P2 | `POST /api/stripe/donate` + `POST /api/stripe/webhook` impact path | COMPLETE | |
| BILL-5.14 | Purchase seed fixtures | P2 | Dev/test fixtures for `Purchase` model | COMPLETE | PR #45 — Sprint B |
| BILL-5.15 | Credit balance on Profile | P1 | `Profile.credits Int @default(0)` + `CreditTransaction` model; migration 0020 | COMPLETE | PR #41 — Sprint D |
| BILL-5.16 | Credit pack purchase (Stripe) | P1 | `POST /api/credits/purchase` → Stripe Checkout one-time payment; $9.99/20 credits | COMPLETE | PR #41 — Sprint D |
| BILL-5.17 | Credit deduction on generation | P1 | Atomic deduct in `POST /api/generate`; free tier gated; Pro/Enterprise bypass | COMPLETE | PR #41 — Sprint D |
| BILL-5.18 | Signup bonus credits | P2 | 3 credits added on new `Profile` creation | COMPLETE | PR #41 — Sprint D |
| BILL-5.19 | Plans page live pricing | P2 | Dashboard pulls from `PRICING_TIERS` constant | COMPLETE | PR #57 — Sprint F |
| BILL-5.20 | Subscriptions table sync on tier grants | P1 | `admin/tier` + `referral/upgrade` routes upsert `subscriptions` row via `$transaction`; per-tier generation/download limits via `TIER_LIMITS` constant | PARTIAL | PR #135 in review — fixes admin provisioning + referral upgrades leaving `subscriptions` stale |

---

## 6. StoryScore & AI Intelligence

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| SCORE-6.1 | StoryScore analysis (per project) | P0 | `POST /api/projects/[id]/score` → Claude Sonnet 4.6 | COMPLETE | |
| SCORE-6.2 | StoryScore display on project page | P0 | `components/storyscore/` | COMPLETE | |
| SCORE-6.3 | Comparable scripts | P1 | `GET /api/projects/[id]/comparables` → pgvector similarity | COMPLETE | Requires OPENAI_API_KEY in prod |
| SCORE-6.4 | Suggestions (AI script improvement) | P1 | `GET/POST /api/projects/[id]/suggestions` | COMPLETE | |
| SCORE-6.5 | Suggestion rewrites | P1 | `POST /api/projects/[id]/suggestions/[id]/rewrite` | COMPLETE | |
| SCORE-6.6 | Rewrite modal (style selection) | P1 | `RewriteModal.tsx` — style persisted to localStorage | COMPLETE | PR #45 — Sprint B |
| SCORE-6.7 | Story Adviser (4-step wizard) | P1 | `app/projects/[id]/adviser/page.tsx` + wizard UI | COMPLETE | Feature-flagged; enabled by default |
| SCORE-6.8 | Story Adviser feature flag enable | P1 | `NEXT_PUBLIC_FF_STORY_ADVISER=true` in code | COMPLETE | PR #46 — Sprint C |
| SCORE-6.9 | Corpus ingestion pipeline | P1 | `pnpm ingest:training && pnpm score:corpus` | BLOCKED | Requires AI keys on Render (Ryan action) |
| SCORE-6.10 | Script corpus admin UI | P1 | `/admin/corpus` — browse, populate, export CSV | COMPLETE | |
| SCORE-6.11 | Corpus CSV export (capped at 500) | P2 | `GET /api/admin/corpus/export` — `take: 500` guard prevents unbounded query | PARTIAL | PR #135 in review — cap added |
| SCORE-6.12 | Admin corpus populate | P1 | `POST /api/admin/corpus/populate` | COMPLETE | |
| SCORE-6.13 | Script reviews | P2 | `GET/POST /api/projects/[id]/reviews` | COMPLETE | Migration 0009 |

---

## 7. Script Exchange & Writer Hub

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| EXCH-7.1 | Exchange marketplace browse | P2 | `GET /api/exchange` + `/app/exchange` | COMPLETE | Migration 0009 |
| EXCH-7.2 | Exchange listing page | P2 | `GET /api/exchange/[slug]` + `/app/exchange/[slug]` | COMPLETE | |
| EXCH-7.3 | Exchange listing submit | P2 | `POST /api/projects/[id]/exchange` | COMPLETE | |
| EXCH-7.4 | Exchange listing submit — success toast | P2 | Toast after form submit | COMPLETE | PR #45 — Sprint B |
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
| SHARE-8.4 | Share modal (2-tab: Share + QR) | P1 | `components/dashboard/share-modal.tsx` | COMPLETE | |
| SHARE-8.5 | Share modal — existing shares list | P2 | Shows up to 5 active shares | COMPLETE | |
| SHARE-8.6 | Share modal — "View all" > 5 shares | P2 | Toggle with "Show less" collapse (expanded/collapsed) | COMPLETE | Sprint I — commit a3b461f |
| SHARE-8.7 | Share link short URL (`/s/[code]`) | P1 | `/app/s/[code]` → redirect to listen page | COMPLETE | |
| SHARE-8.8 | Share management (revoke) | P1 | `DELETE /api/shares/[shareId]` | COMPLETE | |
| SHARE-8.9 | Team creation | P2 | `POST /api/teams` | COMPLETE | |
| SHARE-8.10 | Team member management | P2 | `GET/POST /api/teams/[id]/members` | COMPLETE | |
| SHARE-8.11 | Team share (project access) | P2 | `POST /api/teams/share` | COMPLETE | Migration 0010 |
| SHARE-8.12 | Team activity log | P2 | `GET /api/teams/[id]/activity` | COMPLETE | |
| SHARE-8.13 | Invite by token | P1 | `GET/POST /api/invite/[token]` | COMPLETE | |
| SHARE-8.14 | Feedback modal (per project) | P2 | `PATCH /api/projects/[id]/feedback` — no auto-close | COMPLETE | PR #45 — Sprint B |
| SHARE-8.15 | ScriptShare scene index | P1 | `ScriptShare.sceneIndex Int?` + `sceneStartMs Int?`; migration | COMPLETE | PR #39 — Sprint D |
| SHARE-8.16 | Scene share URL generation | P1 | `POST /api/shares` accepts `{ sceneIndex?, sceneStartMs? }` | COMPLETE | PR #39 — Sprint D |
| SHARE-8.17 | Listen page scene seek | P1 | `?scene=N` param seeks player to `sceneStartMs` on mount | COMPLETE | PR #39 — Sprint D |
| SHARE-8.18 | Bulk share (multi-project) | P1 | Sprint v3.1 — share multiple projects in one action | COMPLETE | commit 9877a8c |
| SHARE-8.19 | Share dashboard | P1 | Sprint v3.1 — central view of all active shares | COMPLETE | commit 9877a8c |
| SHARE-8.20 | Play analytics | P2 | Sprint v3.1 — per-share play counts/tracking surfaced to owner | COMPLETE | commit 9877a8c |
| SHARE-8.21 | Revoke UI | P1 | Sprint v3.1 — revoke shares from dashboard (UI over SHARE-8.8) | COMPLETE | commit 9877a8c |
| SHARE-8.22 | Destination-agnostic share language | P2 | Removed agent-specific copy from share modal | COMPLETE | commit 5b7e7de |
| SHARE-8.23 | Shares list `take:100` limit | P2 | `app/api/projects/[id]/shares/route.ts` bounded query | COMPLETE | Sprint v3.2 |
| SHARE-8.24 | Mobile touch seek (`/s/[code]`) | P1 | `protected-player.tsx` drag-to-seek on touch | COMPLETE | Sprint v3.2 |
| SHARE-8.25 | Re-invite removed member | P1 | `addMember` reactivates removed row vs. unique-constraint 500 | PARTIAL | PR still in review — closes issue #62 |
| SHARE-8.26 | Atomic play-count increment (TOCTOU fix) | P1 | `$executeRaw` SQL UPDATE with `WHERE play_count < max_plays OR max_plays IS NULL`; 0 rows → 410 PLAY_LIMIT_REACHED | PARTIAL | PR #134 in review — eliminates race on concurrent plays |
| SHARE-8.27 | Expiry gate on share access | P1 | `expiresAt` check returns 410 EXPIRED before serving audio | PARTIAL | PR #134 in review — tested in share-play.test.ts |
| SHARE-8.28 | Share modal bulk tab mobile layout | P2 | `flex-col sm:flex-row` responsive layout on recipient rows | PARTIAL | PR #135 in review — UX-E-11 |

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
| ADMIN-10.1 | Admin dashboard overview | P0 | `/admin` — stats + health; null-profile guard | COMPLETE | PR #131 — crash fix |
| ADMIN-10.2 | User management (list/edit/search) | P0 | `GET/PATCH /api/admin/users` — includes email in OR search | COMPLETE | PR #135 — DT-30-L-2 |
| ADMIN-10.3 | Subscription management | P0 | `GET/PATCH/DELETE /api/admin/subscriptions` | COMPLETE | |
| ADMIN-10.4 | Corpus management | P1 | `/admin/corpus` — populate, export (capped 500), view | COMPLETE | PR #135 cap |
| ADMIN-10.5 | Platform settings (collapsible) | P0 | `admin-settings-client.tsx` — 5 sections, all collapsible | COMPLETE | |
| ADMIN-10.6 | Audit log | P1 | `GET /api/admin/audit-logs` + `/admin/audit-log` | COMPLETE | |
| ADMIN-10.7 | Impact admin queue | P1 | `/admin/impact` — approve/reject stories | COMPLETE | |
| ADMIN-10.8 | Admin analytics | P1 | `/admin/analytics` | COMPLETE | |
| ADMIN-10.9 | Alert management | P2 | `GET/POST /api/alerts` + preferences | COMPLETE | |
| ADMIN-10.10 | Admin stats API | P1 | `GET /api/admin/stats` — null profile guard added | COMPLETE | PR #131 — CRITICAL crash fix |
| ADMIN-10.11 | Human review admin queue | P1 | `/admin/human-review` — assign reviewer, deliver, track status | COMPLETE | PR #54 — Sprint G |
| ADMIN-10.12 | Credit management (admin) | P1 | Admin credit adjustment for user accounts | COMPLETE | PR #41 — Sprint D |
| ADMIN-10.13 | Admin tier provisioning (Option A) | P1 | `POST /api/admin/tier` — admin sets tier directly; audit logged; replaces shared-password gate | COMPLETE | PR #124 — enterprise provisioning |
| ADMIN-10.14 | Content-log retention cron | P1 | `GET /api/cron/cleanup-logs` — deletes `content_access_log` > 90 days; `CRON_SECRET` protected; Render cron `0 2 * * *` | PARTIAL | PR #134 in review |

---

## 11. Marketing & Public Pages

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| MKT-11.1 | Marketing homepage | P0 | `/app/page.tsx` (main app) | COMPLETE | |
| MKT-11.2 | Pricing page | P0 | `/app/pricing` — live from `PRICING_TIERS` | COMPLETE | PR #57 live pricing |
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
| INFRA-12.1 | Render.com deployment (web + orchestrator) | P0 | `render.yaml` IaC | COMPLETE | Both services live at storymagicapp.net |
| INFRA-12.2 | Doppler secrets management | P0 | `story-magic/prd` — 76 secrets | PARTIAL | Doppler is SoT; native Doppler→Render sync still PENDING (dashboard activation step) |
| INFRA-12.3 | DNS — app CNAME | P0 | `app.storymagicapp.net` CNAME → Render via Cloudflare | COMPLETE | Live on Cloudflare (May 2026) |
| INFRA-12.4 | DNS — Clerk auth subdomains | P0 | `clerk.storymagicapp.net` + `accounts.storymagicapp.net` CNAMEs | COMPLETE | All 5 Clerk CNAMEs added 2026-05-15 |
| INFRA-12.5 | Sentry error monitoring | P1 | `@sentry/nextjs` + orchestrator Sentry client — enabled on DSN presence | COMPLETE | PR #60 merged 2026-06-03 — decoupled from NODE_ENV |
| INFRA-12.6 | Rate limiting (per-route tiers) | P0 | `packages/web/lib/ratelimit.ts` — tight/loose/api tiers | COMPLETE | |
| INFRA-12.7 | Clerk production keys | P0 | `pk_live_*` / `sk_live_*` in Doppler prd | COMPLETE | Confirmed in Doppler prd (Ryan May 2026) |
| INFRA-12.8 | Field encryption (AES-256-GCM) | P1 | `FIELD_ENCRYPTION_KEY` — script text at-rest encryption | COMPLETE | |
| INFRA-12.9 | IDOR protection on downloads | P0 | Path traversal + ownership check in download endpoint | COMPLETE | |
| INFRA-12.10 | CSP nonce headers | P0 | `next.config.ts` — nonce-based script-src | COMPLETE | |
| INFRA-12.11 | CORS / CORP headers | P1 | `Cross-Origin-Resource-Policy: cross-origin` on audio routes | COMPLETE | |
| INFRA-12.12 | Checkly heartbeat monitors | P1 | Uptime checks on health endpoint | COMPLETE | |
| INFRA-12.13 | Connection pooling | P1 | 8 connections/service (16 total) vs 20-connection PG limit | COMPLETE | |
| INFRA-12.14 | TOTP enforcement (admin org) | P1 | Clerk account settings → Security → Add authenticator | COMPLETE | Enrolled on dbbuilderio@gmail.com (2026-05-15) |
| INFRA-12.15 | SOC 2 prep (audit logging) | P2 | `AuditLog` model; 7-year retention design | COMPLETE | Sprint 6-7 |
| INFRA-12.16 | Email testing mode | P1 | `EMAIL_TESTING_MODE=false` for real send | COMPLETE | |
| INFRA-12.17 | HMAC webhook signing | P1 | SHA-256 HMAC signed payloads on all outbound webhooks | COMPLETE | PR #53 — Sprint F |
| INFRA-12.18 | RESEND_FROM_ADDRESS env var | P1 | `lib/email/resend.ts` uses env fallback | COMPLETE | Set in Doppler prd; delivery confirmed 2026-05-15 |
| INFRA-12.19 | Resend sending domain — storymagicapp.net | P1 | Resend → Domains → verify storymagicapp.net DNS | COMPLETE | Verified by Ryan 2026-05-15 |
| INFRA-12.20 | GDPR FK cascades on user data | P1 | `onDelete: SetNull` on Purchase, ScriptShare (sharedBy/sharedWith), TeamShare FKs; `userId` nullable on Purchase | PARTIAL | PR #132 in review — enables GDPR-compliant user deletion |
| INFRA-12.21 | Doppler native CLI in render.yaml | P2 | Render.yaml uses `doppler run --` prefix on all service commands; CLI pinned v3.76.0 | PARTIAL | PR #133 in review — prevents Doppler version drift |
| INFRA-12.22 | Shared Prisma schema (single source) | P1 | PR #91 — `packages/shared` single Prisma client consumed by both web + orchestrator | COMPLETE | PR #91 2026-05-30 |

---

## 13. Creative Direction & Performance

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| CDIR-13.1 | Director Notes model | P1 | `Project.directorNotes Json?` | COMPLETE | PR #58 — Sprint D |
| CDIR-13.2 | Director Notes API | P1 | `GET/PUT /api/projects/[id]/director-notes` | COMPLETE | PR #58 — Sprint D |
| CDIR-13.3 | Director Notes panel UI | P1 | Collapsible pre-generation panel; per-character + global notes; auto-save on blur | COMPLETE | PR #58 — Sprint D |
| CDIR-13.4 | Emotion overrides model | P2 | `Project.emotionOverrides Json?` | COMPLETE | PR #43 — Sprint E |
| CDIR-13.5 | Emotion overrides API | P2 | `GET/PUT /api/projects/[id]/emotion-overrides` | COMPLETE | PR #43 — Sprint E |
| CDIR-13.6 | Performance direction panel UI | P2 | "Performance" tab; emotion Select per dialogue line; "Re-render scene" button | COMPLETE | PR #43 — Sprint E |
| CDIR-13.7 | Fountain/FDX upload UI | P1 | File input `accept` extended; upload label updated; file type badge | COMPLETE | PR #39 + Sprint I UI fix |

---

## 14. Distribution & Podcast

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| DIST-14.1 | PodcastFeed model | P2 | `id`, `projectId`, `rssFeedSlug` (unique), `published`, `userId` | COMPLETE | PR #42 — Sprint D |
| DIST-14.2 | Podcast publish API | P2 | `POST /api/projects/[id]/podcast/publish` | COMPLETE | PR #42 — Sprint D |
| DIST-14.3 | RSS 2.0 feed endpoint | P2 | `GET /listen/[code]/podcast.rss` | COMPLETE | PR #42 — Sprint D |
| DIST-14.4 | Public podcast page | P2 | `/listen/[code]/podcast` — cover art, player, RSS link | COMPLETE | PR #42 — Sprint D |
| DIST-14.5 | Publish podcast UI | P2 | "Publish as Podcast" modal on completed project | COMPLETE | PR #42 — Sprint D |

---

## 15. Voice Cloning

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| VCLN-15.1 | VoiceClone model | P1 | `id`, `userId`, `name`, `elevenLabsVoiceId @unique`, `status`, `previewUrl?` | COMPLETE | PR #52 — Sprint F |
| VCLN-15.2 | Voice clone upload API | P1 | `POST /api/voice-clones` — accepts audio sample; calls ElevenLabs Add Voice API | COMPLETE | PR #52 — Sprint F |
| VCLN-15.3 | Voice clone list + delete | P1 | `GET/DELETE /api/voice-clones/[id]` | COMPLETE | PR #52 — Sprint F |
| VCLN-15.4 | VoiceCloneUploader component | P1 | Drag-drop upload; status polling; spinner on "View clones" | COMPLETE | PR #52 + Sprint H UX-P1a |
| VCLN-15.5 | Cloned voices in assignment dropdown | P1 | Cloned voices appear alongside catalog voices | COMPLETE | PR #52 — Sprint F |

---

## 16. Mobile PWA

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| PWA-16.1 | Web App Manifest | P2 | `public/manifest.webmanifest` — standalone display, theme color | COMPLETE | PR #52 — Sprint F |
| PWA-16.2 | Service worker (offline caching) | P2 | `public/sw.js` — caches static assets; network-first for API routes; JS chunks excluded from cache-first (PR #116) | COMPLETE | PR #52 + PR #116 SW v4 |
| PWA-16.3 | ServiceWorkerRegistration component | P2 | Handles registration lifecycle; update notification | COMPLETE | PR #52 — Sprint F |
| PWA-16.4 | iOS install hint | P2 | "Add to Home Screen" hint in audio preview header | COMPLETE | PR #52 — Sprint F |

---

## 17. Public API & Developer Integrations

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| API-17.1 | ApiKey model | P1 | `id`, `userId`, `keyHash` (SHA-256), `isActive`; migration 0019 | COMPLETE | PR #53 — Sprint F |
| API-17.2 | API key creation | P1 | `POST /api/api-keys` — generates key (shown once), stores hash | COMPLETE | PR #53 — Sprint F |
| API-17.3 | API key list + revoke | P1 | `GET/DELETE /api/api-keys/[id]` | COMPLETE | PR #53 — Sprint F |
| API-17.4 | Public generate endpoint | P1 | `POST /api/v1/generate` — API key auth; returns `{ jobId, status }` with 202 | COMPLETE | PR #53 — Sprint F |
| API-17.5 | Public job status endpoint | P1 | `GET /api/v1/jobs/[id]` — poll job status via API key | COMPLETE | PR #53 — Sprint F |
| API-17.6 | WebhookEndpoint model | P1 | `id`, `userId`, `url`, `secret`, `events[]`, `isActive`, `WebhookDeliveryLog` | COMPLETE | PR #53 + Sprint H |
| API-17.7 | Webhook endpoint CRUD | P1 | `GET/POST/DELETE /api/webhooks`; rotate-secret endpoint | COMPLETE | PR #53 + Sprint H |
| API-17.8 | Webhook delivery (with retry) | P1 | HMAC signed; retry queue on 4xx/5xx; `WebhookDeliveryLog` | COMPLETE | PR #53 + Sprint H |
| API-17.9 | Webhook events: job.completed + job.failed | P1 | Fired from `generation/processor.ts` post-completion | COMPLETE | PR #53 — Sprint F |
| API-17.10 | API key management UI | P1 | Developer settings page — create/list/revoke; webhook management | COMPLETE | PR #53 — Sprint F |

---

## 18. Human-in-Loop Review

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| HLRV-18.1 | HumanReview model | P1 | `id`, `userId`, `projectId → Project`, `jobId → Job`; FKs added Sprint H | COMPLETE | PR #54 + Sprint H |
| HLRV-18.2 | Request review API | P1 | `POST /api/projects/[id]/request-review` | COMPLETE | PR #54 — Sprint G |
| HLRV-18.3 | Review status API | P1 | `GET /api/projects/[id]/human-review` | COMPLETE | PR #54 — Sprint G |
| HLRV-18.4 | Admin review queue | P1 | `/admin/human-review` | COMPLETE | PR #54 — Sprint G |
| HLRV-18.5 | Review decision API | P1 | `POST /api/admin/human-review/[id]/deliver` | COMPLETE | PR #54 — Sprint G |
| HLRV-18.6 | Review request email | P1 | `sendHumanReviewRequestEmail()` | COMPLETE | PR #54 — Sprint G |
| HLRV-18.7 | Review delivered email | P1 | `sendHumanReviewDecisionEmail()` | COMPLETE | PR #54 — Sprint G |
| HLRV-18.8 | Review status badge on project page | P2 | "Review Requested" / "In Review" / "Delivered" | COMPLETE | PR #54 — Sprint G |

---

## 19. Team Comments & Collaboration

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| CMMNT-19.1 | ProjectComment model | P1 | `id`, `projectId`, `userId → profiles.id`, `body`, `reactionType?`, `sceneIndex?`, `audioTimestampMs?` | COMPLETE | PR #55 + Sprint H FK + Sprint M reactionType |
| CMMNT-19.2 | Comments API (text notes) | P1 | `GET/POST /api/projects/[id]/comments` — owner + TeamShare + ScriptShare access; Zod validation | COMPLETE | PR #55 — Sprint G |
| CMMNT-19.3 | Comment thread display | P1 | `CommentsSidebar.tsx` — threaded list; confirm on delete + error feedback | COMPLETE | PR #55 + Sprint H |
| CMMNT-19.4 | Comment with scene/timestamp anchor | P1 | Comment includes optional `sceneIndex` + `audioTimestampMs` | COMPLETE | PR #55 — Sprint G |
| CMMNT-19.5 | Comment notification email | P1 | `notifyNewComment()` — owner notified when collaborator posts; fires async | COMPLETE | PR #55 — Sprint G |

---

## 20. Screenplay Player & Notes System

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| SPLY-20.1 | ScreenplayPlayer component | P1 | `components/project/ScreenplayPlayer.tsx` | COMPLETE | Sprint M — commit 6be4a43 |
| SPLY-20.2 | Active-line highlight | P2 | `data-active="true"` on line matching `audioTimestampMs ±5s` | COMPLETE | Sprint M |
| SPLY-20.3 | Left-border color by reaction type | P1 | Amber = note, green = like, red = dislike, gray = undecided | COMPLETE | Sprint M |
| SPLY-20.4 | Hover-to-annotate | P1 | Hover line → "+" button → `NotePopover` textarea → Save/Cancel | COMPLETE | Sprint M |
| SPLY-20.5 | Note indicator (amber circle) | P1 | Amber circle on annotated lines; click seeks to `audioTimestampMs` | COMPLETE | Sprint M |
| SPLY-20.6 | Per-scene reactions (Like / Dislike / Undecided) | P1 | One reaction per user per scene; upsert via deleteMany + insert | COMPLETE | Sprint M — reaction renamed Pass→Dislike across UI (PR #117) |
| SPLY-20.7 | NotesPanel sidebar | P1 | `components/project/NotesPanel.tsx` — Notes + Reactions sections | COMPLETE | Sprint M |
| SPLY-20.8 | ScreenplayPlayer + NotesPanel page integration | P1 | Wired into `isCompleted` blocks in `project-workflow.tsx` | COMPLETE | Sprint M |
| SPLY-20.9 | Enterprise dashboard Notes & Reactions tab | P1 | 5th tab in enterprise dashboard; server-side Prisma query (up to 200 comments) | COMPLETE | Sprint M |
| SPLY-20.10 | Comment reactions upsert API | P1 | `POST /api/projects/[id]/comments` with `{ reactionType, sceneIndex }` | COMPLETE | Sprint M |
| SPLY-20.11 | DELETE comment endpoint | P1 | `DELETE /api/projects/[id]/comments/[commentId]` — own comment only | COMPLETE | Sprint M |
| SPLY-20.12 | Comment reactions indexes | P2 | Migration 0024: 4 indexes on `project_comments` | COMPLETE | Sprint M |
| SPLY-20.13 | Real-time scroll sync (screenplay follows playback) | P2 | `AudioPlayer` needs `onTimeUpdate` callback prop | DEFERRED | Post-launch ~3 SP |

---

## 21. Reliability & Failover

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| REL-21.1 | LLM multi-provider auto-failover | P1 | `llm-client.ts` — chain `anthropic → openrouter/openai/gpt-4.1 → openai/gpt-4.1` | COMPLETE | commits 8e7bd69, 3ac5383 |
| REL-21.2 | Failover trigger detection | P1 | `isFailoverableError` — 402/429/529 + billing/rate-limit strings only | COMPLETE | retries provider-side failures only |
| REL-21.3 | OpenRouter provider | P1 | `createOpenAI` w/ OpenRouter baseURL + `HTTP-Referer` | COMPLETE | billing-independent middle tier |
| REL-21.4 | Failover on structured output | P1 | `generateStructuredOutput` uses same chain | COMPLETE | commit 3ac5383 |
| REL-21.5 | Failover unit tests | P1 | Export + test chain order, error classification, OpenRouter tier | NOT IMPL | TEST-02 — Sprint D gap |
| REL-21.6 | ensureProfile backfill | P2 | Upsert `update` branch backfills email/fullName/avatarUrl from Clerk | COMPLETE | commit 3ac5383 |
| REL-21.7 | Session-expiry surfacing | P2 | generate-button surfaces 401 after 3 consecutive poll failures | COMPLETE | commit af1aa79 |

---

## 22. Engineering Workflow

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| ENG-22.1 | Branch protection on `main` | P1 | PR required + 1 code-owner approval + 3 CI checks; enforce_admins | COMPLETE | 2026-05-27 |
| ENG-22.2 | CODEOWNERS | P1 | `.github/CODEOWNERS` = `@dbbuilder @octavianorg` | COMPLETE | either approval satisfies gate |
| ENG-22.3 | PR template | P2 | `.github/pull_request_template.md` | COMPLETE | |
| ENG-22.4 | CI gates | P0 | Build, Lint & Type Check, Unit Tests (required) | COMPLETE | green on `main` |
| ENG-22.5 | Stale branch cleanup | P2 | Audited + deleted 11 redundant branches | COMPLETE | 2026-05-27 |
| ENG-22.6 | Single-source Prisma schema | P1 | `packages/shared` — web + orchestrator both import from shared package | COMPLETE | PR #91 — 2026-05-30 |

---

## 23. Enterprise Platform *(NEW — 2026-06-03)*

| Req ID | Feature | Priority | Planned Implementation | Status | Notes |
|--------|---------|----------|----------------------|--------|-------|
| ENT-23.1 | Enterprise tier gate | P1 | `/enterprise/*` route guard — redirects non-enterprise users to upgrade page | COMPLETE | PR #106 — feat/enterprise-gate |
| ENT-23.2 | Enterprise upgrade page | P1 | `/enterprise/upgrade` — contact/plans page for non-enterprise users | COMPLETE | PR #106 |
| ENT-23.3 | Multi-team support | P1 | Team CRUD: create/rename/delete; multiple teams per enterprise account | COMPLETE | PR #107 |
| ENT-23.4 | Project assignment UI | P1 | `EnterpriseProjectAssignment.tsx` — assign/unassign projects to teams with +/− buttons | COMPLETE | PR #107 — buttons resized to 44px in PR #135 |
| ENT-23.5 | Master/sub-account wiring | P1 | Member types (owner/member/viewer) + enterprise activity feed via `activityLog` | COMPLETE | PR #102 |
| ENT-23.6 | Enterprise dashboard activity feed | P2 | Activity feed in enterprise dashboard; scrollable `max-h-[480px]` container | COMPLETE | PR #102 + PR #135 scroll container |
| ENT-23.7 | Enterprise dashboard team list | P2 | Team member list in enterprise dashboard; scrollable `max-h-[480px]` container | PARTIAL | PR #135 scroll container in review |
| ENT-23.8 | TeamNotesTab scroll container | P2 | `TeamNotesTab.tsx` — notes list bounded at `max-h-[480px]` | PARTIAL | PR #135 in review — UX-F-04 |
| ENT-23.9 | Window.confirm → Dialog in team page | P2 | Both confirm dialogs replaced with `@radix-ui/react-dialog` controlled dialogs | PARTIAL | PR #135 in review — UX-F-03 |
| ENT-23.10 | Compare Scripts button (wired) | P2 | "Compare Scripts" button in project-workflow.tsx needs `onClick` | NOT IMPL | UX-F-01 Sprint D |

---

## 24. Gap Analysis *(Updated — post Sprint C)*

| Feature | Status | Gap | Impact | Resolution Plan | Target | Priority |
|---------|--------|-----|--------|-----------------|--------|---------|
| Stripe webhook events list | NOT IMPL | `checkout.session.completed` not confirmed in Stripe dashboard | Subscriptions may not activate | Ryan verifies event list + webhook secret confirmed | Pre-launch | P1 |
| Real-time screenplay scroll | DEFERRED | AudioPlayer has no `onTimeUpdate` prop | Screenplay doesn't scroll to active audio position | Add `onTimeUpdate` callback; wire to `currentTimeMs` | v3.2+ | P2 |
| Export notes as PDF/CSV | NOT IMPL | No export endpoint | Enterprise clients want artifacts | `GET /api/projects/[id]/comments/export` | v3.2+ | P2 |
| Sentry reporting active in prod | ~~PARTIAL~~ COMPLETE | — | — | PR #60 merged 2026-06-03 — DSN-gated | Done | — |
| Doppler→Render auto-sync | PARTIAL | 0 syncs configured; PR #133 adds CLI integration | Drift risk between Doppler + Render | Dashboard: activate native Doppler→Render sync per service | Sprint D | P1 |
| LLM failover test coverage | NOT IMPL | `buildFailoverChain`/`isFailoverableError` unexported + untested | Critical resilience infra unverified | TEST-02 — export + unit test the chain | Sprint D | P1 |
| Reader PDF preview | PARTIAL | `upload-client.tsx` preview is faked (byte-estimate pageCount) | Misleads on large scripts | FEAT-01 — real page count / OCR detection | v3.2+ | P2 |
| TeamMember.inviter FK | NOT IMPL | Field nullable but `Restrict` default blocks user deletion | GDPR: can't delete user if they invited someone | DT-06-02-4 — add `onDelete: SetNull` | Sprint D | P1 |
| Orphaned prisma/migrations dir | NOT IMPL | `packages/web/prisma/migrations/` duplicates correct location | Confusing directory structure | DT-06-02-1 — delete orphaned directory | Sprint D | P2 |
| PurchaseType enum stale | NOT IMPL | 6 dead values in marketplace.ts; 3 live values missing | Type drift causes false type safety | DT-06-02-2 — fix enum | Sprint D | P2 |
| Compare Scripts button | NOT IMPL | Button has no `onClick`; silently does nothing | Poor UX; user clicks but nothing happens | UX-F-01 — disable + tooltip or wire to handleCompareRuns | Sprint D | P1 |

---

*Requirements baseline as of 2026-06-03 — v3.3.0. 1,899 tests passing (630 orchestrator + 1,269 web); 12 TypeScript errors (all stale `.next/types` artifacts from route-group move — do not affect build). 24 sections; ~170 requirements. Sprint C: 5 PRs in review. Sprint D: 5 items (~6 SP).*
