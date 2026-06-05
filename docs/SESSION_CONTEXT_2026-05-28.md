# Session Context — 2026-05-28

**Project:** Story Magic  
**Path:** `/Users/admin/dev2/clients/RyanJae/story-magic`  
**GitHub:** `dbbuilder-org/story-magic` (branch: `main`, protected)

---

## Summary

Long session covering security hardening, workflow unification, and secrets management. Main was declared stable and branch-protected: all 11 stale remote branches were deleted (squash-merges confirmed), strict protection added (1 codeowner approval required + 3 CI checks: Build / Lint & Type Check / Unit Tests). CODEOWNERS set to `@dbbuilder + @octavianorg`. A GitHub issue notified Peter that main is ready for review and established the PR-based workflow going forward.

Six PRs were opened against main for Peter to review:
- **#60** — Sentry hardening: enable on DSN presence only (`SENTRY_ENABLED`), decoupled from `NODE_ENV` (avoids devDep drop). Traces sample rate via `SENTRY_TRACES_SAMPLE_RATE`. Both web and orchestrator.
- **#61** — Full delta code review (9 docs in `code-review/2026-05-27/`), `ensureProfile` backfill (email/fullName/avatarUrl), dev-only generation log panel gate. 6 new unit tests.
- **#64** — Teams `addMember` fix: reactivate removed member on re-invite (look up by email OR userId, `update` not `create`) — avoids unique constraint 500 error. 5 unit tests.
- **#65** — Feature docs v3.2.0 baseline: REQUIREMENTS / ROADMAP / UAT dated 2026-05-27 (161 UAT tests, 23 sections including sharing suite + LLM failover + invite hardening).
- **#66** — LLM failover fix: `parseModelString` now splits on first `/` only (fixes `openrouter/openai/gpt-4.1` being misparsed as OpenAI tier). Exported `buildFailoverChain` + `isFailoverableError`. 11 unit tests.
- **#67** — DB perf: `@@index([email])` on `Profile` model + migration `0028_profiles_email_index`.

Secrets migration to Doppler completed (DOPP-1): Doppler `prd` config (76 secrets) now syncs natively to both Render services via Doppler dashboard integrations. Final parity check confirmed 76/76/76 across Doppler prd, Render web, and Render orch. Stale Google key on Render web corrected by sync. Doppler is now the live source of truth — edit secrets there, not in Render dashboard.

---

## Files Modified

- `packages/orchestrator/src/lib/llm-client.ts` — LLM failover chain + `parseModelString` fix
- `packages/orchestrator/src/lib/sentry.ts` — SENTRY_ENABLED gate
- `packages/orchestrator/src/lib/llm-failover.test.ts` — 11 new tests (NEW file)
- `packages/web/sentry.server.config.ts` — SENTRY_ENABLED gate
- `packages/web/sentry.edge.config.ts` — SENTRY_ENABLED gate
- `packages/web/instrumentation-client.ts` — SENTRY_ENABLED gate + removed dev beforeSend guard
- `packages/web/lib/ensure-profile.ts` — backfill email/fullName/avatarUrl on every sign-in
- `packages/web/lib/services/teams.ts` — addMember reactivation flow
- `packages/web/app/projects/[id]/generate-button.tsx` — dev-only generation log gate
- `packages/web/prisma/schema.prisma` — `@@index([email])` on Profile
- `packages/web/prisma/migrations/0028_profiles_email_index/migration.sql` — NEW
- `packages/web/tests/unit/lib/ensure-profile.test.ts` — 6 tests (NEW)
- `packages/web/tests/unit/lib/teams-add-member.test.ts` — 5 tests (NEW)
- `packages/web/e2e/invite-signup-flow.spec.ts` — Playwright invite+signup E2E (NEW)
- `code-review/2026-05-27/` — 10 docs (00–08, SPRINT_PLAN, TODO)
- `docs/REQUIREMENTS-2026-05-27.md` — v3.2.0 baseline (NEW)
- `docs/ROADMAP-2026-05-27.md` — v3.2.0 baseline (NEW)
- `docs/UAT-2026-05-27.md` — v3.2.0 baseline, 161 tests (NEW)
- `.github/CODEOWNERS` — `* @dbbuilder @octavianorg` (NEW)
- `.github/pull_request_template.md` — standard PR template (NEW)

---

## Current State

- **Branch:** `main` — branch-protected (1 approval + 3 CI checks required); no direct pushes
- **Open PRs:** #60, #61, #64, #65, #66, #67 — all awaiting Peter's review
- **Tests:** 1,658 total (1,093 web + ~541 orchestrator + 24 new unit tests) — all passing on main
- **Secrets:** Doppler `prd` (76 vars) → Render web + Render orch via native sync (both ✅ 76/76)
- **Sentry:** SENTRY_ENABLED=true set on both Render services; instrumentation code hardened in PR #60
- **LLM failover:** Claude (primary) → OpenRouter/openai/gpt-4.1 → OpenAI/gpt-4.1; `parseModelString` bug fixed in PR #66
- **Invite flow:** `/sign-up?redirect_url=` fix committed to main (c0bd15f); re-invite reactivation fix in PR #64

---

## Next Steps

- [ ] Peter merges PRs #60, #61, #64, #65, #66, #67 (he has codeowner approval rights)
- [ ] Ryan: 90-page live UAT against production (use `docs/UAT-2026-05-27.md`)
- [ ] Ryan: Enable Anthropic auto-reload (prevents 402 failover triggering in production)
- [ ] Ryan: Confirm Stripe webhook events for billing (listed in `scripts/stripe-test-checklist.md`)
- [ ] Ryan: Corpus ingestion at `/admin/corpus` — AI keys already set (POST-02)
- [ ] Ryan: Female-teen voice IDs for ElevenLabs
- [ ] FEAT-01 (#68): Product decision — drop dead OCR tier + real client-side page count (awaiting Ryan/Peter)
- [ ] Once syncs settle: verify Doppler→Render auto-sync on next `prd` change

---

## Open Questions / Blockers

- **PR review pace:** Peter needs to action 6 open PRs — oldest (#60) has been open since the Sentry work
- **FEAT-01 (#68):** GitHub issue created; waiting on Ryan product decision before implementation
- **Anthropic billing:** If Ryan doesn't enable auto-reload, LLM failover to OpenRouter will trigger in production on sustained use — not a bug, but worth monitoring in Sentry
- **Doppler sync:** Native sync requires Render deploys to pick up changes; no immediate re-deploy is triggered (Render auto-deploys on git push only, not env-var push from Doppler by default)
