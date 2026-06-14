> **Superseded by:** [REQUIREMENTS-2026-06-14](REQUIREMENTS-2026-06-14.md) — Updated 2026-06-14

# Story Magic — Product Requirements (incremental update 2026-06-09)

**Date:** 2026-06-09
**Author:** Chris Therriault
**Status:** Incremental update on top of `docs/REQUIREMENTS-2026-06-03.md` (v3.3.0)
**Target version:** v3.5.0

This file lists **only** the requirements that changed status or were added since 2026-06-03. For the full baseline (172 requirements across 24 sections), see the 2026-06-03 baseline. Prepend a supersession header to that file when this v3.5.0 doc is approved.

> Legend: P0 = Must have | P1 = High value | P2 = Nice to have
> Status: COMPLETE | PARTIAL | NOT IMPL | DEFERRED | BLOCKED

---

## NEW SECTION 25 — Cost Optimization & Provider Resilience

The cost-opt arc (2026-06-08 → 2026-06-09) introduced operational requirements for LLM cost control. Memorialized here so future regressions are auditable.

| Req ID | Requirement | Priority | Planned Implementation | Status | Notes |
|--------|-------------|----------|------------------------|--------|-------|
| REQ-COST-25.1 | All LLM calls route through `lib/llm-client.ts` (orchestrator) or `lib/ai/providers.ts` (web) — no raw `@ai-sdk/openai` imports | P0 | Codebase convention + zod-anthropic-guard test (PR #197) | COMPLETE | Last raw bypass closed in PR #198 |
| REQ-COST-25.2 | Anthropic is primary; OpenRouter is relief valve (same Claude model); OpenAI is last-resort escape | P0 | `buildFailoverChain` with model preservation through OpenRouter | PARTIAL | Code in PR #194 (awaiting merge) |
| REQ-COST-25.3 | Voice-assignment + audio director default to Claude Haiku 4.5 (~12× cheaper than Sonnet for tool-heavy shallow paths) | P1 | `VOICE_ASSIGNMENT_MODEL`, `AUDIO_DIRECTOR_MODEL` env vars | COMPLETE | PRs #179 + #183 |
| REQ-COST-25.4 | Anthropic prompt caching enabled on `runAgentLoop` + `generateStructuredOutput` (cache_control: ephemeral) | P1 | `lib/llm-client.ts::buildSystemMessages` | COMPLETE | PR #184 |
| REQ-COST-25.5 | Embedding queries cached at L1 (in-process Map) + L2 (Upstash Redis 7-day TTL) | P1 | `lib/embedding-cache.ts` | COMPLETE | PR #187 |
| REQ-COST-25.6 | Scene-level idempotency: scenes whose content hash matches a prior render skip alignment + cue + timeline + mix | P1 | `lib/scene-cache.ts` + `scene_renders` table (migration 0036) | COMPLETE | PR #191 (sequential), #192 (parallel pending) |
| REQ-COST-25.7 | Scripts ≤ TIER1_PAGE_THRESHOLD (default 5) route to TIER1_MODEL (Haiku) | P1 | `lib/select-director-model.ts` | COMPLETE | PR #188 |
| REQ-COST-25.8 | Whisper alignment fallback chain: local → Groq (default on) → OpenAI (opt-in) → duration estimator | P1 | `whisper-align.ts::transcribeViaApi` | COMPLETE | PR #189 |
| REQ-COST-25.9 | `/analyze` requests bounded by `ANALYZE_WALLCLOCK_BUDGET_MS` (default 120s) — 503 on timeout | P2 | `lib/wallclock-budget.ts` + `routes/analyze.ts` | PARTIAL | PR #193 (awaiting merge) |
| REQ-COST-25.10 | Per-call cost attribution: every LLM call writes one row to `llm_call_log` (model, tokens, USD estimate, duration, succeeded) | P1 | Migration 0037 + `lib/llm-call-log.ts` | PARTIAL | PR #196 (awaiting merge) |
| REQ-COST-25.11 | `TEST_MODE=mock` bypasses all providers; hard-stop on `NODE_ENV=production` | P2 | `lib/mock-provider.ts` with `assertNotInProduction` | PARTIAL | PR #195 (awaiting merge) |
| REQ-COST-25.12 | Zod schemas passed to `generateObject` / `generateStructuredOutput` must NOT contain `.min`/`.max`/`.length`/`.regex` (Anthropic 400s) — enforced by unit test | P0 | `lib/zod-anthropic-guard.ts` + test on 9 LLM-bound schemas | PARTIAL | PR #197 (awaiting merge) |
| REQ-COST-25.13 | Story Adviser (web) uses Claude Sonnet via providers.ts (not raw OpenAI) | P1 | `lib/adviser/service.ts` | PARTIAL | PR #198 (awaiting merge) |

---

## Updated Sections (from 2026-06-03 baseline)

### Section 1 — Authentication & Identity
No changes since 2026-06-03.

### Section 8 — Enterprise / Team Sharing
| Req ID | Status change | Notes |
|--------|--------------|-------|
| REQ-ENT-8.4 | DEFERRED → PARTIAL | Sub-account isolation in PR #177 (awaiting merge) |
| REQ-ENT-8.5 | NOT IMPL → PARTIAL | Stripe self-serve checkout in PR #171 |
| REQ-ENT-8.7 (NEW) | NOT IMPL | In-dashboard notification feed (issue #174) — awaiting Ryan scoping |

### Section 12 — Infrastructure & Security
| Req ID | Status change | Notes |
|--------|--------------|-------|
| REQ-INFRA-12.23 (NEW) | NOT IMPL | Pipeline tables FK + UUID type fix (DT-31-H-1 from review) — Sprint A |
| REQ-INFRA-12.24 (NEW) | NOT IMPL | content_access_log retention cron (CARRYOVER) — Sprint A |
| REQ-INFRA-12.25 (NEW) | NOT IMPL | PLAY-TOCTOU atomic guard (CARRYOVER) — Sprint A |

### Section 23 — Enterprise Platform
| Req ID | Status change | Notes |
|--------|--------------|-------|
| ENT-23.x | (multiple) | Closed enterprise features: AlertDialog migration on team page COMPLETE; sub-account deactivation PARTIAL (#171) |

---

## Gap Analysis (delta from 2026-06-03)

| Feature | Status | Gap | Impact | Resolution Plan | Target |
|---------|--------|-----|--------|-----------------|--------|
| Cost-opt Phase 2 Tier 3 | PARTIAL | 7 PRs in Peter review queue | Lower per-script cost not yet live in production | Peter approval cycle | This week |
| Notification feed (#174) | NOT IMPL | Awaiting scope from Ryan | Enterprise customers can't see async events in-app | Ryan response → 3-PR sprint | Sprint B |
| Pipeline FK (DT-31-H-1) | NOT IMPL | Orphan rows + cache poisoning risk | Data integrity on project delete | Sprint A PR | Next sprint |

---

## Test Inventory

| Package | Tests passing | Δ from 2026-06-03 |
|---------|---------------|-------------------|
| Orchestrator | 713 | +72 |
| Web | 1,273 | +4 |
| **Total** | **1,986** | **+76** |

All passing. 0 TypeScript errors both packages.

---

*Incremental update to REQUIREMENTS-2026-06-03.md. Full v3.5.0 baseline will be issued after Sprint A closes.*
