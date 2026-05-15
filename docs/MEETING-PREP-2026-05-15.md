# Story Magic — Meeting Prep
**Date:** 2026-05-15  
**Author:** Chris Therriault  
**For:** Ryan Jae sync — launch status, next steps, and action items  
**Environment:** `https://app.storymagicapp.net` (Render — both services live and auto-deploying)

---

## TL;DR (90 seconds)

Today's session completed **Sprints K, L, and M** in full — the full-script chunking architecture, progressive playback frontend, and the complete Screenplay Player + Notes system are all shipped and deployed.

**Where we stand:** The only remaining work before launch is **4 Ryan action items** (DNS + email) and **live UAT testing**. The code is feature-complete.

**Target launch: mid-June 2026.**

---

## 1. What Was Shipped Today

### Sprint K — Full Script Processing
| What | Why it matters |
|------|---------------|
| Script chunker (14 scenes/chunk) | 150-page scripts no longer time out |
| Segment tracking + stitch | Each chunk has a URL; final audio stitched when all complete |
| Partial failure guard | One bad scene doesn't fail the whole script |
| Progress language: "Generating audio for scenes 1–14…" | No "chunk/segment" jargon visible to users |

### Sprint L — Fast-Start Playback + AI Quality
| What | Why it matters |
|------|---------------|
| Segment queue player + buffer indicator | Audio starts within ~90 seconds; graceful pause if generation catches up |
| Fast Start tooltip on Generate button | Sets user expectations before clicking |
| Character voice consistency | VoiceMap persisted → same actor for same character across all 20 scenes |
| Genre/tone context injection | Thriller → dark/tense music; sci-fi → futuristic; comedy → upbeat |
| Audio catalog enriched | 6 rules, 15 examples — explicit guidance for sci-fi, comedy, horror |

### Sprint M — Screenplay Player + Notes System
| What | Why it matters |
|------|---------------|
| **ScreenplayPlayer component** | Renders screenplay in proper format (scene headings, dialogue, action, transitions) |
| **Hover-to-annotate** | Hover any line → "+" → popover → save note with audio timestamp |
| **Per-scene reactions** | Like / Pass / Undecided per scene; one per user; active state persists |
| **Note indicators** | Amber circle on annotated lines; left-border color by reaction type |
| **NotesPanel sidebar** | All notes + reactions listed; click any → jump to that audio moment |
| **Comments API** | GET/POST/DELETE with Zod validation, reaction upsert, scope enforcement |
| **Enterprise Notes tab** | Master account sees all team members' notes + reactions in one view |
| **Migration 0024** | `reaction_type` column + 4 indexes on `project_comments` |

---

## 2. Current System State

### Services
| Service | Status |
|---------|--------|
| `story-magic-web` (Render) | **LIVE** — auto-deploying from main |
| `story-magic-orchestrator` (Render) | **LIVE** — auto-deploying from main |
| DNS — `app.storymagicapp.net` | ✓ Live |
| DNS — Clerk subdomains | ❌ Missing — **Ryan action required** |

### Test Suite (as of last push — commit c15921f)
| Package | Tests | Status |
|---------|-------|--------|
| `@story-magic/orchestrator` | **541** | ✓ 0 failures |
| `@story-magic/web` | **1,061** | ✓ 0 failures |
| **Total** | **1,602** | ✓ Clean |

### Recent Commits
```
c15921f  docs: mark Sprint M complete (M-1 through M-9)
32e6a83  feat(sprint-m): M-8 enterprise dashboard Notes & Reactions tab
6be4a43  feat(sprint-m): screenplay player + notes system — M-1 through M-7
65bbdfd  docs(meeting-prep): 2026-05-15 launch status + Sprint M plan
9de0e99  feat(sprint-l): L-6 audio catalog audit + genre/tone knowledge
```

---

## 3. Ryan Action Items (Still Blocking)

These 4 items are the only things preventing the app from being fully operational at `app.storymagicapp.net`.

| # | What Ryan Does | Blocking |
|---|---------------|---------|
| **J-0a** | Clerk dashboard → Production → Domains → copy CNAME targets for `clerk.storymagicapp.net` and `accounts.storymagicapp.net` | ❌ Auth broken at storymagicapp.net |
| **J-1b** | Doppler → story-magic → prd → add: `RESEND_FROM_ADDRESS=Story Magic <noreply@servicevision.io>` | ❌ Team invites broken |
| **J-1d** | Resend → Domains → verify storymagicapp.net → share DNS records with Chris | Email from @storymagicapp.net |
| **Enroll TOTP** | Clerk account settings → Security → Add authenticator | Pre-launch security hygiene |

**Chris does after each:** Adds Cloudflare DNS records (J-0a, J-1d), runs `sync-doppler-to-render.sh` (J-1b).

---

## 4. Go/No-Go Criteria for Launch (v3.0.0)

All of the following must be TRUE before declaring launch-ready:

- [ ] `app.storymagicapp.net` loads dashboard — no DNS error (requires J-0a)
- [ ] Clerk sign-in works (requires J-0a)
- [ ] Team invite email reaches inbox + link works (requires J-1b)
- [ ] 90-page script processes end-to-end without failure (Ryan live test)
- [ ] First audio segment starts within 90 seconds (Ryan live test)
- [x] Screenplay notes: create → save → persist on refresh ← **DONE (Sprint M deployed)**
- [x] Master account sees all team notes in enterprise dashboard ← **DONE (Sprint M deployed)**
- [ ] All Playwright E2E specs pass in CI (`pnpm test:e2e`)
- [ ] Zero open P0/P1 errors in Sentry after 24h of Ryan testing
- [ ] **Ryan signs off**

---

## 5. What's Left (In Order)

```
TODAY (2026-05-15)
  ✅ Sprint K — Full script chunking deployed
  ✅ Sprint L — Progressive playback deployed
  ✅ Sprint M — Screenplay player + notes deployed
  ⏳ Ryan action items (J-0a, J-1b): needed NOW to unblock app

SPRINT J UNBLOCK (2026-05-16–18)
  Ryan: Provide Clerk CNAME values + add Doppler var + test invite
  Chris: Add Cloudflare DNS records + sync Render

LIVE TESTING (2026-05-19 onward)
  Ryan: test 90-page script end-to-end
  Ryan: annotate a completed script with notes + reactions
  Ryan: verify enterprise dashboard shows team notes
  Ryan: add Anthropic + Google keys to Render (for corpus ingestion)

LAUNCH (target: mid-June 2026)
```

---

## 6. Open Questions for Ryan

1. **Clerk CNAMEs:** Can you pull the CNAME targets from the Clerk dashboard today? (Production → Domains → DNS Records). Two values needed.

2. **90-page test:** Do you have a script ready? A public-domain feature film screenplay works fine.

3. **AI keys for Render:** StoryScore corpus needs `ANTHROPIC_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` in Render env. Should Chris add the ones from `.env.local`, or do you want to supply separate production keys?

4. **Launch date:** Is "mid-June" still the constraint, or has a client set a hard date?

---

## 7. Post-Launch Backlog (v3.1+)

| Item | SP | Why Deferred |
|------|----|-------------|
| StoryScore calibration (corpus ingestion) | 2 | Needs Ryan's AI keys in Render |
| StoryScore display to end users | 8 | Intelligence feature — needs corpus first |
| Mobile-responsive screenplay player | 3 | Desktop-first for enterprise launch |
| Export notes as PDF/CSV | 3 | Nice-to-have — clients can screenshot for now |
| Webhook events for team activity | 5 | Enterprise tier only |
| Audio sync — screenplay scroll follows playback in real time | 3 | MVP: click-to-seek works; real-time sync needs AudioPlayer `onTimeUpdate` prop |
| SOC 2 / TPN compliance preparation | 13 | Future enterprise contracts |

---

## 8. Key Files Reference

| File | Purpose |
|------|---------|
| `docs/launch-plan/2026-05-15/TODO.md` | Sprint checklist — all M tasks marked complete |
| `docs/launch-plan/2026-05-15/ROADMAP.md` | Sprint milestones + go/no-go criteria |
| `docs/UAT-2026-05-07.md` | 123 UAT test cases (sections 1–19) |
| `packages/web/components/project/ScreenplayPlayer.tsx` | New — screenplay renderer + annotator |
| `packages/web/components/project/NotesPanel.tsx` | New — notes sidebar |
| `packages/web/e2e/screenplay-notes.authenticated.spec.ts` | E2E spec — auto-enables on completed project |
| `packages/orchestrator/knowledge_bases/audio_selection_knowledge.json` | Genre→audio group mappings |

---

*Updated 2026-05-15 by Chris Therriault. Sprints K + L + M complete. Deploy: both Render services on commit c15921f.*
