# Executive Summary — 2026-06-09

**Reviewer:** Claude (delegated to Chris); UX + data-tier audits as background agents.
**Anchor:** Delta vs 2026-06-03 (`code-review/2026-06-03/`).
**Branch:** `main` at commit `8d72a67` (PR #191 scene-cache merged tonight).
**Working state:** 7 open PRs awaiting Peter review (#192–#198) plus 5 carried over (#169/#170/#171/#173/#176/#177).

---

## Health Scorecard

| Area | Score | Δ | Notes |
|------|-------|---|-------|
| TypeScript | **10/10** | → | 0 errors orch + web |
| Security (app-level ownership) | **9/10** | → | All routes verified ownership-checked. No RLS — Clerk + Prisma enforces. |
| Data Integrity | **8/10** | ↓ | One new HIGH (DT-31-H-1, pipeline FK missing). Was clean last round. |
| Test Coverage | **9/10** | ↑ | 713 orch + 1,273 web = **1,986 passing**. +72 since 2026-06-03. |
| UX / Info Design | **9/10** | ↑ | 5 of 7 prior items resolved this cycle. One P1 new (window.confirm pattern). |
| Code Quality | **9/10** | → | Zero production console.log. Five legitimate `any` casts. Single tracked TODO (Ryan voice IDs). |
| Cost Efficiency | **9/10** | ↑↑ | Entire cost-opt arc shipped this week (14 PRs). MODEL_MATRIX has every operation tracked. |
| Observability | **8/10** | ↑ | `llm_call_log` foundation (PR #196 open) once merged enables real cost rollups. |
| **Overall** | **A** | → | Maintained. Data-tier HIGH offsets the UX + cost wins. |

---

## Delta Since 2026-06-03

### Resolved (10)

**UX/Information Design (5):**
- UX-E-08 — enterprise dashboard scroll containers (`max-h-[480px] overflow-y-auto`)
- UX-E-09 — audio-chooser icon-button touch targets (`h-10 w-10`)
- UX-E-11 — share-modal mobile bulk-name input
- UX-F-03 — team page `window.confirm` → AlertDialog
- UX-F-02 — EnterpriseProjectAssignment touch targets

**Data Tiers (5):**
- DT-29-NEW-2 — Purchase `onDelete: SetNull` + nullable userId/projectId
- DT-29-2/3 — ScriptShare sharedBy/sharedWith SetNull
- DT-30-H-1 — TeamShare.sharedBy SetNull
- DT-29-1 — corpus export `take: 500` cap
- DT-30-C-1 — admin/stats raw SQL casing (was CRITICAL)

### New This Session (4)

**Data Tiers:**
- **DT-31-H-1 [HIGH]** — Pipeline tables (`tts_stems`, `timelines`, `alignments`, **`scene_renders` from PR #191**) store `project_id` as TEXT with no FK to `Project(UUID)`. Project deletion leaves orphans. For `scene_renders` specifically: cache poisoning risk if a project ID is reused (admin restore, test seeds). Fix: cast to UUID + ADD FK ON DELETE CASCADE in a new migration. **3 SP.**
- DT-31-M-2 [MED] — scene-cache invalidation hook needs verification (paired with H-1)
- DT-31-L-2 [LOW] — Migration 0035 missing explicit `USING ... AT TIME ZONE 'UTC'`. Safe in prod (Render PG is UTC); add for portability.

**UX/Info Design:**
- **UX-G-01 [P1]** — `window.confirm` for destructive actions at 6 sites (project-workflow.tsx ×2, shares/page.tsx ×2, CommentsSidebar, NotesPanel). The shares-page bulk-deactivate is highest risk (iOS PWA suppresses confirm silently). UX-F-03 fixed only ONE site; the pattern needs to be extracted as shared `<ConfirmDialog>` and applied to all 6. **2 SP.**
- UX-G-02 [P2] — `wordCount.toLocaleString()` missing `'en-US'` locale (3 sites, hydration risk)
- UX-G-03 [P2] — `ScriptImprovementWizard` plain `overflow-y-auto` should use `<ScrollArea>` for visual cue

### Carryover (5)

| ID | Severity | Title |
|----|---------|-------|
| PLAY-TOCTOU | HIGH | Play route TOCTOU on `max_plays` (atomic `$executeRaw` guard) |
| CONTENT-LOG-RETENTION | MED | `content_access_log` nightly cleanup cron |
| DT-30-M-1 | MED | `subscriptions.upsert` in admin/tier, upgrade, referral/upgrade routes |
| UX-E-10 | P2 | Drop zone `tabIndex={0}` + `onClick` |
| DEBT-01 | LOW | Female teen voice IDs (Ryan-blocked) |

---

## Priority Actions This Sprint

| Priority | ID | Item | SP | Owner |
|----------|----|------|----|----|
| **P0** | DT-31-H-1 | Pipeline FK + UUID type fix (single migration) | 3 | Chris |
| **P1** | UX-G-01 | Shared `<ConfirmDialog>` + 6-site refactor | 2 | Chris |
| **P1** | PLAY-TOCTOU | Atomic play-count guard | 2 | Chris |
| **P1** | CONTENT-LOG-RETENTION | Nightly cleanup cron | 2 | Chris |
| **P2** | DT-30-M-1 | Subscriptions upsert in 3 tier routes | 2 | Chris |
| **P2** | UX-G-02 | `toLocaleString('en-US')` fix | 0.5 | Chris |
| **P2** | UX-E-10 | Drop zone keyboard focus | 1 | Chris |
| **External** | #174 | Notification feed (awaiting Ryan scoping email) | 8 | Ryan |
| **External** | DEBT-01 | Female teen voice IDs | – | Ryan |

**Sprint A total:** 12.5 SP. With #192–#198 still in Peter's review queue, this is the next focused sprint once those land.

---

## Cost-opt Arc Snapshot

Phase 1 + Phase 2 (Tier 1 + Tier 2 + T2-2 + T3-1 through T3-6) shipped or open as PRs:

| Status | Count | PRs |
|--------|------|-----|
| Merged | 11 | #178, #179, #181, #183, #184, #185, #187, #188, #189, #191 |
| Open (Peter review) | 7 | #192 scene-cache parallel, #193 wall-clock, #194 OpenRouter, #195 TEST_MODE, #196 llm_call_log, #197 zod guard, #198 web Adviser |
| Carryover from earlier | 6 | #169, #170, #171, #173, #176*, #177 (* #176 needs hand-merge) |

**Total open PRs: 13** — sequencing concern for Peter.
