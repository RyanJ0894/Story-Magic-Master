# Tech Debt Remediation — 2026-05-27

## Summary
- `any` casts in delta: **0**
- console.log in prod paths: 5 (all intentional diagnostics — see below)
- TODO/FIXME: 1 real placeholder (external dependency)
- Fixed this session: 1 (UX-D-01 dev panel gate)

## Fixed
| File:Line | Pattern | Resolution |
|-----------|---------|------------|
| `generate-button.tsx:409` | dev debug panel always rendered | gated behind `NODE_ENV !== 'production'` |

## Deferred — intentional, keep until Ryan's issues confirmed resolved
| File:Line | Pattern | Reason |
|-----------|---------|--------|
| `generate-button.tsx:151,163,174` | `console.log('[Audio]...')` | live diagnostics for Ryan's audio-playback issues; remove once confirmed stable |
| `invite/[token]/page.tsx:93,102` | `console.log('[Invite]...')` | live diagnostics for the invite flow; have eslint-disable already; remove post-verification |

> `logger.ts:41` and `env.ts:164-174` console.logs are legitimate (logger impl +
> startup banner), not debt.

## Deferred — backlog
| ID | File:Line | Pattern | Reason | SP |
|----|-----------|---------|--------|----|
| DEBT-01 | `hybrid-voice-search.ts:38` | `TODO(PLACEHOLDER)` female-teen voice_id | blocked on Ryan sharing voice IDs (external) | — |
| CARRYOVER-2 | `share-modal.tsx:48` | dead `writerCode?` prop | cleanup | 1 |
