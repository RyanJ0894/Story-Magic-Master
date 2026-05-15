# Story Magic — Launch TODO

**Date:** 2026-05-15  
**Format:** Phase → Sprint → Task → Acceptance Criteria  
**Status key:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Phase 0 — Unblock (Sprint J, 2026-05-16–18)

### J-0: DNS — Clerk subdomains (Config only, ~30 min)

- [ ] **J-0a** — Ryan: open Clerk dashboard → Production → Domains → copy CNAME targets for `clerk.storymagicapp.net` and `accounts.storymagicapp.net`
  - *Done when:* Ryan has two CNAME target values in hand
- [ ] **J-0b** — Chris: add `clerk.storymagicapp.net` CNAME to Cloudflare DNS (Proxied = OFF)
  - *Done when:* `dig clerk.storymagicapp.net CNAME` resolves to Clerk's target
- [ ] **J-0c** — Chris: add `accounts.storymagicapp.net` CNAME to Cloudflare DNS (Proxied = OFF)
  - *Done when:* `dig accounts.storymagicapp.net CNAME` resolves
- [ ] **J-0d** — Verify: open `app.storymagicapp.net` in browser → dashboard loads, Clerk sign-in works
  - *Done when:* No DNS_PROBE_FINISHED_NXDOMAIN error; login works

---

### J-1: Team Invite Email Fix (2 SP)

**Files:** `packages/web/lib/email/resend.ts`, `packages/web/.env.example`

- [x] **J-1a** — Add `RESEND_FROM_ADDRESS` env var support so from-address is configurable without a code deploy
  - *Done:* `FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'Story Magic <noreply@storymagicapp.net>'` — commit d69cccd
- [ ] **J-1b** — Add `RESEND_FROM_ADDRESS=Story Magic <noreply@servicevision.io>` to Doppler prd (servicevision.io is already verified in Resend)
  - *Done when:* Doppler prd has the var; `sync-doppler-to-render.sh` pushes it
- [ ] **J-1c** — Test invite: create team → invite `ryanj0894@gmail.com` → email arrives with correct link
  - *Done when:* Email received; clicking invite link opens `/invite/[token]` and prompts to join team
- [ ] **J-1d** — When Resend verifies `storymagicapp.net` (add DKIM/SPF DNS records in Cloudflare), update `RESEND_FROM_ADDRESS` back to `noreply@storymagicapp.net`
  - *Done when:* Resend shows domain verified; email sends from storymagicapp.net address

---

### J-2: E2E — Team Invite Flow (1 SP)

**File:** `packages/web/e2e/team-invite.authenticated.spec.ts`

- [x] **J-2a** — Write `team-invite.authenticated.spec.ts` with mocked API routes
  - Tests: create team, send invite, accept invite page loads, member list updates — commit d69cccd

---

### J-3: E2E — Upload Flow Hardening (1 SP)

**File:** `packages/web/e2e/upload-screenplay.authenticated.spec.ts`

- [x] **J-3a** — Write upload spec: drag-drop zone, file type validation (.fountain, .fdx, .pdf, .docx), size limit, auto-name from filename, upload button state — commit d69cccd

**Checkpoint J:** `app.storymagicapp.net` loads, invites work, 2 new E2E specs pass.

---

## Phase 1 — Full Script Stability (Sprint K, 2026-05-19–25)

### K-1: Director — Script Chunker (3 SP)

**File:** `packages/orchestrator/src/director/pipeline.ts`

- [x] **K-1a** — Implement `chunkScript(text: string, scenesPerChunk: number): ScriptChunk[]`
  - Splits at INT./EXT./INT/EXT. scene headings (never mid-scene)
  - Default `scenesPerChunk = 15` (≈ 25 pages/chunk for real scripts at ~1.5p/scene)
  - Falls back to single chunk for scripts with no recognisable scene headings
  - *Done:* `packages/orchestrator/src/director/utils/script-chunker.ts` — 17 tests passing
- [x] **K-1b** — Add `chunkScript` export to director pipeline public API
  - *Done:* Re-exported from `pipeline.ts` (commit with K-3b)
- [x] **K-1c** — Unit tests: `packages/orchestrator/src/director/utils/script-chunker.test.ts`
  - 17 tests: exact boundary, no-heading fallback, single chunk, 90-page (4 chunks), 150-page (6 chunks), contiguous coverage

---

### K-2: DB — Job Segments Column (1 SP)

**Files:** `packages/web/prisma/schema.prisma`, migration `0023_add_job_segments.sql`

- [x] **K-2a** — Add `segments Json?` column to `Job` model + `firstAudioUrl String?` — commit e27af1c (migration 0023)
- [ ] **K-2b** — Add `segmentCount Int?` to `Job` for fast queries without JSON parse (deferred — segments JSON sufficient for now)

---

### K-3: Generation Processor — Segment Loop (3 SP)

**File:** `packages/web/lib/generation/processor.ts`

- [x] **K-3a** — Generation processor: chunkScenes() splits by SCENES_PER_CHUNK=14; segments initialized before loop — commit e27af1c
- [x] **K-3b** — Segments processed sequentially (not parallel batches) to avoid Render memory pressure; batching deferred to Sprint K+
- [x] **K-3c** — After each segment: `segments[i].status = 'ready'` + `audioUrl` written to DB — commit e27af1c
- [x] **K-3d** — Progress events per segment: "Generating audio for scenes 1–14…" (user-facing label, no "chunk"/"segment N of N") — commit e27af1c
- [x] **K-3e** — Segment failure: mark failed, continue with remaining (partial audio guard) — commit e27af1c

---

### K-4: Export Worker — Segment Stitch (3 SP)

**File:** `packages/orchestrator/src/orchestrator/workers/export.ts`

- [x] **K-4a** — Add `concatenateSegments(segmentPaths: string[], outputPath: string): Promise<void>`
  - Reused `concatScenesWithCrossfade` directly in `/stitch-segments` route — commit 84e3a85
- [x] **K-4b** — Update generation processor to call segment stitch after all segments complete — commit 84e3a85
- [x] **K-4c** — Store final stitched URL as `job.audioUrl` (existing field); segment URLs remain in `job.segments` for progressive playback — commit 84e3a85

---

### K-5: Job Status Endpoint — Segments (1 SP)

**File:** `packages/web/app/api/jobs/[id]/status/route.ts`

- [x] **K-5a** — Job status response includes `segments`, `firstAudioUrl`, `audio_url` — commit e27af1c

---

### K-6: E2E — Full Script Processing (3 SP)

**File:** `packages/web/e2e/full-script-processing.authenticated.spec.ts`

- [x] **K-6a** — Test: short script single segment, no chunk UI — `full-script-processing.authenticated.spec.ts` — commit d69cccd
- [x] **K-6b** — Test: multi-segment job, per-segment progress — commit d69cccd
- [x] **K-6c** — Test: segment partial failure — job continues — commit d69cccd
- [x] **K-6d** — Unit tests: processor-chunking.test.ts (7 tests, firstAudioUrl timing, language compliance) — commit e27af1c

**Checkpoint K:** Short and medium scripts process. 90-page script tested live with Ryan. Segment progress visible in UI.

---

## Phase 2 — Fast-Start Playback + AI Quality (Sprint L, 2026-05-26–Jun 1)

### L-1: Progressive Playback — Backend (2 SP)

**Files:** `packages/web/app/api/jobs/[id]/status/route.ts`, `packages/web/lib/generation/processor.ts`

- [x] **L-1a** — Status endpoint: `firstAudioUrl` included in job status response — commit e27af1c
- [x] **L-1b** — Processor: sets `step: 'first_audio_ready'` + `firstAudioUrl` after first successful chunk — commit e27af1c

---

### L-2: Progressive Playback — Frontend Player (2 SP)

**File:** `packages/web/app/projects/[id]/project-workflow.tsx` (or audio player component)

- [x] **L-2a** — When polling detects `firstAudioUrl`: start audio player immediately (don't wait for `status: 'completed'`)
  - *Done:* `progressiveAudioUrl` state + `onFirstAudioReady` wired in project-workflow.tsx — prior sprint
- [x] **L-2b** — As subsequent segment URLs arrive in polling: append to player queue silently
  - *Done:* `onSegmentsUpdate` callback in generate-button fires when ready segment list grows; AudioPlayer `segmentUrls` prop advances `activeSegmentIndex` on `ended`
- [x] **L-2c** — If player catches up to last ready segment: show subtle buffer indicator ("preparing…") — no "chunk"/"segment" language
  - *Done:* `isBuffering` state in AudioPlayer; `showBufferIndicator` prop from parent; auto-resumes when next segment URL arrives
- [x] **L-2d** — "Fast Start" label on generate button tooltip: "Audio starts in ~90 seconds"
  - *Done:* Radix Tooltip wraps idle button when `workflowMode === 'automatic'`

---

### L-3: Progressive Playback — E2E (2 SP)

**File:** `packages/web/e2e/progressive-playback.authenticated.spec.ts`

- [x] **L-3a** — Test: mocked job status returns `firstAudioUrl` on 2nd poll → player appears before `status: 'completed'`
- [x] **L-3b** — Test: UI never shows text containing "chunk" or "segment" during generation
- [x] **L-3c** — Test: buffer indicator appears when `segments[last].status !== 'ready'`
  - *Done:* `progressive-playback.authenticated.spec.ts` — 5 test cases across 4 describe groups; fixed mock (API path + jobId casing)

---

### L-4: AI Quality — Character Registry (2 SP)

**File:** `packages/orchestrator/src/director/pipeline.ts`

- [x] **L-4a** — `extractCharacters`: `CharacterExtractionAgent` (Pass 1) — extracts all speaking characters, injects NARRATOR, supports chunked-parallel extraction for long scripts
- [x] **L-4b** — Character registry (VoiceMap) passed to every `SceneConstructionAgent` chunk call via `scene-construction-prompt.ts` buildVoiceTable
- [x] **L-4c** — VoiceMap persisted in `project.voiceAssignments` (pipeline.ts `saveVoiceMap`); all chunks use identical voiceMap → voice consistency guaranteed
  - *Architecture:* Character extraction runs ONCE per project; voiceMap baked into all directorJson voice_key fields before chunked TTS

---

### L-5: AI Quality — Genre/Tone Context (1 SP)

**File:** `packages/orchestrator/src/director/pipeline.ts`

- [x] **L-5a** — `extractScriptContext(scriptText): ScriptContext` — regex heuristics, ~1ms, 8 tests
  - File: `packages/orchestrator/src/director/utils/script-context.ts`
- [x] **L-5b** — `formatScriptContext` block prepended to AudioDirectorAgent user message in `pipeline.ts`
  - *Done:* Thriller → dark/tense, romance → warm/emotional, sci-fi → futuristic etc.

---

### L-6: Audio Catalog Audit (2 SP)

**Files:** Catalog JSON files in `packages/orchestrator/src/lib/`

- [x] **L-6a** — Audit current catalog: list all music categories and SFX categories
  - *Done:* 39 music tracks/10 groups, 45 ambience/22 groups, 53 SFX/21 groups — gaps: sci-fi music, thin comedy, no horror-specific guidance
- [x] **L-6b** — Identify top 10 missing categories (run test scripts in each genre, find "no match" fallbacks)
  - *Done:* Missing: sci-fi, comedy, horror-specific music guidance + genre→group mapping rules
- [x] **L-6c** — Add entries for missing categories (use ElevenLabs sound effects library or Freesound.org CC0 equivalents)
  - *Done:* Added 2 music_selection_rules (genre→group mapping + sci-fi fallback), 4 music_examples (sci-fi/thriller/comedy/horror), `genre_to_music_group_quick_reference` top-level key → `audio_selection_knowledge.json` now has 6 rules, 15 examples

**Checkpoint L:** Audio starts within 90 seconds; same character = same voice; genre context shapes music.

---

## Phase 3 — Screenplay Player + Notes (Sprint M, 2026-06-02–12)

### M-1: Schema — Comment Reactions (1 SP)

**Files:** `packages/web/prisma/schema.prisma`, migration `0024_add_comment_reactions.sql`

- [x] **M-1a** — Add `reactionType String?` to `ProjectComment` — values: `'like'|'dislike'|'undecided'|null`
- [x] **M-1b** — Application-level upsert: deleteMany existing reaction for same user+scene before insert (Prisma doesn't support partial unique)
- [x] **M-1c** — Added indexes: `(projectId, sceneIndex)`, `(projectId, sceneIndex, reactionType)`, `(audioTimestampMs)`, `(userId)`
  - *Done:* Migration 0024_add_comment_reactions — commit 6be4a43

---

### M-2: Comments API Endpoints (2 SP)

**File:** `packages/web/app/api/projects/[id]/comments/route.ts`

- [x] **M-2a** — `GET /api/projects/[id]/comments` — returns all comments + reactions, access: owner|TeamShare|ScriptShare
- [x] **M-2b** — `POST /api/projects/[id]/comments` — zod-validated, supports text note + reaction upsert; shapeComment() maps body→text
- [x] **M-2c** — `DELETE /api/projects/[id]/comments/[commentId]` — own comment only (403 for non-owner)
  - *Done:* commit 6be4a43

---

### M-3: Comments API Unit Tests (1 SP)

**File:** `packages/web/tests/unit/comments-api.test.ts`

- [x] **M-3a** — Test: POST creates comment with correct sceneIndex + audioTimestampMs
- [x] **M-3b** — Test: POST with reactionType upserts (replaces existing reaction for same user+scene)
- [x] **M-3c** — Test: GET 401/404 scope enforcement + text alias
- [x] **M-3d** — Test: DELETE by non-owner returns 403
  - *Done:* 10 tests in comments-api.test.ts — commit 6be4a43

---

### M-4: ScreenplayPlayer Component (3 SP)

**File:** `packages/web/components/project/ScreenplayPlayer.tsx`

- [x] **M-4a** — Screenplay parser: scene-heading, character, dialogue, action, parenthetical, transition block types
- [x] **M-4b** — Active line highlight via `currentTimeMs` prop (compares against comment audioTimestampMs ±5s)
- [x] **M-4c** — `data-active="true"` on highlighted line; violet background
- [x] **M-4d** — Left-border color: amber (notes), green (like), red (dislike), gray (undecided)
  - *Done:* commit 6be4a43

---

### M-5: Hover-to-Annotate (2 SP)

**File:** `packages/web/components/project/ScreenplayPlayer.tsx`

- [x] **M-5a** — Hover → "+" button appears in right-side action bar (backdrop-blur overlay)
- [x] **M-5b** — Click "+" → NotePopover with textarea + Save/Cancel (auto-focus textarea)
- [x] **M-5c** — Save → POST → optimistic local state update + onCommentAdded callback
- [x] **M-5d** — Note indicator (amber circle) on lines with notes; click seeks to audioTimestampMs
  - *Done:* commit 6be4a43

---

### M-6: Notes Panel Sidebar (2 SP)

**File:** `packages/web/components/project/NotesPanel.tsx`

- [x] **M-6a** — Panel loads all comments on mount; separate "Notes" and "Reactions" sections
- [x] **M-6b** — Each note: user name, clock icon + timestamp, scene number, note text, timeAgo, delete button (own notes)
- [x] **M-6c** — Click note entry → `onSeekTo(audioTimestampMs)` callback
- [x] **M-6d** — Reactions section: icon+label, scene number, user name; deduplicated on `newComment` prop arrival
  - *Done:* commit 6be4a43

---

### M-7: Screenplay Player — Project Page Integration (1 SP)

**File:** `packages/web/app/projects/[id]/listen/page.tsx` or `project-workflow.tsx`

- [x] **M-7a** — ScreenplayPlayer + NotesPanel wired into `isCompleted` blocks (automatic mode + share step accordion)
- [x] **M-7b** — Audio player remains for in-progress jobs; screenplay/notes only shown post-completion
- [x] **M-7c** — `currentUserId` prop threaded from page.tsx Clerk `userId` → ProjectWorkflow → components
  - *Done:* commit 6be4a43

---

### M-8: Enterprise Dashboard — Notes + Reactions Tab (2 SP)

**File:** `packages/web/app/enterprise/dashboard/page.tsx`

- [ ] **M-8a** — Add "Notes & Reactions" tab to enterprise dashboard (alongside existing Projects/Team tabs)
- [ ] **M-8b** — Shows all notes + reactions from all team members, filterable by: user, reaction type, script/project
- [ ] **M-8c** — Each row: member name, project name, scene #, reaction, note text, timestamp
  - *Done when:* Master account sees all team members' notes in one view

---

### M-9: Screenplay Notes E2E Tests (2 SP)

**File:** `packages/web/e2e/screenplay-notes.authenticated.spec.ts`

- [ ] **M-9a** — Test: hover over screenplay line → note icon appears
- [ ] **M-9b** — Test: click "+" → popover opens → type note → Save → note indicator shows on line
- [ ] **M-9c** — Test: page refresh → note indicator still present → click opens saved note text
- [ ] **M-9d** — Test: click Like reaction → button shows active state → POST sent with `reactionType: 'like'`
- [ ] **M-9e** — Test: notes panel lists the newly created note with correct scene + timestamp
- [ ] **M-9f** — Test: enterprise dashboard shows note from current user's team (mocked API)
  - *Done when:* All 6 tests pass

**Checkpoint M — Launch Go/No-Go:**
- [ ] All Playwright specs pass: `pnpm --filter @story-magic/web test:e2e`
- [ ] 90-page script processes end-to-end (Ryan live test)
- [ ] Notes created, saved, and visible to master account (Ryan live test)
- [ ] Zero P0/P1 Sentry errors after 24h of Ryan testing
- [ ] Ryan signs off

---

## Ryan Action Items

| Action | Sprint | Instructions |
|--------|--------|-------------|
| Get Clerk CNAME values | J (today) | Clerk dashboard → Production → Domains → DNS records |
| Enroll personal TOTP | J | Clerk account settings → Security → Add authenticator |
| Test 90-page script | K | Provided by Chris when Sprint K deploys to Render |
| Test 150-page script | K | Same |
| Provide Anthropic + Google AI keys | K | For corpus ingestion (Render env vars) |
| UAT notes + enterprise dashboard | M | Final sign-off checklist in UAT-2026-05-07.md |

---

*TODO as of 2026-05-15. Checked items track completion. Each sprint ends with a named checkpoint.*
