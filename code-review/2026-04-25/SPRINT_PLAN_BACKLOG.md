# Sprint Plan — Story Magic Backlog (Sprints 3–7)

**Date:** 2026-04-25
**Extends:** [SPRINT_PLAN.md](SPRINT_PLAN.md) — Sprints 1 & 2 complete as of 2026-04-25
**Baseline:** web 797/797 (48 suites), orchestrator 471/471 (28 suites) = 1,268 tests total
**Total backlog:** ~34 SP across 5 sprints (~8–10 dev weeks)

---

## Backlog Completion Status

| Area | Prior Estimate | Revised | Reason for Revision |
|------|---------------|---------|-------------------|
| Admin CRUD tests | 8 SP | **1 SP** | 8 of 11 routes already covered; only 3 gaps remain |
| Story Adviser UI | 5 SP | **5 SP** | 6 components built (70%); wizard + stats + diff missing |
| R2 integration tests | 5 SP | **2 SP** | Unit-test scope only; real R2 CI integration deferred |
| Long-form scripts >120 pages | 8 SP | **8 SP** | Pass 3 LLM overflow risk + timeout refactor needed |
| SOC 2 / multi-tenancy hardening | 13 SP | **18 SP** | Orchestrator IDOR found; encryption + 2FA not started |
| **Total** | **39 SP** | **34 SP** | |

---

## Sprint 3: Quick Wins (~3 SP, ~2–3 days)

**Goal:** Close all remaining test gaps in admin and storage infrastructure — no new code, tests only.

**Definition of Done:**
- [ ] `admin-routes.test.ts` extended: GET corpus/export, GET admin/impact, POST+DELETE impact/stories/[id]/approve
- [ ] `r2.test.ts` created: 5 tests covering upload, URL generation, missing env, content-type, failure
- [ ] Total tests ≥ 1,278
- [ ] TypeScript: 0 errors
- [ ] All existing tests still green

**Items:**

| ID | Title | SP | Files |
|----|-------|----|-------|
| BL-001 | Admin: corpus/export + impact + impact approve tests | 1 | `tests/unit/api/admin-routes.test.ts` |
| BL-002 | R2 storage unit tests — mock S3Client | 2 | `tests/unit/lib/r2.test.ts` (new) |

**Total: 3 SP**

**Sprint notes:**
BL-001 adds to the existing `admin-routes.test.ts` — all 3 gaps share the established `withAdminAuth` mock pattern. Mock `@/lib/email` for the approve-fires-email test; assert the email call is fire-and-forget (no await check). BL-002 mocks `@aws-sdk/client-s3` (S3Client + PutObjectCommand.send) and uses `vi.stubEnv` for all 5 R2_* vars. The `isR2Configured()` guard test just stubs the env vars to undefined.

---

## Sprint 4: Story Adviser Multi-Step UI (~5 SP, ~1 week)

**Goal:** Deliver a complete, usable Story Adviser workflow behind the existing feature flag — users can generate suggestions, review them one-by-one, accept/reject, generate rewrites, and apply a rewrite back to the script.

**Definition of Done:**
- [ ] `/projects/[id]/adviser` page exists and loads under `NEXT_PUBLIC_FF_STORY_ADVISER=true`
- [ ] Wizard flow: Generate → Review → Respond → Apply (4 discrete steps)
- [ ] SuggestionStats panel renders data from `getSuggestionStats()`
- [ ] RewriteModal shows side-by-side diff (original vs rewritten)
- [ ] Batch accept/reject/dismiss UI (checkbox + bulk action bar)
- [ ] Category filter tabs work (all | structure | character | dialogue | pacing | theme)
- [ ] Apply rewrite: writes selected rewrite text back to `Project.scriptText` via PATCH
- [ ] Feature flag gate confirmed — no UI visible when flag is false
- [ ] Zero TypeScript errors

**Items:**

| ID | Title | SP | Files |
|----|-------|----|-------|
| BL-003 | Adviser page + wizard shell at `/projects/[id]/adviser` | 1 | `app/projects/[id]/adviser/page.tsx` (new), `app/projects/[id]/layout.tsx` (add nav tab) |
| BL-004 | SuggestionStats dashboard component | 0.5 | `components/story-adviser/SuggestionStats.tsx` (new) |
| BL-005 | Category filter tabs + batch action bar | 1 | `components/story-adviser/SuggestionPanel.tsx` (modify), `components/story-adviser/BatchActionBar.tsx` (new) |
| BL-006 | Side-by-side diff view in RewriteModal | 1 | `components/story-adviser/RewriteModal.tsx` (modify) |
| BL-007 | Apply-rewrite-to-script PATCH + wizard step 4 | 1.5 | `app/api/projects/[id]/script/route.ts` (new or modify), `components/story-adviser/StoryAdviser.tsx` (modify) |

**Total: 5 SP**

**Sprint notes:**
The backend is 100% done — this sprint is purely frontend. The wizard state can live in React `useState` (no new Zustand/Redux needed). Step 4 "Apply" requires a PATCH on `Project.scriptText`; check whether the existing project update endpoint already handles script text updates before creating a new one. The diff view can use the `diff` npm package or a simple two-column layout — avoid heavy libraries. Keep `NEXT_PUBLIC_FF_STORY_ADVISER=false` in `.env.example`; turn on in `.env.local` during development. No new API routes needed unless the apply-rewrite endpoint doesn't exist.

---

## Sprint 5: Long-Form Scripts >120 Pages (~8 SP, ~1–2 weeks)

**Goal:** The pipeline handles scripts up to 200 pages without silent LLM context overflow, with explicit limits, configurable timeouts, and a stress test proving it.

**Definition of Done:**
- [ ] Explicit `MAX_SCRIPT_PAGES` and `MAX_SCRIPT_CHARS` constants defined in `orchestrator/src/lib/env.ts`
- [ ] User-facing error returned when upload exceeds limit (before any LLM call)
- [ ] Token budget check added to DirectorAgent before each LLM call; warn + chunk if near limit
- [ ] Pass 3 (SceneConstruction) receives script in chunks when total > 60K chars, not as full text
- [ ] Mixer operation timeout scales with `pageCount`: base 30s + 0.5s/page, capped at 300s
- [ ] Stress test: 200-page synthetic script runs end-to-end in orchestrator pipeline (no LLM overflow)
- [ ] `docs/DIRECTOR_ARCHITECTURE_2026-04-25.md` updated with limits section
- [ ] TypeScript: 0 errors, all existing tests green

**Items:**

| ID | Title | SP | Files |
|----|-------|----|-------|
| BL-008 | Define explicit page/char limits + pre-flight validation | 1 | `orchestrator/src/lib/env.ts`, `orchestrator/src/routes/generate-scenes.ts` |
| BL-009 | Token budget tracking in DirectorAgent + warn on near-limit | 2 | `orchestrator/src/director/agents/director-agent.ts` |
| BL-010 | Pass 3 SceneConstruction chunking for scripts >60K chars | 2.5 | `orchestrator/src/director/utils/script-chunker.ts`, `orchestrator/src/director/agents/audio-director-agent.ts` (or pipeline.ts) |
| BL-011 | Mixer timeout scaling by page count | 0.5 | `orchestrator/src/orchestrator/workers/mixer.ts` |
| BL-012 | 200-page stress test (synthetic script) + architecture doc update | 2 | `orchestrator/src/director/pipeline.test.ts` or new stress test file, `docs/DIRECTOR_ARCHITECTURE_2026-04-25.md` |

**Total: 8 SP**

**Sprint notes:**
The 30K char extraction threshold already works. The risk is Pass 3 (SceneConstruction / AudioDirectorAgent) which receives the full script text as context. At 200 pages (~50K chars) + system prompt + prior passes' output, a single call likely exceeds Claude Sonnet 4.6's effective context for reliable JSON output. BL-010 mirrors the existing chunked-extraction pattern but applies it to scene construction — chunk by scene group, run in parallel, merge the scene arrays. Mixer timeout formula: `Math.min(30_000 + (pageCount * 500), 300_000)` ms. The stress test can generate a synthetic script programmatically (repeat a standard 1-page scene template N times) — no real script needed.

---

## Sprint 6: SOC 2 Hardening — Enforcement (~10 SP, ~2 weeks)

**Goal:** Eliminate the two concrete security gaps (orchestrator IDOR, TeamShare bypass) and expand audit logging to mutation + deletion + critical reads. These are real security issues, not compliance paperwork.

**Definition of Done:**
- [ ] Orchestrator `/generate-scenes` and `/orchestrate` verify that `userId` from JWT owns `projectId` in request body (DB check)
- [ ] `withProjectAuth` extended: if project is team-shared, requesting user must be an active `TeamMember`
- [ ] `logReadAccess()` helper added to `lib/api/audit.ts`; called on GET project, GET script, GET audio download
- [ ] `logDeletion()` helper added; called on DELETE project, DELETE user (admin)
- [ ] All existing `auditLog()` calls include `projectId` or `teamId` where applicable
- [ ] Cross-tenant denial tests: User A cannot GET/PATCH/DELETE User B's project (API-level)
- [ ] TeamShare tests: unshared user denied; active TeamMember permitted
- [ ] Orchestrator ownership tests: mismatched userId/projectId returns 403
- [ ] Zero TypeScript errors, all existing tests green

**Items:**

| ID | Title | SP | Files |
|----|-------|----|-------|
| BL-013 | Orchestrator project ownership check on /generate-scenes + /orchestrate | 2 | `orchestrator/src/routes/generate-scenes.ts`, `orchestrator/src/routes/orchestrate.ts`, `orchestrator/prisma/schema.prisma` (read Project.userId) |
| BL-014 | withProjectAuth: TeamShare membership enforcement | 3 | `packages/web/lib/api/middleware.ts`, `packages/web/lib/services/teams.ts` |
| BL-015 | Audit log expansion — read access + deletion events | 2 | `packages/web/lib/api/audit.ts`, 3–5 route files for GET/DELETE hooks |
| BL-016 | Cross-tenant + orchestrator ownership tests | 3 | `tests/unit/api/cross-tenant.test.ts` (new), `orchestrator/src/routes/generate-scenes.test.ts` |

**Total: 10 SP**

**Sprint notes:**
BL-013 is the most critical item — an authenticated user today can send any `projectId` to `/orchestrate` and it will run, regardless of ownership. The fix requires a Prisma lookup in the orchestrator (`Project.userId === decodedJwt.sub`). BL-014 should extend the existing `withProjectAuth` helper rather than creating a new middleware — add a second ownership check: if `project.teamShares` includes the requesting user's teamId AND the user is an active member, permit. BL-016 cross-tenant tests should cover the 5 most sensitive routes: GET project, PUT script, POST generate-audio, GET audio download, DELETE project.

---

## Sprint 7: SOC 2 Hardening — Encryption & Compliance (~8 SP, ~2 weeks)

**Goal:** Encrypt sensitive data at rest, enable MFA for admin users, and produce the compliance documentation required to begin a SOC 2 audit engagement.

**Definition of Done:**
- [ ] `Project.scriptText` encrypted at rest using AES-256-GCM; transparent via Prisma middleware
- [ ] `ENCRYPTION_KEY` env var documented in `.env.example` and `render.yaml`
- [ ] Migration script encrypts all existing rows without downtime (encrypt-on-read strategy or one-time job)
- [ ] TOTP (authenticator app) enabled in Clerk dashboard; MFA enforced for all `admin` role users
- [ ] `/settings/security` page shows MFA enrollment state and setup link
- [ ] SOC 2 controls inventory doc written to `docs/SOC2_CONTROLS.md`
- [ ] Data flow diagram written to `docs/DATA_FLOW.md` (script upload → LLM → TTS → R2 → user)
- [ ] Incident response runbook stub written to `docs/INCIDENT_RESPONSE.md`
- [ ] Decrypt performance acceptable: < 5ms overhead per request in load test
- [ ] Zero TypeScript errors, all existing tests green

**Items:**

| ID | Title | SP | Files |
|----|-------|----|-------|
| BL-017 | Field-level AES-256-GCM encryption for Project.scriptText | 5 | `packages/web/lib/db/encryption.ts` (new), `packages/web/lib/db/index.ts` (Prisma middleware), `packages/web/scripts/encrypt-existing-rows.ts` (new) |
| BL-018 | Clerk TOTP + MFA enforcement for admins | 1 | Clerk dashboard config, `packages/web/app/settings/security/page.tsx` (new or modify) |
| BL-019 | SOC 2 documentation: controls inventory + data flow + incident runbook | 2 | `docs/SOC2_CONTROLS.md` (new), `docs/DATA_FLOW.md` (new), `docs/INCIDENT_RESPONSE.md` (new) |

**Total: 8 SP**

**Sprint notes:**
BL-017 is the highest-risk item — encrypting an existing column requires care. Recommended approach: add an `encryptedScriptText` nullable column, backfill via `encrypt-existing-rows.ts` (batch job, 100 rows at a time), then swap the read path to prefer `encryptedScriptText`, then drop `scriptText` in a final migration. AES-256-GCM in Node.js `crypto` module — no external dependency. Key rotation: store key version prefix in the ciphertext (`v1:...`) so future rotations decrypt with old key, re-encrypt with new key. BL-019 documentation does not need to be exhaustive for an initial audit engagement — controls inventory + a clear data flow diagram is typically enough to open a conversation with an auditor.

---

## Completion Forecast

| Sprint | SP | Tests After | State |
|--------|-----|-------------|-------|
| ✅ Sprint 1 | 10 | 797 web / 471 orch = 1,268 | All production routes tested |
| ✅ Sprint 2 | 2 | 797 / 471 = 1,268 | Tech debt cleared |
| Sprint 3 | 3 | ~1,278 | Admin + R2 coverage complete |
| Sprint 4 | 5 | ~1,290 | Story Adviser feature-complete (behind flag) |
| Sprint 5 | 8 | ~1,305 | Long-form scripts up to 200 pages |
| Sprint 6 | 10 | ~1,335 | IDOR closed, TeamShare enforced, audit expanded |
| Sprint 7 | 8 | ~1,345 | Encryption at rest, MFA, SOC 2 docs |

---

## Key Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Orchestrator IDOR (BL-013) is a live security issue | Any authenticated user can trigger pipeline on another user's project | **Ship BL-013 immediately** — can be done standalone before Sprint 6 begins |
| Pass 3 LLM overflow (BL-010) may require chunking strategy rethink | Long scripts produce malformed scene output silently | Stress test in BL-012 proves the failure mode; BL-010 is the fix |
| Encryption migration (BL-017) requires zero-downtime care | Encrypting existing rows mid-traffic could corrupt data | Use nullable column + backfill job strategy; test on staging DB first |
| Clerk MFA enforcement for admins could lock out Ryan | Admin can't log in if MFA setup wasn't done before enforce flag | Coordinate with Ryan before enabling enforcement; give 2-week notice |
| Story Adviser diff view library adds bundle weight | Page load regression | Use `diff` (2.7KB gzip) or a pure CSS two-column layout; no heavy lib |
| R2 real integration tests blocked on CI creds | Coverage gap for storage path | Unit tests (BL-002) cover the logic; R2 CI integration is a post-SOC-2 item |

---

## Ryan Dependencies (still open from Sprint 1+2 plan)

| Priority | Action | Blocks |
|----------|--------|--------|
| CRITICAL | Rotate Clerk keys: `pk_test_*` → `pk_live_*` | All real user auth |
| CRITICAL | DNS: `app.storymagicapp.net` → `story-magic-web.onrender.com` | Custom domain |
| HIGH | Add `ANTHROPIC_API_KEY` + `GOOGLE_GENERATIVE_AI_API_KEY` to Render | StoryScore, corpus scoring |
| HIGH | Confirm Stripe webhook includes `checkout.session.completed` | Billing activation |
| MEDIUM | Coordinate MFA rollout timing (before BL-018) | Sprint 7 admin enforcement |

---

## Sequencing Note

**BL-013 (orchestrator ownership check) should ship before Sprint 6 formally begins.** It is a 2-SP security fix that can be completed in a half-day and deployed to Render independently. It does not depend on any other Sprint 6 item. The IDOR vector is live now.

---

*Generated: 2026-04-25. Extends: [SPRINT_PLAN.md](SPRINT_PLAN.md) (Sprints 1–2 complete)*
