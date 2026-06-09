# Delta Review — 2026-06-09

Tracking every line item from the 2026-06-03 TODO. Status: RESOLVED / CARRYOVER / SUPERSEDED.

## From `code-review/2026-06-03/TODO_2026-06-03.md`

### PR 2 — FK cascade GDPR
- [x] **RESOLVED** DT-30-H-1 — TeamShare.sharedBy SetNull (schema.prisma:810; migration 0033)
- [x] **RESOLVED** DT-29-NEW-2 — Purchase SetNull, userId nullable (schema:299–300; migration 0033)
- [x] **RESOLVED** DT-29-2/3 — ScriptShare sharedBy/sharedWith SetNull (schema:376–377; migration 0033)

### PR 3 — fix/play-toctou
- [ ] **CARRYOVER** PLAY-TOCTOU — Atomic `$executeRaw` play route with WHERE guard. No code change observed. See data-tier review for fix snippet.

### PR 4 — Doppler integration
- [x] **RESOLVED** render.yaml buildCommand + startCommand with `doppler run --` (verified earlier in session — sync is live).

### Sprint — Robustness
- [ ] **CARRYOVER** CONTENT-LOG-RETENTION — nightly `content_access_log` cleanup cron (2 SP)
- [ ] **CARRYOVER** DT-30-M-1 — subscriptions upsert in admin/tier, upgrade, referral/upgrade (2 SP)
- [x] **RESOLVED** UX-E-08 — Enterprise dashboard scroll containers (1 SP) — `max-h-[480px]` added at dashboard:312,358 + TeamNotesTab:60
- [x] **RESOLVED** UX-E-09 — Audio chooser touch targets — `h-10 w-10` at audio-chooser.tsx:270,297,482,494,728
- [ ] **CARRYOVER** UX-E-10 — Upload drop zone `onClick` + `tabIndex` (partially mitigated; role/aria-label added but no keyboard focus)
- [x] **RESOLVED** UX-E-11 — Share modal bulk tab mobile layout — `w-full sm:w-36`
- [x] **RESOLVED** UX-F-02 — EnterpriseProjectAssignment `h-9 w-9` touch targets
- [x] **RESOLVED** UX-F-03 — Team page AlertDialog (PARTIAL — only the team page; 6 more sites identified as UX-G-01)
- [ ] **CARRYOVER** DT-30-L-2 — admin/users search add email field (0.5 SP)
- [x] **RESOLVED** DT-29-1 — corpus export `take: 500` (admin/corpus/export/route.ts:17)

### External (Ryan)
- [ ] **CARRYOVER** POST-02 — corpus ingestion at `/admin/corpus`
- [ ] **CARRYOVER** DEBT-01 — female-teen voice IDs (hybrid-voice-search.ts:37)
- [x] **RESOLVED** Issue #125 — Stripe enterprise checkout (Option B) — addressed by open PR #171

---

## Status Roll-up

| Status | Count |
|--------|------|
| RESOLVED | 10 |
| CARRYOVER | 7 (incl. external) |
| SUPERSEDED | 0 |

The 5 carryovers (excluding 2 external Ryan-blocked) become Sprint A items in `SPRINT_PLAN.md`.

## Cost-opt arc — outside the 2026-06-03 TODO scope

The 14 cost-opt PRs (#178/#179/#181/#183/#184/#185/#187/#188/#189/#191/#192–#198) were not on the 2026-06-03 TODO — they emerged from the Peter Slack thread on 2026-06-08. They constitute a parallel sprint completed/in-flight tonight. See `code-review/2026-06-09/00-EXECUTIVE-SUMMARY.md` for tracking and `docs/COST-OPT-PLAN-2026-06-09.md` for the original plan.
