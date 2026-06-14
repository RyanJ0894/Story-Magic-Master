> **Superseded by:** [ROADMAP-2026-06-14](ROADMAP-2026-06-14.md) — Updated 2026-06-14

# Story Magic — Consolidated Roadmap (EOD 2026-06-09)

**Date:** 2026-06-09 (end of day)
**Author:** Chris Therriault (chris@servicevision.net)
**Version:** v3.5.x in progress
**Status:** Supersedes `docs/ROADMAP-2026-06-09.md` (mid-day version)

> **Current state:** 713 orchestrator tests + 1,273 web tests = **1,986 passing**. 0 TypeScript errors.
> **13 PRs open** (#169/#170/#171/#173/#176/#177 + 7 from tonight's cost-opt arc #192–#198).
> Cost-opt Phase 1 + 2 (Tier 1 + Tier 2 + T2-2 + Tier 3) shipped or in flight.
> 2026-06-09 review complete — one new HIGH (DT-31-H-1 pipeline FK), one new P1 (UX-G-01 ConfirmDialog).

---

## Document Reconciliation

| Document | Status |
|----------|--------|
| `docs/ROADMAP-2026-06-09.md` (mid-day) | Superseded by this document |
| `docs/ROADMAP-2026-06-08.md` | Superseded |
| `docs/MODEL_MATRIX.md` | Authoritative — every operation tracked, 9 history entries from 2026-06-09 |
| `docs/COST-OPT-PLAN-2026-06-09.md` | Source plan — all items shipped or in PR queue |
| `code-review/2026-06-09/` | Latest review docs — anchor for next cycle |

---

## What Shipped + Is In Flight Tonight (2026-06-08 → 2026-06-09)

### Merged (11 PRs)
| PR | Title | Phase |
|----|-------|-------|
| #178 | Stop OpenAI dual-billing + Anthropic-safe schemas | Phase 1 |
| #179 | Voice-assignment → Claude Haiku 4.5 | Phase 1 |
| #181 | Embeddings unified at 1536d, audio search restored | Phase 1 |
| #183 | Audio director → Haiku (4th raw-OpenAI bypass closed) | Tier 1 (A) |
| #184 | Anthropic prompt caching | Tier 1 (B) |
| #185 | Batched script-score (flag-gated) | Tier 1 (C) |
| #187 | Redis L2 embedding cache | Tier 2 (D) |
| #188 | Tiered director-model by script size | Tier 2 (E) |
| #189 | Groq Whisper alignment fallback | Tier 2 (F) |
| #191 | Scene-level idempotency cache | T2-2 |

### Open — Awaiting Peter Review (7 cost-opt + 5 carryover + 1 conflict)
| PR | Title | Origin |
|----|-------|--------|
| #192 | Scene cache for parallel pipeline | T2-2 follow-up |
| #193 | Wall-clock budget on `/analyze` | T3-5 |
| #194 | Proper OpenRouter relief valve | T3-3 |
| #195 | TEST_MODE=mock provider | T3-1 |
| #196 | LLM call log table | T3-4 |
| #197 | Zod-schema Anthropic guard | T3-6 |
| #198 | Web Adviser → Claude | T3-2 |
| #169 | notes/reactions/share/delete | Carryover |
| #170 | voice-catalog system | Carryover |
| #171 | Stripe enterprise checkout | Carryover |
| #173 | S3 audio storage | Carryover |
| #177 | sub-account isolation | Carryover |
| #176 | silent track warnings | CONFLICTING — needs hand-merge |

**Total open: 13**

### Issues closed
#180, #182, #186, #190 — all cost-opt tracking issues closed.

---

## Platform Health Scorecard (EOD 2026-06-09)

| Area | Score | Δ vs mid-day | Notes |
|------|-------|--------------|-------|
| TypeScript | 10/10 | → | 0 errors both packages, maintained through 14 PRs |
| Security (app-level ownership) | 9/10 | → | All routes verified ownership-checked. No RLS — Clerk + Prisma enforces. |
| Data Integrity | 8/10 | ↓ | New HIGH (DT-31-H-1: pipeline FK missing). Sprint A item. |
| Test Coverage | 9/10 | ↑ | 1,986 total (was 1,934 mid-day; +52 from #192–#198 tests) |
| UX / Info Design | 9/10 | → | 5 of 7 prior items resolved; 1 P1 new (UX-G-01) |
| Code Quality | 9/10 | → | Zero production console.log. Tracked TODO: Ryan voice IDs only. |
| Cost Efficiency | **10/10** | ↑↑ | Tier 1+2+T2-2 merged; Tier 3 in PR queue. Full measurement (PR #196) one merge away. |
| Audio Pipeline | 9/10 | → | Same |
| Observability | 8/10 | ↑ | `llm_call_log` foundation in PR #196 unlocks measurement |
| Engineering Workflow | 8/10 | ↓ | Peter review queue heavy (13 PRs). |
| **Overall** | **A** | → | Maintained |

---

## Sprint A — Data + UX Hardening (12.5 SP)

From the 2026-06-09 code review. Starts after #192–#198 merge.

| Order | ID | Title | SP |
|-------|----|----|----|
| 1 | DT-31-H-1 | Pipeline tables FK + UUID type fix (migration 0038) | 3 |
| 2 | UX-G-01 | Shared `<ConfirmDialog>` + 6-site refactor | 2 |
| 3 | PLAY-TOCTOU | Atomic play-count guard | 2 |
| 4 | CONTENT-LOG-RETENTION | Nightly cleanup cron | 2 |
| 5 | DT-30-M-1 | Subscriptions upsert in tier routes | 2 |
| 6 | TS-CLEANUP-01 | 3 `directorJson: any` → shared types | 1 |
| Polish | UX-G-02 / UX-E-10 / UX-G-03 / DT-30-L-2 / DT-31-L-2 | Various | 3.5 |

Recommended 4-PR breakdown — see `code-review/2026-06-09/SPRINT_PLAN.md`.

---

## Sprint B — Issue #174 Notification Feed (9 SP)

Awaiting Ryan's response to scoping email sent 2026-06-09 (Resend `e6971723-1d2c-4f34-8cf6-f44cb2c5f20a`).

Tentative 3-PR breakdown (`/api/master/notifications` backend + producer wiring + `<NotificationFeed />` frontend).

---

## External / Blocked

- DEBT-01 — female teen voice IDs (Ryan)
- POST-02 — `/admin/corpus` ingestion (Ryan)
- #174 — scope clarification (Ryan email pending)
- #176 — silent track warnings, 17 conflict blocks (author hand-merge)
- Peter PR review queue — 13 open PRs

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v3.3.0 | 2026-06-03 | Sprint C remediation |
| v3.4.x | 2026-06-04 → 06 | Hotfixes + integrations |
| v3.4.5 | 2026-06-09 | Phase 1 cost-opt (#178/#179/#181) |
| **v3.5.0-rc1** | **2026-06-09** | **Tier 1+2+T2-2 cost-opt merged (10 PRs total tonight)** |
| **v3.5.0** | **TBD** | **#192–#198 land + Sprint A clears** |
| v3.5.1 | TBD | Sprint B (#174 feed) |
| v4.0.0 | TBD | Launch |

---

## Quick Reference

| Resource | Location |
|----------|----------|
| This roadmap | `docs/ROADMAP-2026-06-09-EOD.md` |
| Model matrix | `docs/MODEL_MATRIX.md` |
| Cost-opt plan | `docs/COST-OPT-PLAN-2026-06-09.md` |
| Latest review | `code-review/2026-06-09/` |
| Sprint TODO | `code-review/2026-06-09/TODO_2026-06-09.md` |

*Single source of truth EOD 2026-06-09. Sprint A queued, Sprint B awaiting Ryan.*
