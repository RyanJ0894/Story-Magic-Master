# Security & Quality — 2026-06-09

## Ownership Enforcement (replaces RLS — no Supabase)

Auth pattern: Clerk → middleware → Prisma query with `userId` predicate.

Verified clean (sampled this cycle):

| Surface | Wrapper | File |
|---------|---------|------|
| Web project routes | `withProjectAuth` | `app/api/projects/[id]/route.ts` |
| Web admin routes | `withAdminAuth` | `app/api/admin/users/route.ts` (+ siblings) |
| Orchestrator mutation routes | `serviceAuthMiddleware` | `src/index.ts:107–122` (generate-scenes, orchestrate, stitch-segments, analyze, preview, impact, stems) |
| Orchestrator download route | `authMiddleware` + IDOR/path-traversal guards | `src/index.ts:125` |

All routes audited touch user-owned data through `withProjectAuth` / `withAdminAuth` / `serviceAuthMiddleware`. No missing checks found this cycle.

## Security Surface — New This Session

The cost-opt PRs added new modules. Security review:

| PR | New surface | Security review |
|----|-------------|-----------------|
| #187 | Embedding Redis cache | Cache key = `sha256(query)` — no user input concatenation. Reads/writes wrapped in try/catch. ✓ |
| #191 | Scene cache table | DB writes go through Prisma typed model; no raw SQL with user data. ✓ |
| #193 | Wall-clock budget | Pure timer wrapper; no auth/state implications. ✓ |
| #195 | Mock provider | `assertNotInProduction()` throws hard on `NODE_ENV=production`. Fixture loader hardened with `ALLOWED_OPERATIONS` allowlist + hex-only regex; nosemgrep annotation explains why. ✓ |
| #196 | LlmCallLog table | Cost data persisted with strict typing; `projectId` nullable for project-less calls; no user-supplied strings reach SQL. ✓ |
| #198 | Web Adviser migration | `extractJsonObject` helper handles Claude's prose-wrapped JSON safely (depth-walked brace match; no regex backtracking). ✓ |

No new security findings.

## Input Validation

- All API routes use Zod `safeParse` on request bodies (verified across the modified surfaces)
- `script_text` size pre-flight cap at `MAX_SCRIPT_PAGES=150` / `MAX_SCRIPT_CHARS=75000` — enforced before any LLM call
- Adviser's new `extractJsonObject` handles malformed input gracefully — falls back to passing the raw text to `JSON.parse` so the error path remains clear

## Data Integrity Risks (NEW)

**DT-31-H-1 [HIGH]** — pipeline tables (`tts_stems`, `timelines`, `alignments`, `scene_renders`) store `project_id` as TEXT with no FK. Orphan rows accumulate on project deletion. For `scene_renders` specifically, the cache poisoning risk on project-ID reuse (admin restore from backup, test fixture seeds) is real but narrow. Migration fix proposed in `08-DATA-TIERS.md`. **3 SP. Sprint A item.**

## Secrets / Credentials

- Doppler→Render sync confirmed live this session (Groq key set in Doppler triggered an `api`-driven deploy)
- `GROQ_API_KEY` set in prd/stg/dev via Doppler CLI (verified 2026-06-09)
- No credentials in source files (grep clean)
- `.env.local` remains gitignored
- New `OPENROUTER_API_KEY` referenced by PR #194 — not yet set in Doppler (waiting on PR merge + Peter approval)

## Quality Highlights

- **Zod schema guard test (PR #197)** prevents the `.min/.max` regression class from recurring at unit-test time
- **Adviser migration (PR #198)** eliminates the last raw OpenAI SDK call site in the web package
- **TEST_MODE=mock (PR #195)** has belt-and-suspenders production guard + loud startup banner

## Open Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| DT-31-H-1 orphan accumulation | HIGH | Fix in next sprint |
| `window.confirm` on iOS PWA silent destructive (UX-G-01) | P1 | Shared `<ConfirmDialog>` refactor |
| PLAY-TOCTOU | HIGH (carryover) | Atomic guard, Sprint A |
| Peter's PR review queue backlog | Medium | 13 open PRs — needs ordered review |
