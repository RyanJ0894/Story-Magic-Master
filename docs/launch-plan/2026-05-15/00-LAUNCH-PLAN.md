# Story Magic — June Launch Plan & Technical Assessment

**Date:** 2026-05-15  
**Author:** Chris Therriault  
**Version:** v2.0.0-beta  
**Based on:** Ryan's launch requirements email + codebase audit

---

## Executive Summary

Ryan's six requirements are the right ones. Here's the candid state of each:

| Requirement | Built? | Working? | Severity | SP to Fix |
|-------------|--------|----------|----------|-----------|
| **App reachable at all** | ✅ | ❌ DNS missing | P0 — BLOCKER | 0 (config) |
| Full script processing (150 pages) | Partial | ❌ Never tested beyond ~4 pages | Critical | ~13 SP |
| Near-instant playback (chunked) | Architecture exists | ❌ Not wired into UX | High | ~8 SP |
| AI audio direction quality | ✅ | ⚠️ Inconsistent | Medium | ~5 SP |
| Team / enterprise (invites) | ✅ | ❌ Invite email errors | High | ~2 SP |
| Screenplay player + notes | ❌ Not built | ❌ | High | ~13 SP |

**Total remaining:** ~41 SP across 5 active work items + 1 config fix  
**June launch:** Achievable with 3–4 focused development weeks

---

## 0. IMMEDIATE BLOCKER — App Is Down (P0, ~30 min)

### What Ryan sees
> "app.storymagicapp.net and the onrender URLs give: DNS_PROBE_FINISHED_NXDOMAIN for clerk.storymagicapp.net"

### Root cause

The app is **completely broken** and has been since DNS moved to Cloudflare. Here's why.

Clerk's production mode with a custom domain requires two DNS subdomains:
- `clerk.storymagicapp.net` — Clerk's frontend JavaScript API loads from here
- `accounts.storymagicapp.net` — sign-in/sign-up pages are served from here

We added `app.storymagicapp.net` → Render, but not these two Clerk-specific records. Without them Clerk's JS cannot load, and the entire app fails before rendering even one page.

**Evidence:** `packages/web/middleware.ts:34` has these domains hardcoded in the Content Security Policy:
```
script-src 'self' 'unsafe-inline' https://clerk.storymagicapp.net ...
connect-src ... https://clerk.storymagicapp.net https://accounts.storymagicapp.net ...
```

### Fix (Ryan action + 5 min of DNS work)

**Step 1 — Ryan:** Open the Clerk dashboard → [Production] → Domains → Custom Domain. Under "DNS records required," Clerk shows two CNAME records to add. They look something like:
```
clerk.storymagicapp.net   →  frontend-api.clerk.com
accounts.storymagicapp.net →  accounts.clerk.com
```
The exact target values are unique to Story Magic's Clerk instance. Copy them.

**Step 2 — Chris:** Add both CNAMEs in Cloudflare DNS for `storymagicapp.net` (same process as `app.storymagicapp.net`). Proxied = OFF for these two (Clerk requires direct DNS, not Cloudflare proxy).

**Step 3:** Propagation takes 1–5 minutes. App will be live.

**This is the single highest-priority item. Nothing else matters until the app loads.**

---

## 1. Full Script Processing Stability (150 pages)

### Ryan's requirement
> "Process full-length feature film screenplays up to approximately 150 pages without failures or major inconsistencies."

### Current state

Ryan is correct — the system has never successfully processed beyond ~4 pages in production. Here's why.

**The architecture works like this today:**
1. User clicks "Generate Audio" → web app queues a job
2. Queue worker picks it up and makes one HTTP request to the orchestrator: `POST /orchestrate` with the entire script text
3. Orchestrator runs the Director pipeline (LLM parses all scenes) then generates TTS + mixing for every scene in one pass
4. HTTP request only returns when the entire script is done

**Why 150 pages fails:**
- A 150-page screenplay has ~120–200 scenes and thousands of dialogue lines
- LLM parsing the whole script at once exceeds context limits (~120k tokens for Claude Sonnet)
- Even if parsing succeeds, TTS for 200 scenes takes 15–40 minutes
- Render's free/starter plan instances time out HTTP connections after ~30 minutes
- The orchestrator's mixer timeout scales to max 300 seconds (5 min) per scene — for 200 scenes that's hours

**What IS built that we can build on:**
- `parallel-tts.ts` — already processes all scenes' TTS in parallel, not sequentially
- `progressive-stitch.ts` — assembles scenes as their TTS completes
- Job queue in the web app (creates job → worker picks it up → polls for status)
- `PlaybackManifest` format already supports per-scene audio URLs

**What needs to be built:**

### Fix: Script-Level Chunking (13 SP)

The approach is to chunk the script at the **Director level** (before orchestration), not at the TTS level:

```
150-page script
  → Director chunks into 6 × 25-page segments
  → Each segment becomes a separate orchestrator call
  → Segments can run in parallel (2–3 at once)
  → Final audio is concatenated segment by segment
  → Total time: ~8–12 min (vs 40+ min as one shot)
```

**Tasks:**
- **SP-1 (3 SP):** Add `chunkScript(text, maxPages)` to Director pipeline. Split at act/scene boundaries, not mid-scene. Output: array of script segments with scene numbering preserved.
- **SP-2 (3 SP):** Update generation processor to loop over segments: queue 1 job per segment, process 2–3 in parallel, collect segment audio URLs.
- **SP-3 (3 SP):** Add segment concatenation step after all segments complete. Stitch final M4A with correct crossfades between last scene of segment N and first scene of segment N+1.
- **SP-4 (2 SP):** Update job progress reporting to show per-segment progress: "Processing pages 1–25 (segment 1 of 6)…"
- **SP-5 (2 SP):** Stress test with actual 90-page and 150-page scripts. Fix any issues found.

**Files touched:** `packages/orchestrator/src/director/pipeline.ts`, `packages/web/lib/generation/processor.ts`, `packages/orchestrator/src/orchestrator/workers/export.ts`

---

## 2. Near-Instant Playback Through Chunked Processing

### Ryan's requirement
> "Begin listening within approximately 1–2 minutes after uploading. Process in ordered chunks. Once first chunk is processed, playback becomes immediately available."
> "User should NOT see anything referencing 'chunks' or segmented processing."

### Current state

Chunking is architecturally present (`progressive-stitch.ts`, parallel TTS) but not surfaced to the user. Today the player only appears after the entire job completes — there's no "chunk 1 is ready, start playing" flow.

The 1–2 minute target for first audio is achievable for a 25-page chunk (the first segment in the fix above). A 25-page chunk with ~30–40 scenes at ~3 seconds TTS per line should complete in ~60–90 seconds with parallel processing.

### Fix: Progressive Playback UX (8 SP)

This depends on the chunking fix above (SP-1 through SP-3). Once chunking is in place:

- **SP-6 (2 SP):** Update `Job` DB model: add `segments` JSON field tracking each segment's status (`processing | ready`) and audio URL when ready.
- **SP-7 (2 SP):** Update job progress endpoint (`/api/jobs/[id]/status`) to return per-segment readiness. The frontend player polls this.
- **SP-8 (2 SP):** Update the project audio player: when first segment URL appears in job status, start playing immediately. As subsequent segments complete, append their audio to the player queue silently. User just hears the story — no "loading segment 2" UI.
- **SP-9 (2 SP):** Handle edge case: if user's playback catches up to unprocessed content (theoretically impossible at normal listening speed but possible if generation stalls), show a non-jarring "preparing next section" buffer indicator rather than silence.

**Key UX rule (Ryan's requirement enforced in code):** The word "chunk," "segment," or any reference to processing batches must not appear in any user-facing string. We brand it as "Fast Start" — the script processes and plays almost immediately.

**Files touched:** `packages/web/prisma/schema.prisma`, `packages/web/app/api/jobs/[id]/status/route.ts`, `packages/web/app/projects/[id]/page.tsx` or the project audio player component.

---

## 3. AI Audio Direction Quality

### Ryan's requirement
> "Consistently select accurate voices, background SFX, background music. Voice casting appropriate to genre, tone, age, character descriptions. Music and sound design enhance scenes without feeling random."

### Current state

The Director pipeline uses Claude Sonnet 4.6 to:
1. Parse scenes and character descriptions
2. Select voices from the ElevenLabs catalog for each character
3. Select music and SFX from an internal catalog

The inconsistency issues fall into two categories:

**A) Character voice drift across scenes** — LLM may assign different voices to the same character in different scenes if the character profile isn't explicitly carried forward. Each scene's LLM call needs to see the character→voice mapping established in scene 1.

**B) Music/SFX mismatch** — The internal audio catalog may have limited entries, causing the LLM to pick the "closest available" option rather than an appropriate one for the genre.

**C) Genre/tone context loss** — The script's overall genre (thriller vs. romantic drama vs. sci-fi) should inform every voice and music selection, but if that context isn't in every scene-level prompt, selections can feel random.

### Fix: Director Quality Pass (5 SP)

- **SP-10 (2 SP):** Add a **character registry** to the Director pipeline: first pass over the script extracts all characters + descriptions. This registry is passed explicitly to every scene's LLM call so voice assignments are consistent. Characters with the same name get the same voice ID every time.
- **SP-11 (1 SP):** Add **script-level genre/tone extraction** as a preprocessing step. Output: `{ genre: "thriller", tone: "dark, tense", setting: "1970s Los Angeles" }`. This metadata is included in every scene-level prompt.
- **SP-12 (2 SP):** Expand the audio catalog. Review the existing SFX/music catalog entries and fill in the most common gaps: action/thriller music, romance/drama music, period-appropriate SFX categories. More catalog entries = less "random" picks.

**Files touched:** `packages/orchestrator/src/director/pipeline.ts`, `packages/orchestrator/src/director/prompts/`, catalog JSON files.

---

## 4. Team / Enterprise Functionality

### Ryan's requirement
> "Master accounts can send invitations. Invited users correctly attach under the master account. Master accounts can view user comments/notes, script statuses, Like/Dislike/Undecided selections. Permissions stable."

### Current state

The team system (create team, invite by email, accept invite, view shared projects) is built and the invite logic exists in `packages/web/lib/services/teams.ts`. Invites use Resend to send the email.

**Why invites error:** Almost certainly one of these:
1. `RESEND_API_KEY` is not in Doppler prd (easy to verify and fix)
2. Resend's sending domain (`storymagicapp.net` or `servicevision.io`) is not verified in Resend's dashboard
3. The invite email sends from `noreply@storymagicapp.net` but that address has no MX/SPF record set up for outbound sending via Resend (only inbound is configured via Cloudflare Email Routing)

The Like/Dislike/Undecided system depends on `ProjectComment` or a separate reactions model — this may or may not be wired to the team view.

### Fix: Team Invite Debug + Reactions (2 SP)

- **SP-13 (1 SP):** Diagnose invite failure: Check Doppler prd for `RESEND_API_KEY`. Check Resend dashboard for domain verification status. If needed, add Resend's DNS records (DKIM/SPF) for `storymagicapp.net` to Cloudflare, or change the from-address to one that's already verified (`noreply@servicevision.io` is an option until `storymagicapp.net` is verified). Test an actual invite end-to-end.
- **SP-14 (1 SP):** Verify master account dashboard shows invited users' activity. If the Like/Dislike/Undecided reactions UI isn't wired to the enterprise dashboard yet, wire it (the `ProjectComment` model tracks this per Issue #24 which also covers the notes system).

---

## 5. Screenplay Audio Player + Notes System

### Ryan's requirement (GitHub Issue #24)
> "Screenplay-style audio player allowing users to add notes/comments tied to specific script locations. Save and revisit notes. Notes remain synced to screenplay/audio locations. Master accounts can view notes from connected subaccounts."
> "Like, Dislike, Undecided selections visible to master account."

### Current state

Not built in the current web app. A prototype version existed (screenshot in Issue #24) showing screenplay text rendered alongside the audio player with hover-to-annotate functionality.

The `ProjectComment` model already exists in the Prisma schema with `sceneIndex` and `audioTimestampMs` columns (added in Sprint H). This is the data layer — it just needs a UI.

### Build Plan: Screenplay Player + Notes (13 SP)

This is the most user-facing feature on the list and the one that most differentiates Story Magic for enterprise clients. It needs to be built carefully.

- **SP-15 (3 SP):** **Screenplay text renderer.** Show the script text alongside the audio player. Formatted screenplay-style (scene headings, character names, dialogue blocks). Scroll position locked to current playback position (auto-scroll as audio plays).
- **SP-16 (2 SP):** **Hover-to-annotate.** When mouse hovers over any dialogue line or scene heading, show a small "+" note icon. Clicking opens a text input overlay. On save, creates a `ProjectComment` row with `sceneIndex` and `audioTimestampMs`.
- **SP-17 (2 SP):** **Note indicators.** Lines with saved notes show a colored dot/highlight. Clicking the dot opens the existing note for editing or viewing. Notes panel in sidebar lists all notes for the project with timestamps and jump-to links.
- **SP-18 (2 SP):** **Like / Dislike / Undecided reactions.** Per-scene reaction buttons (thumbs up / thumbs down / question mark). Stored in `ProjectComment` with a `reactionType` field. Only one reaction per user per scene.
- **SP-19 (2 SP):** **Master account view.** Enterprise dashboard shows all notes + reactions from connected team members. Filter by user, by reaction type, by script location. This is the core enterprise value prop.
- **SP-20 (2 SP):** **API endpoints + tests.** `POST /api/projects/[id]/comments`, `GET /api/projects/[id]/comments`, `DELETE /api/projects/[id]/comments/[commentId]`. Tests for all endpoints.

**Files to create/modify:**
- `packages/web/app/projects/[id]/screenplay-player.tsx` (new component)
- `packages/web/app/api/projects/[id]/comments/route.ts` (new or extend existing)
- `packages/web/app/dashboard/enterprise/page.tsx` (extend for notes view)
- `packages/web/prisma/schema.prisma` (add `reactionType` to `ProjectComment` if not present)

---

## Sprint Plan — June Launch

Ordered by dependency and impact:

### Sprint J: Unblock + Invites (Week 1, ~3 SP)
**Goal: App is live and team features work**

| Task | SP | Owner |
|------|----|-------|
| DNS: Add `clerk.storymagicapp.net` + `accounts.storymagicapp.net` CNAMEs | 0 | Ryan (Clerk dashboard) + Chris (DNS) |
| Fix team invite emails (Resend key + domain verify) | 1 | Chris |
| Verify master account dashboard shows invited users | 1 | Chris |
| SP-11: Script-level genre/tone extraction | 1 | Chris |

*At the end of Sprint J: App is accessible, invites work, team features confirmed stable.*

---

### Sprint K: Full Script Stability (Week 2, ~13 SP)
**Goal: 90-page scripts process reliably end-to-end**

| Task | SP | Owner |
|------|----|-------|
| SP-1: Director script chunker (25-page segments) | 3 | Chris |
| SP-2: Generation processor looping over segments | 3 | Chris |
| SP-3: Segment audio concatenation | 3 | Chris |
| SP-4: Per-segment job progress reporting | 2 | Chris |
| SP-5: Stress test with 90-page script | 2 | Ryan (test) + Chris (fix) |

*At the end of Sprint K: 90-page scripts process without failure. 150-page target needs one more round of testing.*

---

### Sprint L: Chunked UX + AI Quality (Week 3, ~13 SP)
**Goal: Fast-start playback + consistent voice/music selection**

| Task | SP | Owner |
|------|----|-------|
| SP-6: Segment readiness tracking in DB | 2 | Chris |
| SP-7: Job status endpoint returns per-segment URLs | 2 | Chris |
| SP-8: Progressive audio player (plays chunk 1 while rest processes) | 2 | Chris |
| SP-9: Buffer indicator edge case | 2 | Chris |
| SP-10: Character registry for consistent voice assignment | 2 | Chris |
| SP-12: Audio catalog expansion | 2 | Chris |
| SP-14: Like/Dislike/Undecided wired to enterprise dashboard | 1 | Chris |

*At the end of Sprint L: Users can start listening within 2 minutes. Same character = same voice throughout the script.*

---

### Sprint M: Screenplay Player + Notes (Week 4, ~13 SP)
**Goal: Core enterprise notes feature complete**

| Task | SP | Owner |
|------|----|-------|
| SP-15: Screenplay text renderer with auto-scroll | 3 | Chris |
| SP-16: Hover-to-annotate overlay | 2 | Chris |
| SP-17: Note indicators + notes sidebar panel | 2 | Chris |
| SP-18: Like/Dislike/Undecided per-scene reactions | 2 | Chris |
| SP-19: Master account notes + reactions dashboard | 2 | Chris |
| SP-20: API endpoints + tests | 2 | Chris |

*At the end of Sprint M: Enterprise notes feature complete. Story Magic is launch-ready.*

---

## June Launch Readiness Assessment

Ryan estimated 70% — I'd put it at **65%** with this breakdown:

| Area | Score | What's Needed |
|------|-------|---------------|
| Infrastructure / DNS | 90% | Just the 2 Clerk CNAME records |
| Core audio pipeline (short scripts) | 75% | Working, but timeout-prone |
| Full script processing | 20% | Chunking must be built |
| Progressive playback | 30% | Architecture exists, UX not wired |
| AI quality consistency | 55% | Character registry + genre context fix |
| Team / invites | 60% | Invite email fix likely 1-line fix |
| Notes / screenplay player | 0% | Not built yet |
| Overall | **65%** | |

**Realistic timeline:** 4 focused development weeks (Sprints J–M) puts the app at launch-ready in mid-June. The work is well-scoped and the architecture is solid — nothing requires a rewrite.

**The one thing that can slip the timeline:** Ryan's test feedback during Sprint K is critical. Full-script processing with real screenplays will surface edge cases that can't be found in development. Plan for Ryan to test with actual scripts the moment Sprint K deploys.

---

## Open Actions for Ryan

| Action | Urgency | Instructions |
|--------|---------|-------------|
| Get Clerk CNAME values | **Today** | Clerk Dashboard → [Production] → Domains → look for DNS records to add |
| Enroll personal Clerk TOTP | This week | Clerk account settings → Security → Add authenticator app |
| Test Sprint K with 90-page script | Week 2 | Will be requested when Sprint K deploys to Render |
| Anthropic + Google AI keys for Render | Week 2 | Needed for corpus ingestion (POST-02) |

---

*Assessment as of 2026-05-15. All SP estimates assume Chris working in full-day sessions. Tests are included in SP estimates.*
