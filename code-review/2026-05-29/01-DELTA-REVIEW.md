# Delta Review — 2026-05-29

**Prior review:** `code-review/2026-05-27/`
**Commits since:** `8e7bd69` → `faa3b19` (17 commits, including 9 merged PRs)

---

## Prior TODO Carryover Status

| ID | Item | Status | Evidence |
|----|------|--------|---------|
| DATA-01 | `addMember` 500 on re-invite | **RESOLVED** | PR #64, commit `616fbb6` — `teams.ts:356–407` now reactivates via `update` |
| DATA-02 | `profiles.email` index | **RESOLVED** | PR #67, commit `536d58b` — migration `0028_profiles_email_index` |
| TEST-01 | `ensure-profile.test.ts` | **RESOLVED** | Committed alongside DATA-02 fix |
| TEST-02 | LLM failover chain tests | **RESOLVED** | PR #66, commit `297c17e` — OpenRouter tier covered |
| FEAT-01 | Real PDF preview | **RESOLVED** | Prior session (merge confirmed) |
| CARRYOVER-2 | Dead `writerCode?` prop | **RESOLVED** | Fixed this session (`share-modal.tsx`, `writer-dashboard-client.tsx`) |
| UX-D-01 | Dev log panel in production | **CARRYOVER** | Still present at `generate-button.tsx:409` — gate not applied |
| DATA-03 | Transaction around invite-accept | **CARRYOVER** | `app/api/invite/[token]/route.ts` still two statements — now LOW per DT-27-2 |
| UX-P2-01 | Invite sign-up CTA | **CARRYOVER** | `app/invite/[token]/page.tsx:278` — still conditional |
| UX-P2-02 | Team settings scroll containers | **CARRYOVER** | `enterprise/team/page.tsx:251,290` — still unbounded |
| DEBT-02 | `[Audio]`/`[Invite]` console.logs | **CARRYOVER** | Pending Ryan stability confirmation |
| PLAY-TOCTOU | play route TOCTOU (CRITICAL→HIGH) | **CARRYOVER** | `play/route.ts:40–73` unchanged |
| CONTENT-LOG-RETENTION | `ContentAccessLog` no retention | **CARRYOVER** | No cleanup job added |

---

## New Since 2026-05-27

### Features / Fixes Shipped
- **ElevenLabs output format fix** — `output_format` moved to URL query param (`b909904`, PR #69)
- **Stems TTL expiration** — 2-day auto-purge cron for generated stems (`9c4fb72`)
- **Orchestrator static audio + DB auth fix** — miscellaneous fixes (`611c1eb`)
- **CODEOWNERS + PR template** — main branch protection bootstrapped (`c0bd15f`)
- **LLM failover chain** — Claude → OpenAI on 402/429/529 (`8e7bd69`, `3ac5383`)
- **Sprint C tests** — +58 tests: teams service, scoring service, orchestrator env (`faa3b19`)

### Newly Identified Issues (see individual docs)
- 3 new HIGH data-tier findings (`08-DATA-TIERS.md`)
- 7 new UX findings (`07-UX-INFO-DESIGN.md`)
- 2 stale component test files (`05-TEST-GENERATION.md`)
