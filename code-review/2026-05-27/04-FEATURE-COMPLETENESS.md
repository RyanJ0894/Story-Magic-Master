# Feature Completeness — 2026-05-27

## Wiring / placeholder gaps (Phase 4.5)
| ID | Component | Issue | Data source | SP |
|----|-----------|-------|-------------|----|
| FEAT-01 | `components/reader/upload-client.tsx:88-104` | PDF preview is **faked** — `pageCount = Math.floor(size/5000)`, `needsOCR: false`, comment "For now, simulate analysis". Preview shown to user is not real. | orchestrator already parses PDFs (`/generate-scenes`); a real preview endpoint or client-side `pdfjs` page count is needed | 3 |

**Verify before fixing:** confirm whether `upload-client.tsx` is the live upload
path or a legacy/secondary one — there may be a real upload flow elsewhere. If
live, the faked `pageCount`/`needsOCR` mislead users about large scripts.

## Delta features — completeness check
| Feature | State |
|---------|-------|
| LLM auto-failover (anthropic→openrouter→openai) | Wired end-to-end in `runAgentLoop` + `generateStructuredOutput`; **untested** (TEST-02) |
| Invite → sign-up → auto-accept | Complete; e2e spec added (`invite-signup-flow.spec.ts`) |
| ensureProfile backfill | Complete + tested (TEST-01) |
| BuildStamp footer | Complete, clean |
| PWA SW v3 + offline | Complete (prior sprint) |

## Blocked (external)
| Feature | Blocked by |
|---------|-----------|
| Corpus ingestion (`/admin/corpus`) | Ryan — POST-02 |
| Female-teen voice mapping | Ryan — voice IDs (DEBT-01) |
