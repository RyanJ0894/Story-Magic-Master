# Delta Review — 2026-05-27 (vs 2026-05-26)

## Commits since last review (11)

| Commit | Summary | Review note |
|--------|---------|-------------|
| c0bd15f | CODEOWNERS + PR template (workflow bootstrap) | OK — enables PR gate |
| 3ac5383 | LLM failover chain + ensureProfile backfill + invite signup spec | failover untested (TEST-02); ensureProfile now tested (TEST-01) |
| 8e7bd69 | LLM auto-failover Claude→OpenAI | see TEST-02 |
| 9136a73 | invite sign-up route + team list stale-state | OK — covered by e2e |
| 26c1208 | ryan-flow e2e 9/9 | OK |
| f9d7541 | invite structured logging + INVALID_STATUS redirect + audio diagnostics | diagnostic console.logs (intentional) |
| e2e6e14 | build datetime stamp in footer | OK — BuildStamp clean |
| 8d044f1 | invite re-accept after removal (unique constraint) | accept-side fixed; **write-side still bugged → DATA-01** |
| af1aa79 | SW v3 + audio error handling + session expiry | OK |
| eac39ce | CSP: orchestrator in connect-src | OK |
| 49a22f5 | ensureProfile inside try/catch + guard unique constraint | OK |

## Prior-review item status

| ID | Item | Status |
|----|------|--------|
| CARRYOVER-1 | shares route `take:100` limit | ✅ RESOLVED (`shares/route.ts:44`) |
| CARRYOVER-2 | dead `writerCode` prop in share-modal | ⬜ CARRYOVER (`share-modal.tsx:48`) |
| CARRYOVER-3 | protected-player touch seek | ✅ RESOLVED (`protected-player.tsx:183`) |
| POST-02 | corpus ingestion (Ryan) | ⬜ EXTERNAL |

## Scope note
The invite-accept unique-constraint fix (8d044f1) hardened the **read/accept**
side. The data-tier audit found the **write/invite** side (`addMember`) has the
same latent bug for *removed* members — see DATA-01. These are twins; the second
was missed in the original fix.
