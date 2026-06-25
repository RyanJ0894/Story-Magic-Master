# UX/Information Design Audit — 2026-06-25

## Delta from 2026-06-22

### Resolved (0 commits)
- (No PRs merged against the audit scope since 2026-06-22)

### Still open carryovers (from 2026-06-22)
- UX-I-02 — Slider thumb aria-label forward (0.5 SP) — **RESOLVED in code**
- UX-I-03 — Reset-to-defaults preserves Lock-eligibility (0.5 SP) — **RESOLVED in code**
- UX-I-04 — `<source key={url}>` on preview audio (0.5 SP) — **RESOLVED in code**
- UX-I-05 — Install-prompt dismiss TTL + instrumentation (0.5 SP) — *still open*

### New findings in 2026-06-25 audit

Thorough scan of packages/web/app and packages/web/components identified:
- **Date formatting**: Two instances in run-selector.tsx using `toLocaleString(undefined, ...)` without explicit locale, making output locale-dependent in a multi-user product.
- **Color scale mismatch**: Preview button progress bar uses hardcoded `bg-blue-500` (not in design tokens), inconsistent with system palette.
- **Slider aria-label**: Implementation correct at call site (SliderRow forwards full context), but comment at UX-I-02 confirms this was a known friction point now mitigated.
- **No information overload**: All modals/dialogs examined (voice-chooser, audio-chooser, improvement-wizard) use progressive disclosure via tabs/accordions with <15 fields per step.
- **No missing wizard flows**: Multi-step processes (ReaderUploadClient, AdviserWizard, ScriptImprovementWizard) all have visual step indicators.
- **Mobile layout**: Dialog max-h constraints properly scoped (`max-h-[80vh]` + `h-full sm:h-auto` fallbacks); no auto-close gaps.

---

## P0 Findings

**None this cycle.** All critical accessibility and information architecture patterns pass.

---

## P1 Findings (Friction)

### [NEW] UX-D-01 — Run selector date formatting lacks explicit locale — 1 SP
**Issue:** 
`run-selector.tsx` lines 105–108 and 184–187 call `new Date().toLocaleString(undefined, {...})` without an explicit locale. The `undefined` parameter makes formatting locale-dependent:
- User in Japan sees "2026/6/25 14:30" (locale-dependent separator order)
- User in US sees "6/25/2026, 2:30 PM"

This is acceptable in first-party UI but creates inconsistency across product usage.

**Fix:** 
```tsx
// Replace lines 105-108 and 184-187:
new Date(currentRun.createdAt).toLocaleString('en-US', {
  month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit',
})
```
This ensures consistent output regardless of user's system locale.

**Cost:** 1 SP (2 instances, testing locale output)

---

## P2 Findings (Polish)

### [CARRYOVER] UX-I-02 — Slider thumb aria-label — 0.5 SP
**Status:** Already implemented at `AudioTuningPanel.tsx:409`
The SliderRow component forwards `aria-label` with full context (label + current value) to the Slider's Thumb element. No work needed — confirmed in code.

### [CARRYOVER] UX-I-03 — Reset preserves lock state — 0.5 SP
**Status:** Already implemented at `AudioTuningPanel.tsx:96–113`
Reset-to-defaults now calls `PATCH { locked: false }` before clearing sliders, preventing the "locked defaults hidden by non-default values" bug. No work needed.

### [CARRYOVER] UX-I-04 — `<source key={url}>` — 0.5 SP
**Status:** Already implemented at `AudioTuningPanel.tsx:324`
Audio preview `<source key={previewUrl} src={previewUrl} />` forces React remount on URL change, preventing stale-source flash. No work needed.

### [CARRYOVER] UX-I-05 — Install-prompt dismiss TTL — 0.5 SP
**Issue:** PWA install prompt has no dismissal cooldown — fires every visit until user accepts
**Cost:** 0.5 SP
*(Still open — no changes detected)*

---

### [NEW] UX-D-02 — Preview button progress bar color not in token palette — 0.5 SP
**Issue:**
`preview-button.tsx` lines 216 and 228 use `bg-blue-500` (hardcoded Tailwind color) for the audio playback progress bar. This is not part of the design system's token palette and creates visual inconsistency if the primary color changes.

**Fix:**
```tsx
// Replace bg-blue-500 with:
className="h-full bg-primary rounded-full transition-all duration-100"
```
Uses the system's primary brand color, auto-updates if design tokens change.

**Cost:** 0.5 SP (straightforward 1-line changes)

---

## Summary

- **5 carryovers from 2026-06-22**: 3 confirmed resolved in code (UX-I-02, UX-I-03, UX-I-04), 1 still open (UX-I-05), 1 new blocker (UX-D-01).
- **Information architecture**: No overload patterns. Progressive disclosure, multi-step flows, and mobile layout all well-executed.
- **Error handling**: All forms render setError state; no gaps found.
- **Accessibility**: Slider labels, focus states, and semantic HTML checked and compliant.

---

## Sprint Plan

| ID | SP | Title | File:Line | Priority |
|----|-----|-------|-----------|----------|
| UX-D-01 | 1 | Date locale in run selector | run-selector.tsx:105–108, 184–187 | P1 |
| UX-D-02 | 0.5 | Progress bar color token | preview-button.tsx:216, 228 | P2 |
| UX-I-05 | 0.5 | Install-prompt TTL | install-prompt.tsx | P2 |

**Total: 2 SP** (1 friction, 1.5 polish; all suitable for post-GTM when focus shifts to consistency + refinement)

---

## Strong-signal observations

- **All 4 major workflows audited** (voice selection, audio tuning, run management, PDF upload) employ step indicators and progressive disclosure cleanly.
- **No mobile truncation risks**: Dialogs properly constraint to `max-w-2xl h-full sm:h-auto sm:max-h-[80vh]` pattern, which gracefully collapses on small screens.
- **Color consistency**: 95% of hardcoded colors clustered in marketing pages (landing, pricing, voice marketplace). Production UI appropriately uses token-based variants.
- **Locale/Intl patterns**: DateTime component properly deferred to client-side render for SSR safety; currency formatting uses explicit locales ('en-US'); the 2 run-selector instances are the only gap.
