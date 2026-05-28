# Sprint Plan — 2026-05-27

Unified across Code-Review V3 + UX + Data-Tiers. Sorted by priority. Each item
is one focused PR (main is now branch-protected — all via PR + Peter review).

## Sprint 1 — correctness (do first)
| ID | Pri | SP | Title | File |
|----|-----|----|-------|------|
| DATA-01 | HIGH | 2 | Fix `addMember` re-invite 500: reactivate the existing `removed` row instead of `create` (and clear/relink `userId`); pairs with removeMember setting status `removed` but keeping userId | `lib/services/teams.ts:317` |
| DATA-02 | MED | 1 | Add `@@index([email])` to `profiles` (Prisma) + migration | `packages/web/prisma/schema.prisma` |
| TEST-02 | P1 | 2 | Export + test `buildFailoverChain`/`isFailoverableError`; cover OpenRouter tier | `orchestrator/src/lib/llm-client.ts` |

## Sprint 2 — robustness + polish
| ID | Pri | SP | Title | File |
|----|-----|----|-------|------|
| DATA-03 | MED | 2 | Wrap invite-accept "new member" branch in a transaction | `app/api/invite/[token]/route.ts` |
| FEAT-01 | P2 | 3 | Replace faked PDF preview with real page count / OCR detection (verify it's the live upload path first) | `components/reader/upload-client.tsx` |
| UX-P2-01 | P2 | 1 | Invite page: show sign-up CTA to signed-out users instead of "Accept" | `app/invite/[token]/page.tsx` |
| UX-P2-02 | P2 | 1 | Add scroll container to team member/pending lists (real-data scale) | `app/enterprise/team/page.tsx` |
| CARRYOVER-2 | P2 | 1 | Remove dead `writerCode?` prop | `components/dashboard/share-modal.tsx:48` |

## Sprint 3 — cleanup (after Ryan's issues confirmed resolved)
| ID | Pri | SP | Title |
|----|-----|----|-------|
| DEBT-02 | P2 | 1 | Remove `[Audio]`/`[Invite]` diagnostic console.logs |

## External (blocked on Ryan)
- POST-02 — corpus ingestion at `/admin/corpus`
- DEBT-01 — female-teen voice IDs for `hybrid-voice-search.ts`

## Already done in this review
- ✅ UX-D-01 — dev panel gated behind `NODE_ENV` (P1)
- ✅ TEST-01 — `ensure-profile.test.ts` (+6 tests)
