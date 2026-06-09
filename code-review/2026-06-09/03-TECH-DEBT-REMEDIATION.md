# Tech Debt Remediation — 2026-06-09

## Summary

- `console.log` in production paths: **0**
- `any` casts (uncommented, non-generated): **5** real, **4** justified
- TODO/FIXME comments (excluding generated + regex): **1** (Ryan voice IDs — DEBT-01)
- Deferred to small follow-up: **3** `directorJson: any` web-side cleanups (see TS report)

## Console.log audit

| Hit | Justified? |
|-----|------------|
| `packages/web/lib/csrf.ts:65` | ✅ Yes — intentional security-event log (`console.warn`) |
| `packages/web/lib/logger.ts:40-41` | ✅ Yes — logger wrapper internals |
| (orchestrator) | None |

**No remediation needed.** Peter's "shocking log volume on 5-page script" complaint from 2026-06-08 was already addressed in PR #178 (per-iteration logs demoted to debug). Independent verification: `[LLM] iteration` is the only iteration-rate INFO log retained and it's gated behind `LOG_LEVEL=debug` since PR #178.

## `any` cast audit

| File:Line | Verdict |
|-----------|---------|
| `orchestrator/src/lib/logger.ts:48,55,84` | Justified (express + pino-http typing) |
| `orchestrator/src/orchestrator/workers/whisper-align.ts:214` | Justified (form-data SDK quirk) |
| `web/lib/ai/providers.ts:63` | Justified, has eslint-disable comment + reason |
| `web/lib/generation/processor.ts:163,167` | **REMEDIATE** — should use `DirectorJSON` type. 1 SP. |
| `web/app/projects/[id]/project-workflow.tsx:107` | **REMEDIATE** — should use `DirectorJSON` prop type. 0.5 SP. |
| `web/app/projects/[id]/improvement-wizard-button.tsx:19` | **REMEDIATE** — should use `ScriptAnalysisReport`. 0.5 SP. |

Combined into one small follow-up PR: tighten 3 `any` declarations to shared types. **Total: ~1 SP, batched.**

## TODO/FIXME audit

| File:Line | Resolution |
|-----------|------------|
| `orchestrator/src/director/tools/hybrid-voice-search.ts:37` | DEBT-01 — placeholder for Ryan's female teen voice IDs. **Ryan-blocked, keep as-is.** |
| `orchestrator/src/director/validation/director-validator.ts:30` | False positive — regex pattern `/^TODO/i` to detect "TODO" in script text. Not a code TODO. |
| `orchestrator/src/generated/prisma/runtime/library.d.ts` | Generated file. Skip. |

## Fixed This Session

Nothing fixed directly in this review pass — the 14 cost-opt PRs from earlier tonight already addressed the highest-traffic debt:
- Per-iteration `[LLM]` logs demoted (PR #178)
- Schema `.min()/.max()` removals + post-LLM guards (PR #178)
- Raw OpenAI bypasses migrated (PR #178, #183, #198)
- Zod-schema guard test added so the .min/.max regression class can't recur (PR #197)

## Deferred — Next Sprint

1. **TS-CLEANUP-01** — Tighten 3 `directorJson: any` + 1 `existingScore: any` in `packages/web/lib/generation/` and `packages/web/app/projects/[id]/` to use shared types. 1 SP.
