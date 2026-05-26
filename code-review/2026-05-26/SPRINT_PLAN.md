# Sprint Plan — v3.2 (Post-2026-05-26 Review)

**Status:** Sprint v3.1 complete and deployed. All critical/high items resolved. Remaining items are polish + one external blocker.

---

## Sprint v3.2: Share Polish + Mobile

### Immediate (< 1 SP each)

| ID | SP | Task | File |
|----|-----|------|----|
| SH-P1 | 2 | Touch seek on ProtectedPlayer (public `/s/[code]` page) | `components/player/protected-player.tsx` |
| SH-P2 | 1 | Add `take: 100` to shares findMany | `app/api/projects/[id]/shares/route.ts:41` |
| SH-P3 | 1 | Remove dead `writerCode` prop from share-modal | `components/dashboard/share-modal.tsx:47` |

**Total: 4 SP**

---

## External (Ryan)

| ID | Task | Owner |
|----|------|-------|
| POST-02 | Add `ANTHROPIC_API_KEY` + `GOOGLE_GENERATIVE_AI_API_KEY` to Render, run corpus ingestion at `/admin/corpus` | Ryan |

---

## Later

- Enterprise multi-user share limits (tracked in ROADMAP)
- Share expiry reminder emails (tracked in ROADMAP)
- Share analytics chart view (tracked in ROADMAP)
