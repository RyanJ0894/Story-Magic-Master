# Feature Completeness — 2026-05-28

## Completed Since Last Review ✅

| Feature | Evidence |
|---------|---------|
| LLM failover: OpenRouter multi-segment model IDs | PR #66 — `llm-client.ts` + `llm-failover.test.ts` |
| Team member re-invite reactivation (DATA-01) | PR #64 — `teams.ts:357` OR-clause + reactivate branch |
| Invite sign-up CTA for signed-out users (UX-P2-01) | PR #70 — `invite/[token]/page.tsx:198` redirect_url link |
| Invite-accept in transaction (DATA-03) | PR #70 — `invite/[token]/route.ts:196` `$transaction` |
| ElevenLabs output_format bug (Peter's find) | PR #69 — `audio.ts` + 17-test regression suite |
| Stems TTL auto-cleanup (2-day expiration) | PR #69 — `cleanup.ts` + `cleanup.test.ts` |

## Wiring Gaps (Phase 4.5)

| Component | Status | Notes |
|-----------|--------|-------|
| `upload-client.tsx:95` — `mockPreview` PDF placeholder | Still open | Deferred — real PDF preview needs investigation of live path first |

## Scale / Format Issues Fixed This Session

| Fix | File | Pattern |
|-----|------|---------|
| MRR toLocaleString | `admin/page.tsx:102` | `toLocaleString('en-US', { maximumFractionDigits: 0 })` |
| MRR toLocaleString | `admin/analytics/page.tsx:124` | Same |
| Partner amounts toLocaleString | `impact/partners/page.tsx:86,252` | `toLocaleString('en-US')` |

## Still Incomplete / Open

| Feature | Gap | SP | Sprint |
|---------|-----|-----|--------|
| UX-D-02 — Invite: pro-active sign-up CTA for signed-out | No pre-auth redirect before POST | 1 | Sprint B |
| UX-D-03 — Team: scroll containers on member lists | No `overflow-y-auto` / `max-h` | 1 | Sprint B |
| UX-E-05 — Stepper labels hidden below `sm` breakpoint | 10px text on 375px screens | 1 | Sprint B |
| FEAT-01 — Real PDF preview in upload-client.tsx | `mockPreview` placeholder at line 95 | 3 | Sprint C |

## Blocked (External)

| Feature | Blocked By |
|---------|-----------|
| Female-teen voice IDs (`hybrid-voice-search.ts:38`) | Ryan — voice ID list |
| Corpus ingestion at `/admin/corpus` (POST-02) | Ryan — AI key enrollment |
