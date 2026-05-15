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

- [ ] **L-3a** — Test: mocked job status returns `firstAudioUrl` on 2nd poll → player appears before `status: 'completed'`
- [ ] **L-3b** — Test: UI never shows text containing "chunk" or "segment" during generation
- [ ] **L-3c** — Test: buffer indicator appears when `segments[last].status !== 'ready'` and playback position is within 10s of end
  - *Done when:* All 3 tests pass

---

### L-4: AI Quality — Character Registry (2 SP)

**File:** `packages/orchestrator/src/director/pipeline.ts`

- [ ] **L-4a** — Add `extractCharacters(scriptText: string): CharacterProfile[]` — first LLM pass over full script (or first chunk) to extract all named characters + descriptions
  - Output: `[{ name: 'SARAH', description: '30s, tired but determined, female', voiceId?: string }]`
- [ ] **L-4b** — Pass `characterRegistry` to every scene's voice-assignment LLM call: "Use these voice assignments for consistency: SARAH → voice-id-xxx, MARCUS → voice-id-yyy"
- [ ] **L-4c** — Persist character registry in `job.metadata` so it survives segment boundaries
  - *Done when:* Same character has same voice ID in scene 1 and scene 20 of a 50-page test script

---

### L-5: AI Quality — Genre/Tone Context (1 SP)

**File:** `packages/orchestrator/src/director/pipeline.ts`

- [ ] **L-5a** — Add `extractScriptContext(scriptText: string): ScriptContext` — quick LLM call (or regex heuristics) to determine genre, tone, era
  - Output: `{ genre: 'thriller', tone: 'dark, tense', era: '1980s', setting: 'Los Angeles' }`
- [ ] **L-5b** — Prepend context to every scene-level music/SFX selection prompt
  - *Done when:* Thriller scripts select dark/tense music; romance scripts select warm music

---

### L-6: Audio Catalog Audit (2 SP)

**Files:** Catalog JSON files in `packages/orchestrator/src/lib/`

- [ ] **L-6a** — Audit current catalog: list all music categories and SFX categories
- [ ] **L-6b** — Identify top 10 missing categories (run test scripts in each genre, find "no match" fallbacks)
- [ ] **L-6c** — Add entries for missing categories (use ElevenLabs sound effects library or Freesound.org CC0 equivalents)
  - *Done when:* Thriller, romance, sci-fi, comedy genre test scripts all produce genre-appropriate music selections

**Checkpoint L:** Audio starts within 90 seconds; same character = same voice; genre context shapes music.

---

## Phase 3 — Screenplay Player + Notes (Sprint M, 2026-06-02–12)

### M-1: Schema — Comment Reactions (1 SP)

**Files:** `packages/web/prisma/schema.prisma`, migration `0024_add_comment_reactions.sql`

- [ ] **M-1a** — Add `reactionType String?` to `ProjectComment` — values: `'like'|'dislike'|'undecided'|null`
- [ ] **M-1b** — Add `@@unique([projectId, userId, sceneIndex])` partial unique where `reactionType IS NOT NULL` (one reaction per user per scene)
  - Actually: implement as application-level upsert since Prisma doesn't support partial unique
- [ ] **M-1c** — Add index: `@@index([projectId, sceneIndex])`
  - *Done when:* Migration applied, Prisma client regenerated

---

### M-2: Comments API Endpoints (2 SP)

**File:** `packages/web/app/api/projects/[id]/comments/route.ts`

- [ ] **M-2a** — `GET /api/projects/[id]/comments` — returns all comments + reactions for the project (owner or team member)
  - Response: `{ comments: Array<{ id, sceneIndex, audioTimestampMs, text, reactionType, userId, user: {name}, createdAt }> }`
- [ ] **M-2b** — `POST /api/projects/[id]/comments` — create comment or upsert reaction
  - Body: `{ sceneIndex, audioTimestampMs?, text?, reactionType? }`
  - Reaction upsert: if `reactionType` provided and text is null → upsert (delete existing reaction for this user+scene, insert new)
- [ ] **M-2c** — `DELETE /api/projects/[id]/comments/[commentId]` — delete own comment/reaction
  - *Done when:* Unit tests pass for all three endpoints

---

### M-3: Comments API Unit Tests (1 SP)

**File:** `packages/web/tests/unit/comments-api.test.ts`

- [ ] **M-3a** — Test: POST creates comment with correct sceneIndex + audioTimestampMs
- [ ] **M-3b** — Test: POST with reactionType upserts (replaces existing reaction for same user+scene)
- [ ] **M-3c** — Test: GET returns only comments for the requesting user's accessible projects
- [ ] **M-3d** — Test: DELETE by non-owner returns 403
  - *Done when:* 4+ tests pass

---

### M-4: ScreenplayPlayer Component (3 SP)

**File:** `packages/web/components/project/ScreenplayPlayer.tsx`

- [ ] **M-4a** — Render screenplay text in screenplay format (scene headings, character names, dialogue, action lines) from `project.scriptText`
- [ ] **M-4b** — Sync text scroll position to audio playback time using `audioTimestampMs` from the manifest
- [ ] **M-4c** — Highlight active dialogue line (the one currently being spoken)
- [ ] **M-4d** — Lines with existing notes: show colored left-border indicator (amber for notes, green for like, red for dislike, gray for undecided)
  - *Done when:* ScreenplayPlayer renders correct formatting; active line highlights during audio playback

---

### M-5: Hover-to-Annotate (2 SP)

**File:** `packages/web/components/project/ScreenplayPlayer.tsx`

- [ ] **M-5a** — On mouse hover over any scene/dialogue block: show small "+" icon at left margin
- [ ] **M-5b** — Click "+" → open note overlay (popover with textarea + Save/Cancel)
- [ ] **M-5c** — Save → `POST /api/projects/[id]/comments` → close popover → show note indicator on that line
- [ ] **M-5d** — Click existing indicator → open existing note for viewing/editing/deleting
  - *Done when:* Can add a note to any line; note persists on page refresh; can delete note

---

### M-6: Notes Panel Sidebar (2 SP)

**File:** `packages/web/components/project/NotesPanel.tsx`

- [ ] **M-6a** — Panel lists all notes for the project in timestamp order
- [ ] **M-6b** — Each note shows: scene number, timestamp, user name (for master accounts), note text, reaction indicator
- [ ] **M-6c** — Click note → jump audio to that timestamp + scroll screenplay to that line
- [ ] **M-6d** — Reaction buttons: Like / Dislike / Undecided — one per scene, active state shows selection
  - *Done when:* Panel shows all notes; clicking jumps to correct position; reaction selection saves

---

### M-7: Screenplay Player — Project Page Integration (1 SP)

**File:** `packages/web/app/projects/[id]/listen/page.tsx` or `project-workflow.tsx`

- [ ] **M-7a** — Replace current basic audio player with `<ScreenplayPlayer>` + `<NotesPanel>` layout when project status = completed
- [ ] **M-7b** — Keep basic audio player for in-progress jobs (shows while generating)
  - *Done when:* `/projects/[id]` shows screenplay player for completed projects

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
