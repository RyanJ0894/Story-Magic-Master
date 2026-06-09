# Feature Completeness — 2026-06-09

## Completed This Session

The 14 cost-opt PRs (#178–#198, with #176 conflict pending and #180/#182/#186/#190 closed) shipped:

| Feature | Files |
|---------|-------|
| Cost-attribution + measurement | `lib/llm-call-log.ts`, `migrations/0037`, `schema.prisma` (LlmCallLog model) |
| Mock provider | `lib/mock-provider.ts`, `lib/env.ts`, `lib/llm-client.ts` bypass shims |
| Wall-clock budget | `lib/wallclock-budget.ts`, `routes/analyze.ts` |
| OpenRouter relief valve | `lib/llm-client.ts::buildFailoverChain` |
| Zod schema guard | `lib/zod-anthropic-guard.ts` + `.test.ts` |
| Web Adviser → Claude | `lib/adviser/service.ts`; deleted `lib/ai/llm-call.ts` |
| Scene cache (parallel) | `orchestrator/pipeline.ts` partition logic |
| Scene cache (sequential) | already merged in PR #191 |

## Wiring Gaps (from Phase 4.5)

**None found this cycle.** No `?? mock` fallbacks in production code. No `const mockX = [...]` arrays in non-test component files. The session's PRs added new modules with explicit data sources from the start.

## Scale / Format Issues (from Phase 4.5)

| File:Line | Pattern | Fix | SP |
|-----------|---------|-----|----|
| `app/projects/new/page.tsx:223` | `wordCount.toLocaleString()` | Add `'en-US', { maximumFractionDigits: 0 }` | 0.5 (UX-G-02) |
| `app/billing/page.tsx:123` | `(tierConfig?.scriptsPerMonth ?? 1).toLocaleString()` | Same | 0.5 (UX-G-02) |
| `components/impact/steps/StepAttestation.tsx:81` | `STORY_WORD_LIMIT.toLocaleString()` | Same | 0.5 (UX-G-02) |
| `components/impact/steps/StepWrite.tsx:117` | Same | Same | 0.5 (UX-G-02) |
| `components/wizard/ScriptImprovementWizard.tsx:287` | `max-h-[400px] overflow-y-auto` instead of `<ScrollArea>` | Use Radix ScrollArea for scroll indicator | 1 (UX-G-03) |

The four `toLocaleString()` bare hits roll up under one UX-G-02 fix.

## Still Incomplete (Carryover)

| Feature | Gap | SP | Sprint |
|---------|-----|----|-----|
| Notification feed (#174) | Awaiting Ryan scoping email (sent 2026-06-09) | 8 | Sprint B |
| Female teen voice IDs (DEBT-01) | Ryan-blocked | – | External |
| `/admin/corpus` ingestion (POST-02) | Ryan-blocked | – | External |
| Subscriptions upsert (DT-30-M-1) | admin/tier, upgrade, referral/upgrade routes don't upsert into `subscriptions` table | 2 | Sprint A |
| Play-count TOCTOU (PLAY-TOCTOU) | Non-atomic check | 2 | Sprint A |
| content_access_log retention | No cleanup cron | 2 | Sprint A |
| Pipeline FK + UUID (DT-31-H-1) | No FK from `scene_renders`/`timelines`/etc. to `projects` | 3 | Sprint A |
| Confirm dialog pattern (UX-G-01) | 6 sites still use `window.confirm` | 2 | Sprint A |

## Blocked (External Dependencies)

| Feature | Blocked By |
|---------|------------|
| Notification feed scope (#174) | Ryan response to scoping email (sent today) |
| `/admin/corpus` ingestion (POST-02) | Ryan + AI key validation |
| Female teen voice IDs (DEBT-01) | Ryan to share ElevenLabs voice IDs |
| Peter's PR review queue | Peter's review bandwidth (#192–#198 open) |
