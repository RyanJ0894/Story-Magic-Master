# Story Magic — Meeting Prep
**Date:** 2026-05-15  
**Author:** Chris Therriault  
**For:** Ryan Jae sync — launch status, next steps, and action items  
**Environment:** `https://app.storymagicapp.net` (Render — both services live as of today)

---

## TL;DR (90 seconds)

Today's session completed **Sprints K and L** in full — the full-script chunking architecture and the entire progressive playback frontend are shipped and deployed. The platform can now process 150-page scripts without timing out, and users hear their first audio within ~90 seconds of starting generation.

**Where we stand:** v2.2.0 is live. The only remaining sprint before launch-readiness is **Sprint M** (Screenplay Player + Notes), targeted for 2026-05-16. There are also **4 Ryan action items** that are actively blocking DNS/invites right now.

**Target launch: mid-June 2026.**

---

## 1. What Was Shipped Today (Sprint K + L — 9 commits)

### Sprint K — Full Script Processing (commits: e27af1c, 8eabc56, 84e3a85, 3d649ff)

The core long-script architecture — nothing about how short scripts work changed.

| What | How | Why it matters |
|------|-----|---------------|
| **Script chunker** | `chunkScript()` splits Director JSON at scene boundaries into ~14-scene segments | Prevents orchestrator timeouts on 90–150 page scripts |
| **Generation loop** | Processor iterates over chunks sequentially, calls `/orchestrate` per segment | Render starter plan (512MB) stays below memory ceiling |
| **Segment tracking** | `jobs.segments JSONB` + `jobs.first_audio_url` columns (migration 0023) | Each segment has a URL and status (`queued | processing | ready | failed`) |
| **Segment stitch** | After all segments complete, `/stitch-segments` concatenates into one final audio file | User gets single download URL at the end |
| **Partial failure guard** | If one segment fails, remaining segments still process | 150-page script won't fail entirely due to one bad scene |
| **Progress language** | Labels say "Generating audio for scenes 1–14…" — no "chunk" or "segment N of N" | Brand language: Fast Start, not technical jargon |
| **Unit tests** | 17 chunker tests, 8 generation-processor tests, 7 E2E contract tests | Regression safety before Ryan's live test |

**Key architecture note:** The existing `parallel-tts.ts` and `progressive-stitch.ts` workers are unchanged. Chunking is a layer above them — the orchestrator still processes each chunk's scenes in parallel internally.

---

### Sprint L — Fast-Start Playback + AI Quality (commits: 14f2165, 3b34471, cdc3177, 9de0e99)

| What | How | Why it matters |
|------|-----|---------------|
| **Segment queue player** | `AudioPlayer` now takes `segmentUrls[]`; on `ended`, auto-advances to next segment | User hears continuous audio as more segments complete |
| **Buffer indicator** | When player catches up to last ready segment, shows "Preparing…" spinner | Graceful pause instead of silence or error |
| **Fast Start tooltip** | Radix Tooltip on Generate button: "Audio starts in ~90 seconds" | Sets expectations before user clicks |
| **`onSegmentsUpdate` callback** | `GenerateButton` fires when ready-segment count grows during polling | Player and generate button are decoupled but stay in sync |
| **Progressive playback E2E** | `progressive-playback.authenticated.spec.ts` — 5 tests; fixed mock path + jobId casing | Ensures no regression in fast-start contract |
| **Character voice consistency** | Confirmed: `CharacterExtractionAgent` (Pass 1) runs once per project; VoiceMap persisted in `project.voiceAssignments`; all scene chunks use identical voice map | Scene 1 and scene 20 always use the same actor for DETECTIVE KANE |
| **Genre/tone context** | `extractScriptContext()` — regex heuristics, ~1ms; block prepended to AudioDirectorAgent message | Thriller scripts → dark/tense music; sci-fi → futuristic |
| **Audio catalog enrichment** | 39 music / 45 ambience / 53 SFX tracks audited; added genre→group mappings + 4 new examples to `audio_selection_knowledge.json` | Agent now has explicit guidance for sci-fi, comedy, horror genres |

---

## 2. Current System State

### Health (post-deploy, as of ~11:55 PDT today)

| Service | Status | Notes |
|---------|--------|-------|
| `story-magic-web` (Render) | **LIVE** | Database ✓ Auth ✓ Storage ✓ ElevenLabs ✓ Orchestrator ✓ |
| `story-magic-orchestrator` (Render) | **LIVE** | Director ✓ Orchestrator ✓ Sentry ✓ Checkly ✓ 145MB audio on disk |
| OpenAI health check (web) | ⚠️ Unhealthy | StoryScore / Intelligence feature only — core audio generation unaffected |
| DNS — app subdomain | ✓ Live | `app.storymagicapp.net` → Render |
| DNS — Clerk subdomains | ❌ Missing | `clerk.storymagicapp.net` and `accounts.storymagicapp.net` not yet in Cloudflare |

### Test Suite

| Package | Tests Passing | Files |
|---------|---------------|-------|
| `@story-magic/orchestrator` | **541** | 34 test files |
| `@story-magic/web` | **1,051** | 70 pass / 0 failures |

*Note: Two tests (`admin-routes`, `director-notes`) were failing earlier today with `Cannot find module '.prisma/client/default'` — fixed by running `prisma generate` after migration 0023 was applied locally. Zero failures now.*

### Git state: clean, `origin/main` up to date.

---

## 3. What Remains Before Launch

Three categories: **Ryan must do**, **DNS/config**, and **Sprint M code work**.

---

### Category A — Must Do (Blocking Today)

These 4 items are blocking the app from being usable at `app.storymagicapp.net`. Chris handles them as soon as Ryan provides the values.

| # | Action | What Ryan Does | What Chris Does After | Blocking |
|---|--------|---------------|----------------------|---------|
| **J-0a** | Get Clerk CNAME targets | Clerk dashboard → Production → Domains → copy the 2 CNAME targets for `clerk.storymagicapp.net` and `accounts.storymagicapp.net` | Adds both CNAMEs to Cloudflare (Proxied = OFF) | ❌ Auth broken |
| **J-1b** | Add Resend from-address to Doppler | Log in to Doppler → story-magic → prd → add: `RESEND_FROM_ADDRESS=Story Magic <noreply@servicevision.io>` | Runs `sync-doppler-to-render.sh` to push to Render | ❌ Team invites broken |
| **J-1d** | Add DKIM/SPF for storymagicapp.net in Resend | Resend → Domains → verify storymagicapp.net → copy DNS records; share with Chris | Adds DKIM + SPF records to Cloudflare | Email branding |
| **Enroll TOTP** | Security hygiene | Clerk account settings → Security → Add authenticator app | n/a | Pre-launch security |

---

### Category B — Config Tasks (After Ryan Provides Values)

| Task | Who | Detail |
|------|-----|--------|
| Add Clerk CNAMEs to Cloudflare | Chris | Two DNS records, Proxied = OFF, ~5 min |
| Sync Doppler → Render | Chris | `sync-doppler-to-render.sh` — pushes RESEND_FROM_ADDRESS + any other prd vars |
| Test team invite end-to-end | Ryan | Create team → invite ryanj0894@gmail.com → check inbox → click link |
| Verify Clerk sign-in at app.storymagicapp.net | Ryan | Browser check — should reach dashboard |

---

### Category C — Sprint M Code Work (2026-06-02–12, ~15 SP)

This is the only remaining sprint. Everything in Sprint M is new feature work — the infrastructure is stable.

#### M-1: Schema (1 SP) — ~1 hour
**File:** `packages/web/prisma/schema.prisma` + migration `0024_add_comment_reactions`

`ProjectComment` already exists (Sprint H). We need to add:
- `reactionType String?` — values: `'like' | 'dislike' | 'undecided' | null`
- Index: `@@index([projectId, sceneIndex])` for fast per-scene queries
- Application-level upsert for reactions (Prisma doesn't support partial unique indexes)

#### M-2: Comments API (2 SP) — ~3 hours
**File:** `packages/web/app/api/projects/[id]/comments/route.ts`

Three endpoints:
- `GET /api/projects/[id]/comments` — all comments + reactions (owner or team member scope)
- `POST /api/projects/[id]/comments` — create comment OR upsert reaction (body determines which)
- `DELETE /api/projects/[id]/comments/[commentId]` — delete own comment; 403 for non-owner

#### M-3: Unit Tests for API (1 SP) — ~1 hour
4 tests: create comment, reaction upsert replaces old, GET scope enforcement, DELETE 403.

#### M-4: ScreenplayPlayer Component (3 SP) — ~4 hours
**File:** `packages/web/components/project/ScreenplayPlayer.tsx`

The centerpiece of Sprint M. Renders screenplay text in proper format from `project.scriptText`, synced to audio playback position via `audioTimestampMs` from the manifest. Features:
- Scene headings, character names, dialogue, action lines — styled in screenplay convention
- Active dialogue line highlights as audio plays
- Left-border indicators on annotated lines (amber = note, green = like, red = dislike, gray = undecided)

This component replaces the current basic audio player on completed projects.

#### M-5: Hover-to-Annotate (2 SP) — ~3 hours
On hover over any scene/dialogue block: "+" icon appears at left margin. Click → popover with textarea. Save → POST to comments API → note indicator appears on that line. Click existing indicator → view/edit/delete.

#### M-6: Notes Panel Sidebar (2 SP) — ~3 hours
**File:** `packages/web/components/project/NotesPanel.tsx`

Lists all notes in timestamp order. Each entry shows scene number, timestamp, user name (enterprise), note text, reaction. Clicking any note jumps audio + screenplay to that moment. Reaction buttons (Like/Dislike/Undecided) per scene — one per user per scene, active state persists.

#### M-7: Project Page Integration (1 SP) — ~1 hour
Wire `ScreenplayPlayer` + `NotesPanel` into the project page. Rule: show screenplay player only for `status = completed` jobs; keep existing audio player for in-progress jobs.

#### M-8: Enterprise Dashboard — Notes Tab (2 SP) — ~3 hours
New "Notes & Reactions" tab in the enterprise dashboard. Shows all activity from all team members filterable by user / reaction type / project. This is the enterprise feature Ryan's clients need: master account visibility into team feedback.

#### M-9: E2E Tests (2 SP) — ~2 hours
6 tests in `screenplay-notes.authenticated.spec.ts` (already written as stubs in Sprint J, need `.skip` guards removed):
- Hover → icon → popover → save → indicator
- Refresh → note persists
- Like reaction saves + shows active
- Notes panel lists note with correct timestamp
- Enterprise dashboard shows team notes (mocked)

---

## 4. Sprint Plan and Timeline

```
TODAY (2026-05-15)
  ✅ Sprint K COMPLETE — Full script chunking deployed
  ✅ Sprint L COMPLETE — Progressive playback deployed
  ⏳ Ryan action items (J-0a, J-1b): needed NOW to unblock app

SPRINT J (2026-05-16–18, ~4 SP)
  Chris: Clerk CNAMEs + Resend domain (once Ryan provides values)
  Ryan: Clerk CNAME values + Doppler prd update + invite test
  Checkpoint J: app loads, invites work

SPRINT K LIVE TEST (2026-05-19–25)
  Ryan: test 90-page script end-to-end on staging
  Ryan: test 150-page script (20–30 min, partial OK)
  Ryan: provide Anthropic + Google AI keys to Render env for corpus ingestion
  Checkpoint K: long scripts confirmed working

SPRINT L LIVE TEST (continues through 2026-05-29)
  Ryan: confirm audio starts within 90s on a fresh run
  Ryan: confirm same character = same voice across scenes
  Ryan: confirm music/ambience tone feels appropriate for genre
  Checkpoint L: AI quality confirmed

SPRINT M (2026-06-02–12, ~15 SP)
  Chris: M-1 through M-9 (see above)
  Ryan: UAT notes system mid-sprint (test annotating a completed script)
  Checkpoint M / LAUNCH GO-NO-GO: ~2026-06-12

TARGET LAUNCH: mid-June 2026
```

---

## 5. Go/No-Go Criteria for Launch (v3.0.0)

All of the following must be TRUE before Chris declares launch-ready:

- [ ] `app.storymagicapp.net` loads dashboard — no DNS error
- [ ] Clerk sign-in works (requires Clerk CNAMEs)
- [ ] 90-page script processes end-to-end without failure (Ryan live test)
- [ ] First audio segment starts within 90 seconds
- [ ] Team invite email reaches inbox and link works
- [ ] Screenplay notes: create → save → persist on refresh
- [ ] Master account sees all team notes in enterprise dashboard
- [ ] All Playwright E2E specs pass in CI (`pnpm test:e2e`)
- [ ] Zero open P0/P1 errors in Sentry after 24h of Ryan testing
- [ ] **Ryan signs off**

---

## 6. Post-Launch Backlog (v3.1+, no date)

These are real but not blocking launch:

| Item | SP | Why Deferred |
|------|----|-------------|
| Corpus ingestion on Render (StoryScore calibration) | 2 | Needs Ryan to provide AI keys to Render |
| StoryScore / per-project AI quality scoring | 8 | Intelligence feature — needs corpus first |
| Mobile-responsive screenplay player | 3 | Desktop-first launch OK for enterprise |
| Export notes as PDF/CSV | 3 | Nice-to-have; clients can screenshot for now |
| Webhook events for team activity | 5 | Enterprise tier only — after v3.0 |
| SOC 2 / TPN compliance preparation | 13 | Future enterprise contracts |

---

## 7. Open Questions for Ryan

1. **Clerk CNAMEs:** Can you pull the CNAME targets from the Clerk dashboard today? (Production → Domains → DNS Records). Two values needed: one for `clerk.storymagicapp.net`, one for `accounts.storymagicapp.net`.

2. **90-page test:** Do you have a 90-page script ready to test once Sprint K is confirmed live? Even a public-domain script (e.g., a feature film) works fine.

3. **Sprint M priority:** Is the Screenplay Player + Notes the right final feature before launch? Or is there something else clients are asking for that should displace it?

4. **AI keys for Render:** The StoryScore corpus ingestion needs `ANTHROPIC_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` set in Render's environment. Can you add those, or should Chris use the existing keys from `.env.local`?

5. **Launch date:** Mid-June is achievable if Sprint M starts on June 2 as planned. Is there a hard date from a client, or is "by end of June" still the constraint?

---

## 8. Key Files Reference

| File | Purpose |
|------|---------|
| `docs/launch-plan/2026-05-15/TODO.md` | Full task checklist with acceptance criteria |
| `docs/launch-plan/2026-05-15/ROADMAP.md` | Sprint milestones + go/no-go criteria |
| `docs/launch-plan/2026-05-15/00-LAUNCH-PLAN.md` | Technical assessment of Ryan's requirements |
| `docs/UAT-2026-05-07.md` | 123 UAT test cases (sections 1–19) |
| `packages/web/e2e/` | All 5 Playwright spec files |
| `packages/orchestrator/knowledge_bases/audio_selection_knowledge.json` | Genre→audio group mappings |

---

*Prepared 2026-05-15 by Chris Therriault. Deploy: both Render services live on commit 9de0e99.*
