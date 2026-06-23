# UX/Information Design Audit — 2026-06-22

## Delta from 2026-06-16

### Resolved (50 commits since last review)
- A-006 invite auto-accept removed; explicit Accept button surfaces signed-in email
- "+ Add Notes" hover label shipped (PR #344)
- Invite logo upsized w-8 → w-12 to match signup/auth pages (#344)
- ProjectReactionBar replaces per-scene Like/Dislike with project-level toolbar (#362)
- Progressive playback "Your screenplay is ready" message replaces contradictory spinner (#361)
- NotificationBell + 30s polling feed (#174 wired via #356)
- "Service is warming up" copy on orchestrator readiness probe (#355)

### Still open carryovers (from 2026-06-16 — none weekend-blocking)
- UX-I-02 — Slider thumb aria-label forward (0.5 SP)
- UX-I-03 — Reset-to-defaults preserves Lock-eligibility (0.5 SP)
- UX-I-04 — `<source key={url}>` on preview audio (0.5 SP)
- UX-I-05 — Install-prompt dismiss TTL + instrumentation (0.5 SP)
- T-01 — voice-ID placeholder (1 SP, BLOCKED on Ryan picking from catalog)

## P0 Findings

**None this cycle.**

## P1 Findings

**None this cycle.** All five weekend-shipped components audited (ProjectReactionBar, NotificationBell + Dropdown, InvitePage rewrite, Progressive playback UX, ScreenplayPlayer notes affordance) pass the audit cleanly.

## P2 Findings (Polish)

### [CARRYOVER] UX-I-02 — Slider thumb aria-label — 0.5 SP
**Issue:** Audio-tuning panel sliders lack `aria-label` on the visible thumb
**Fix:** add `aria-label="Music gain (dB)"` etc. on each `<Slider>` instance
**Cost:** 0.5 SP

### [CARRYOVER] UX-I-03 — Reset preserves lock state — 0.5 SP
**Issue:** "Reset to defaults" can leave the row in a Locked state with non-default values
**Fix:** after reset, set `locked = false` and let user re-lock explicitly
**Cost:** 0.5 SP

### [CARRYOVER] UX-I-04 — `<source key={url}>` — 0.5 SP
**Issue:** Audio preview `<audio>` tag swaps `<source>` URL without React key, causing brief stale-source flash
**Cost:** 0.5 SP

### [CARRYOVER] UX-I-05 — Install-prompt dismiss TTL — 0.5 SP
**Issue:** PWA install prompt has no dismissal cooldown — fires every visit until user accepts
**Cost:** 0.5 SP

## Sprint Plan

| ID | SP | Title | File:Line | Priority |
|----|-----|-------|-----------|----------|
| UX-I-02 | 0.5 | Slider thumb aria-label | components/audio-tuning/Slider.tsx | P2 |
| UX-I-03 | 0.5 | Reset preserves Lock | AudioTuningPanel.tsx | P2 |
| UX-I-04 | 0.5 | `<source key>` on preview | preview-button.tsx | P2 |
| UX-I-05 | 0.5 | Install-prompt TTL | components/install-prompt.tsx | P2 |

Total: 2 SP, all polish, all post-GTM acceptable.

## Strong-signal observations

- **All five weekend components** ship without introducing new UX debt
- **Error state coverage** is complete on all five (toast on save failure, explicit error cards on invite, empty/loading/error tri-state on notification feed)
- **Mobile**: bounded `max-h-[Npx]` constraints all sit on team-member lists (≤5 active members typical) — not real-data scale failures
- **Currency/locale**: zero `toLocaleString()` calls without explicit locale in production code
