# Delta Review — 2026-06-14 → 2026-06-16

26 commits, 72 files, +5,155 / −345 lines.

## Prior-review items, classified

### From 2026-06-14 TODO

| Item | Status | Closed by |
|------|--------|-----------|
| DT-31-H-1 — pipeline tables store `project_id` as TEXT, no FK | **RESOLVED** (was already closed by migration 0040; reconfirmed this round) | migration 0040 |
| UX-G-01 — `window.confirm` at 6 destructive sites | **RESOLVED** | #290 shared `ConfirmDialog` |
| UX-H-01 — `fmtInt()` shared helper | **RESOLVED** | #290 |
| UX-G-03 — `ScrollArea` wrappers on wizard + ScriptSyncPlayer | **RESOLVED** | #290 |
| UX-H-02 — `tabIndex={0}` + `onKeyDown` on upload drop zone | **RESOLVED** | #290 |
| UX-E-10 — confirm dialog focus management | **RESOLVED** | #290 |
| DT-32-L-1 — `llm_call_log.project_id` TEXT → UUID + FK | **RESOLVED** | migration 0041 |
| DT-32-H-1 — sub-account isolation in `listProjects` | **PARTIAL** — query path closed (#289), other entry points need audit pass | — |
| DT-30-M-1 — tier-route subscription desync | CARRYOVER (Sprint A) | — |
| PLAY-TOCTOU | CARRYOVER (Sprint A) | — |
| CONTENT-LOG-RETENTION | CARRYOVER (Sprint A) | — |
| #219 enterprise CSRF (CSP form-action) | IN REVIEW (PR #295) | — |
| A-005 character voices reading stage directions | IN REVIEW (PR #300) | — |
| A-006/007/008 invite regressions | IN REVIEW (PR #302) | — |
| A-003/004 partial-audio + Sentry breadcrumbs | IN REVIEW (PR #307) | — |

### Net carryover after this window

| ID | SP | Sprint |
|----|----|--------|
| DT-30-M-1 | 3 | A |
| PLAY-TOCTOU | 2 | A |
| CONTENT-LOG-RETENTION | 1 | A |
| VERIFY-DT-32-H-1 | 1 | A |
| T-01 voice-ID placeholder | 1 | A |
| T-03 resolveModel return type | 1 | A |
| T-02/T-04/T-05 various `any` casts | 5 | B |
| UX-I-01 audio-tuning beforeunload + Unlock semantics | 1.5 | A |
| UX-I-02–05 audio-tuning polish | 2 | B |
| TEST-A-01/02 audio-tuning regression guards | 2 | A |

**Sprint A total: 12.5 SP**
**Sprint B total: 7 SP**

## New scope landed (not previously planned)

The audio-tuning surface (B-001 through B-005) was scoped into existence between 2026-06-14 and 2026-06-16 based on Ryan's 2026-06-15 testing batch. It shipped end-to-end in three days: schema → orchestrator wiring → preview API → sliders UI → discoverability link. Full closure of Ryan's three audio-quality observations.

## Delta-summary

- **8 prior items RESOLVED**
- **3 prior items moved IN REVIEW** (now sitting on Peter's plate)
- **4 prior items still CARRYOVER**
- **1 NEW P1 finding** (UX-I-01) on the new audio-tuning surface
- **4 NEW P2 findings** (T-02/T-04/T-05/UX-I-02–05)
- **0 NEW HIGH security findings**
- **0 NEW TypeScript errors**

The codebase moved meaningfully forward without introducing technical debt at a faster rate than it closed it. Net carryover is *down* from 2026-06-14.
