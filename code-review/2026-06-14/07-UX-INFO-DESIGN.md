# UX/Information Design Audit — 2026-06-14

**Scope:** Delta from 2026-06-09. Verified against PR #271 / #275 (Listen flow fix — they did **not** introduce a shared `ConfirmDialog`, despite the prompt's hint). The 6-site `window.confirm` problem from UX-G-01 is still open, and one new site (`dashboard-tabs.tsx:61`) has been added since the prior review. No `<ConfirmDialog>` or `AlertDialog` primitive exists in `components/ui/` yet — only `dialog.tsx`. The team page (`team/page.tsx:507`) still inlines a `<Dialog>`-based confirmation; that pattern is still the canonical reference but has not been promoted to a shared component.

## Summary
- 0 P0 findings
- 2 P1 findings (1 CARRYOVER expanded scope, 1 NEW)
- 4 P2 findings (3 CARRYOVER, 1 NEW)

## Prior-Round Status

| Prior ID | Status | Notes |
|----------|--------|-------|
| UX-G-01 (window.confirm × 6) | **CARRYOVER — WORSE** | All 6 sites unchanged; +1 new site at `dashboard-tabs.tsx:61` (delete project). No shared `ConfirmDialog` was extracted. Line numbers in `shares/page.tsx` drifted: now 181 / 202 (was 162 / 183). |
| UX-G-02 (`wordCount.toLocaleString()`) | **CARRYOVER** | `projects/new/page.tsx:223` unchanged. 4 additional unargued call sites exist in non-currency contexts (impact wizard, request-limits, billing tier) — see UX-H-01. |
| UX-G-03 (Wizard `max-h-[400px]`) | **CARRYOVER** | `ScriptImprovementWizard.tsx:287` unchanged. |
| UX-E-10 (Upload drop zone keyboard) | **CARRYOVER** | `upload-client.tsx:238` still has `role="button"` + `aria-label` but no `tabIndex={0}`, no `onClick`, no `onKeyDown`. User still must tab past the drop zone to reach the inner "Select PDF File" button. |

## P0 Findings

None.

## P1 Findings

### [CARRYOVER, EXPANDED] UX-G-01 — `window.confirm` for destructive actions (now 7 sites) — multiple
**Issue:** Still unresolved. The shared `<ConfirmDialog>` proposed last round was never extracted, and a 7th site has appeared:

- `app/projects/[id]/project-workflow.tsx:1084` — remove project from team share
- `app/projects/[id]/project-workflow.tsx:1125` — add project to team share
- `app/projects/[id]/shares/page.tsx:181` — deactivate single share link
- `app/projects/[id]/shares/page.tsx:202` — **deactivate ALL share links (bulk, irreversible)**
- `components/project/CommentsSidebar.tsx:91` — delete comment
- `components/project/NotesPanel.tsx:86` — delete note
- **NEW:** `app/dashboard/dashboard-tabs.tsx:61` — delete project (cannot be undone)

iOS standalone PWA mode silently returns `true` from `window.confirm()`, so on the most marketing-relevant install path every one of these is a silent destructive action. `shares/page.tsx:202` and `dashboard-tabs.tsx:61` are the highest priority — both are irreversible.

**Fix:** Extract `components/ui/confirm-dialog.tsx` from the inline pattern at `team/page.tsx:507-529`. Signature:
```tsx
<ConfirmDialog
  open={confirm?.kind === 'delete-project'}
  title="Delete project?"
  description={`"${confirm?.name}" will be permanently removed.`}
  confirmLabel="Delete"
  variant="destructive"
  onConfirm={() => doDelete(confirm.id)}
  onCancel={() => setConfirm(null)}
/>
```
Then refactor all 7 sites + retro-fit `team/page.tsx` to use it.
**Cost:** 2 SP (1 SP component, 1 SP for 7 callsite refactors)

### [NEW] UX-H-01 — `toLocaleString()` without locale at 5 sites — multiple
**Issue:** Prior round caught `projects/new/page.tsx:223`. A repository sweep reveals 4 additional sites with the same SSR/CSR hydration risk and inconsistent formatting:

- `app/billing/page.tsx:136` — `scriptsPerMonth.toLocaleString()` on the billing tier card
- `lib/validation/request-limits.ts:62` — error message string with `SCRIPT_TEXT_MAX_CHARS.toLocaleString()`
- `components/impact/steps/StepWrite.tsx:117` — `STORY_WORD_LIMIT.toLocaleString()` in word counter
- `components/impact/steps/StepAttestation.tsx:81` — `STORY_WORD_LIMIT.toLocaleString()` in copy
- `app/projects/new/page.tsx:223` — (carryover) `wordCount.toLocaleString()`

The billing-page one is the worst — it's rendered in SSR, server may default to `en-US-POSIX` and client to whatever the browser reports, producing a hydration warning on the conversion page. None of these are currency, but they should all pass `'en-US'` for consistency with `admin/page.tsx:102` and `admin/analytics/page.tsx:124`.

`components/ui/date-time.tsx:50` (`d.toLocaleString()`) is intentionally locale-respecting (date/time UI), leave it.

**Fix:** Add a `lib/format.ts` helper:
```ts
export const fmtInt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
```
Replace 5 sites.
**Cost:** 1 SP

## P2 Findings (Polish)

### [CARRYOVER] UX-E-10 — Upload drop zone: no keyboard focus, no click-to-open — `components/reader/upload-client.tsx:238`
**Status:** Still partial. `role="button"` + `aria-label` are present (good), but the div has no `tabIndex={0}`, no `onClick` handler to open the file picker, and no `onKeyDown` for Enter/Space. Users must tab past the drop zone to reach the inner "Select PDF File" button — the entire affordance the drop-zone visual implies (clickable big surface) is non-functional via keyboard.
**Fix:**
```tsx
const inputRef = useRef<HTMLInputElement>(null);
<div
  className={...}
  role="button"
  tabIndex={0}
  aria-label="Upload screenplay file"
  onClick={() => inputRef.current?.click()}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  ...
  <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileSelect} />
</div>
```
Drop the inner `<label>` + `<Button>` wrapper, or leave them and make sure they `e.stopPropagation()` so the outer click handler doesn't re-fire.
**Cost:** 1 SP

### [CARRYOVER] UX-G-03 — `ScriptImprovementWizard` `max-h-[400px]` silently clips — `components/wizard/ScriptImprovementWizard.tsx:287`
**Status:** Unchanged. Container is `max-h-[400px] overflow-y-auto` with no visible scrollbar styling. With 15+ suggestions (realistic for a feature-length script), users have no signal more content exists below.
**Fix:**
```tsx
import { ScrollArea } from '@/components/ui/scroll-area';
<ScrollArea className="max-h-[400px]">
  <div className="space-y-3">...</div>
</ScrollArea>
```
**Cost:** 0.5 SP

### [NEW] UX-H-02 — `ScriptSyncPlayer` lyric pane `max-h-[400px]` clips full-script lines — `components/player/ScriptSyncPlayer.tsx:406`
**Issue:** The non-expanded player view caps the script-sync pane at 400px. For a 90-page screenplay this fits ~20 lines (~3% of the script) before silently clipping. There is no visible scrollbar styling and no "expand" affordance hint next to the visible content. The `expanded` toggle exists (`min-h-0` when expanded) but the user doesn't know it does anything beyond looking taller. Use `ScrollArea` + a small "Expand to full view" link inline at the bottom of the pane.
**Fix:**
```tsx
<ScrollArea className={cn('flex-1', expanded ? 'min-h-0' : 'max-h-[400px]')}>
  {/* lines */}
</ScrollArea>
```
+ small text affordance: `{!expanded && <button onClick={() => setExpanded(true)}>Show full script</button>}`.
**Cost:** 1 SP

### [VERIFIED CLEAN] Notification dropdown `max-h-[480px]` — `components/notifications/NotificationDropdownContent.tsx:64`
**Status:** Safe — the API call hard-caps at `limit=10`, so the pane will never receive enough rows to clip. Full feed lives at `/dashboard/notifications`. No action.

## Items Verified Clean

- `admin/page.tsx:102`, `admin/analytics/page.tsx:124` — still pass `'en-US', { maximumFractionDigits: 0 }`. Reference pattern.
- StoryAdviser / AdviserWizard / ScriptImprovementWizard / StoryBuilderWizard all render error state from `setError`. No dead error code paths.
- Enterprise dashboard (`dashboard/page.tsx:309,355`) + `TeamNotesTab.tsx:60` scroll containers still capped (verified from UX-E-08 last round).
- Audio chooser touch targets still ≥ 36px.
- `StoryBuilderWizard` has a real step-machine (`wizard-state.ts`) with `ProgressBar` and `stepIndex`/`nextStep`/`prevStep`. No missing-stepper finding here.

## Sprint Plan

| ID | SP | Title | File:Line | Priority |
|----|-----|-------|-----------|----------|
| UX-G-01 | 2.0 | Extract `<ConfirmDialog>` + replace `window.confirm` (7 sites) | `dashboard-tabs.tsx:61`, `project-workflow.tsx:1084,1125`, `shares/page.tsx:181,202`, `CommentsSidebar.tsx:91`, `NotesPanel.tsx:86` | P1 |
| UX-H-01 | 1.0 | `fmtInt()` helper + replace 5 unargued `toLocaleString()` calls | `billing/page.tsx:136`, `request-limits.ts:62`, `StepWrite.tsx:117`, `StepAttestation.tsx:81`, `projects/new/page.tsx:223` | P1 |
| UX-E-10 | 1.0 | Drop zone keyboard + click-to-open | `upload-client.tsx:238` | P2 |
| UX-H-02 | 1.0 | ScriptSyncPlayer ScrollArea + expand affordance | `ScriptSyncPlayer.tsx:406` | P2 |
| UX-G-03 | 0.5 | Wizard suggestion list ScrollArea | `ScriptImprovementWizard.tsx:287` | P2 |

**Total SP:** 5.5 — **P0:** 0 | **P1:** 3.0 | **P2:** 2.5

**Trend:** Up from 4.0 SP (2026-06-09) to 5.5 SP. None of the prior round's 4 UX items were fixed, and the `window.confirm` problem grew by one site. The team's velocity was spent on Sentry/hydration/Listen-flow hardening (PRs #269–#286), so UX polish slipped. Recommendation: bundle UX-G-01 + UX-H-01 into a single PR titled "Shared `<ConfirmDialog>` + `fmtInt()` helper" since both are trivial extract-and-replace patterns that close out two carryover items at once.
