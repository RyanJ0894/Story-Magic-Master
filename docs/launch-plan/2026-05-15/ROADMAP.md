> **Superseded by:** [ROADMAP-2026-05-15.md](../../ROADMAP-2026-05-15.md) — Updated 2026-05-15

# Story Magic — June Launch Roadmap

**Date:** 2026-05-15  
**Target:** Production launch, mid-June 2026  
**Author:** Chris Therriault  
**Supersedes:** docs/ROADMAP-2026-05-07-final.md

---

## Document Map

| File | Purpose |
|------|---------|
| `00-LAUNCH-PLAN.md` | Executive assessment + Ryan's requirements analysis |
| `ROADMAP.md` | ← this file — versioned phases + sprint plan |
| `TODO.md` | Executable task checklist with acceptance criteria |

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v2.0.0-beta | 2026-05-08 | Sprint I complete — all infra blockers resolved |
| **v2.1.0** | **2026-05-22** | **Sprint J+K — app live, 90-page scripts work** |
| **v2.2.0** | **2026-05-29** | **Sprint L — chunked playback + AI quality** |
| **v3.0.0** | **2026-06-12** | **Sprint M — notes system + launch-ready** |

---

## Platform Health Scorecard (as of 2026-05-15)

| Area | Score | Trend | Blocking? |
|------|-------|-------|-----------|
| DNS / Infrastructure | 90% | ↑ | ❌ Yes — Clerk subdomains missing |
| Authentication | 95% | → | Depends on DNS |
| Core audio pipeline (short scripts) | 75% | → | No |
| Full script processing (90–150 pages) | 20% | ↑ | Yes |
| Progressive / fast-start playback | 30% | ↑ | No (enhancement) |
| AI voice + music quality | 55% | ↑ | No (enhancement) |
| Team features (invites) | 60% | → | Invite email broken |
| Screenplay player + notes | 0% | — | New feature required |
| Test coverage | 85% | ↑ | No |
| **Overall** | **65%** | ↑ | |

---

## Phase Overview

```
Phase 0 (NOW)    ─ App unblocked, invites working             ← Sprint J
Phase 1 (Week 2) ─ Full-length scripts process reliably       ← Sprint K
Phase 2 (Week 3) ─ Fast-start playback + consistent AI        ← Sprint L
Phase 3 (Week 4) ─ Screenplay player + notes = launch-ready   ← Sprint M
```

---

## Phase 0 — Unblock (Sprint J)
**Target:** 2026-05-16 → 2026-05-18 | **~4 SP**

### Goal
The app is reachable at `app.storymagicapp.net`. Team invites send and receive correctly.

### Deliverables
- `clerk.storymagicapp.net` + `accounts.storymagicapp.net` CNAME records in Cloudflare
- Resend from-domain verified OR from-address updated to verified domain
- `RESEND_FROM_ADDRESS` env var support (configurable without deploy)
- Team invite end-to-end test confirming email delivery
- E2E: `team-invite.authenticated.spec.ts`

### Checkpoint / Measure
- [ ] `app.storymagicapp.net` loads the dashboard in a browser without DNS error
- [ ] Clerk sign-in works at `app.storymagicapp.net/login`
- [ ] Sending a team invite returns HTTP 201 (not 500)
- [ ] Test invite email arrives in inbox (manual check)
- [ ] `pnpm --filter @story-magic/web test:e2e` — team invite spec passes

---

## Phase 1 — Full Script Stability (Sprint K)
**Target:** 2026-05-19 → 2026-05-25 | **~15 SP**

### Goal
A 90-page screenplay processes from upload to audio without failure. 150-page scripts are tested; edge cases handled.

### Architecture Change
Add script-level chunking **above** the existing scene-level parallelism:

```
Before: script → director (all scenes) → orchestrator (all scenes) → audio
After:  script → chunk (25-page segments) → director per-chunk → orchestrator per-chunk → stitch
```

The existing `progressive-stitch.ts` and `parallel-tts.ts` workers are unchanged — chunking wraps around them.

### Deliverables
- `chunkScript(text, maxPagesPerChunk)` function in Director pipeline
- Generation processor segment loop (2–3 segments in parallel)
- Segment audio concatenation in export worker
- Per-segment job progress events (`{ segment: 2, of: 6, percent: 33 }`)
- Upgrade job DB model: `segments` JSONB column
- Migration `0023_add_job_segments`
- E2E: `full-script-processing.authenticated.spec.ts`

### Checkpoint / Measure
- [ ] 25-page test script: processes in < 5 min, audio plays correctly
- [ ] 90-page test script: processes in < 15 min without timeout
- [ ] 150-page test script: processes (may take 20–30 min) without failure
- [ ] No regression on short (1–4 page) scripts
- [ ] Segment progress events appear in job status endpoint during processing
- [ ] Test suite: all 1,567 + new tests pass

---

## Phase 2 — Fast-Start Playback + AI Quality (Sprint L)
**Target:** 2026-05-26 → 2026-06-01 | **~13 SP**

### Goal
Users hear audio within 90 seconds of uploading. Character voices are consistent throughout. Genre/tone context shapes music and sound design.

### Sub-phases

**L-A: Progressive Playback (8 SP)**
- Job status endpoint returns per-segment readiness + partial audio URLs
- Frontend audio player starts on segment 1 URL; appends segments as ready
- No "chunk" language visible — branded as "Fast Start"
- E2E: `progressive-playback.authenticated.spec.ts`

**L-B: AI Quality Improvements (5 SP)**  
- Character registry: first-pass extracts all characters + descriptions, consistent voice IDs across all scenes
- Script-level genre/tone extraction: metadata included in every scene prompt
- Audio catalog audit: identify and fill top 10 missing SFX/music categories
- E2E: `audio-direction-quality.spec.ts` (mocked, validates prompt construction)

### Checkpoint / Measure
- [ ] 25-page script: first audio segment starts playing within 90 seconds
- [ ] Same character has same voice in scene 1 and scene 20
- [ ] Genre "thriller" → music selections are dark/tense (not upbeat)
- [ ] Player never shows "chunk" or "segment" in UI
- [ ] `pnpm --filter @story-magic/web test:e2e` — progressive playback spec passes

---

## Phase 3 — Screenplay Player + Notes (Sprint M)
**Target:** 2026-06-02 → 2026-06-12 | **~15 SP**

### Goal
Enterprise clients can annotate scripts, leave reactions, and master accounts see all activity from their team.

### Architecture
- `ProjectComment` model already has `sceneIndex` + `audioTimestampMs` (Sprint H)
- Add `reactionType` enum to schema
- New migration `0024_add_comment_reactions`
- New `ScreenplayPlayer` component replaces current audio player on project page
- New `NotesPanel` sidebar component
- Extend enterprise dashboard for notes + reactions view

### Deliverables
- `ScreenplayPlayer` component: screenplay text + audio sync + hover-annotate
- `NotesPanel` sidebar: view/edit all notes, jump-to-timestamp
- Reaction buttons per scene (Like / Dislike / Undecided)
- `POST/GET/DELETE /api/projects/[id]/comments` endpoints (extend existing or create)
- Enterprise dashboard: notes + reactions tab with team filter
- E2E: `screenplay-notes.authenticated.spec.ts`

### Checkpoint / Measure
- [ ] User can hover over a dialogue line and see the note icon
- [ ] Clicking opens note editor; saved note persists on refresh
- [ ] Note has correct scene index and timestamp linked
- [ ] Like/Dislike/Undecided reaction saves and shows color indicator
- [ ] Master account dashboard shows all notes from team members
- [ ] Notes panel lists all notes with timestamps in order
- [ ] E2E spec passes: create note → verify persists → verify in enterprise view

---

## Post-Launch Backlog (v3.1+)

| Item | SP | Priority |
|------|----|---------|
| POST-02: Corpus ingestion on Render (needs Ryan AI keys) | 2 | Medium |
| StoryScore / AI quality scoring per project | 8 | Medium |
| Mobile-responsive screenplay player | 3 | Medium |
| Export notes as PDF/CSV | 3 | Low |
| Webhook events for team activity | 5 | Low |
| SOC 2 / TPN compliance preparation | 13 | Enterprise |

---

## External Blockers

| Blocker | Owner | Needed by | Impact |
|---------|-------|-----------|--------|
| Clerk CNAME targets (from dashboard) | Ryan | Today | App down |
| Resend domain verification for storymagicapp.net | Ryan/Chris | Sprint J | Invite emails |
| Anthropic + Google AI keys on Render | Ryan | Sprint K | Corpus ingestion |
| Personal TOTP enrollment in Clerk | Ryan | Before launch | Security |

---

## Go / No-Go Criteria for v3.0.0 Launch

All of the following must be true:

- [ ] App loads at `app.storymagicapp.net` without DNS error
- [ ] A 90-page script processes end-to-end without failure
- [ ] Audio starts playing within 90 seconds of generation start
- [ ] Team invites send and recipients can accept
- [ ] Screenplay notes: create, save, and persist correctly
- [ ] Master account sees notes from all team members
- [ ] No open P0/P1 bugs in Sentry
- [ ] All Playwright E2E specs pass in CI
- [ ] Ryan signs off after UAT

---

*Single source of truth as of 2026-05-15. Next review: end of Sprint J (2026-05-18).*
