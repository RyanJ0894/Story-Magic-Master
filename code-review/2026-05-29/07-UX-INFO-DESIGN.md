# UX/Information Design Audit — 2026-05-29

**Scope:** Full sweep of `packages/web/app/` and `packages/web/components/` against eight UX/info-design categories.
**Prior review:** `code-review/2026-05-27/07-UX-INFO-DESIGN.md` — 4 items (UX-D-01..04), 3.5 SP total. All carryover items noted below where still unresolved.
**Audited today:** enterprise dashboard, project workflow, share-modal, upload-client, billing, admin stats, wizard, voice-chooser, audio-chooser, dashboard-tabs, admin-sidebar.

---

## P0 Findings

### [CARRYOVER UX-D-01] "Dev Log Panel" rendered to all users in production — `app/projects/[id]/generate-button.tsx:409-422`

**Issue:** The dark "Generation Log (dev mode)" panel is still present with no `NODE_ENV` or feature-flag gate. Confirmed not fixed since 2026-05-27. Every enterprise customer sees this during their ~2-minute generation wait — the screen's most prominent block.

**Fix:**
```tsx
{process.env.NODE_ENV !== 'production' && (
  <div className="mt-4 p-3 bg-slate-900 rounded-lg ...">
    {/* Dev Log Panel */}
  </div>
)}
```
**Cost:** 1 SP

---

## P1 Findings

### [NEW] Enterprise upsell banner shown to all tiers including enterprise admins — `app/dashboard/dashboard-tabs.tsx:260-275`

**Issue:** The "Enterprise Packages!" card (with the $6,000/yr pitch) renders unconditionally in the Overview tab sidebar for every authenticated user, regardless of `tier`. There are four PRICING_TIERS (`free`/`creator`/`pro`/`studio`); an enterprise admin landing on their personal dashboard (which maps to one of those tiers) sees the banner even after purchasing. At minimum, `studio` tier users — the highest-paying individual customers — should not be pitched team plans repeatedly. There is no dismissal mechanism and no persistence flag to hide after first click.

**Fix (minimal):** Gate the banner to tiers below `studio`:
```tsx
{tier !== 'studio' && (
  <div className="rounded-xl border border-border bg-card p-5">
    {/* Enterprise Packages banner */}
  </div>
)}
```
A dismissal flag (localStorage or DB) would be P2 polish on top of this gate.

**Cost:** 1 SP

### [NEW] `ScriptImprovementWizard` suggestions list hard-clipped at 300 px AND silently truncates to 5 items — `components/wizard/ScriptImprovementWizard.tsx:287-288`

**Issue:** Two problems compound: (a) `max-h-[300px] overflow-y-auto` caps the list at ~4 items before the user must scroll — but the scroll container has no visual indicator (no scrollbar styling, no "X more below" hint), so users with 10 suggestions do not know they exist; (b) `suggestions.slice(0, 5)` hard-caps at 5 even though the API can return up to 10 (`maxSuggestions: 10` in the POST). The API generates 10, the wizard silently discards 5, and the remaining 5 are half-hidden behind an unmarked scroll. The badge counts (Critical/Important/Minor) correctly tally all 10, but the list shows at most 5 — a visible contradiction ("3 Critical" badge, only 2 critical items visible).

**Fix:** Remove the `.slice(0, 5)` — show all returned suggestions inside the scroll container. Raise `max-h` to `max-h-[400px]` and add `pr-2` for the scrollbar gutter (already on the voice-chooser list for reference). Optionally add `<p className="text-xs text-muted-foreground text-center pt-1">Scroll for more</p>` when `suggestions.length > 4`.

**Cost:** 1 SP

### [NEW] `toLocaleString()` without locale/options on financial values — `app/admin/page.tsx:102`, `app/admin/analytics/page.tsx:124`

**Issue:** Both admin pages render MRR as `` `$${mrrEstimate.toLocaleString()}` `` without locale or `minimumFractionDigits` options. `toLocaleString()` with no args uses the browser's locale: on a European or Asian system this formats `$1,234` as `$1.234` (dot as thousands separator), which combined with the leading `$` produces nonsensical output. The `billing/page.tsx:115` hard-codes `` `${tierConfig?.monthlyPrice || 0}` `` without any separator at all (fine for small integers but not future-proof). The `impact/partners/page.tsx:86,252` also uses bare `toLocaleString()` on `annualAmount`.

**Fix:** Replace with explicit locale + options:
```tsx
// Replace: `$${mrrEstimate.toLocaleString()}`
// With:
mrrEstimate.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
```
Apply to all four callsites: `admin/page.tsx:102`, `admin/analytics/page.tsx:124`, `impact/partners/page.tsx:86`, `impact/partners/page.tsx:252`.

**Cost:** 1 SP (all four sites in one pass)

---

## P2 Findings (Polish)

### [CARRYOVER UX-D-02] Invite page: show sign-up CTA to signed-out users instead of failed Accept click — `app/invite/[token]/page.tsx:278`

**Issue:** Still unresolved. Signed-out visitors click "Accept Invitation", get a failed POST, then see the sign-up state. The primary CTA should be "Create account & accept" from the start.

**Fix:** When `clerkLoaded && !isSignedIn`, render the sign-up link as primary button instead of the `Accept` button.
**Cost:** 1 SP

### [CARRYOVER UX-D-03] Team page: member + pending lists have no scroll container — `app/enterprise/team/page.tsx:251,290`

**Issue:** Still unresolved. Both lists render all rows unbounded.

**Fix:** Wrap each `<div className="space-y-2">` in `<div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">`.
**Cost:** 1 SP

### [CARRYOVER UX-D-04] Invite-accept `console.log` calls in production — `app/invite/[token]/page.tsx:92,101`

**Issue:** Still present.
**Fix:** Remove or gate behind `NODE_ENV !== 'production'`.
**Cost:** 0.5 SP

### [NEW] Enterprise dashboard activity feed (up to 50 rows) and team member list (up to 50 rows) have no scroll container — `app/enterprise/dashboard/page.tsx:257-282, 303-317`

**Issue:** The DB query fetches `take: 50` for `activityLogs` and `take: 50` for `members`. Both lists are rendered in plain `<div className="space-y-3">` / `<div className="space-y-2">` inside `<CardContent>` with no `max-h`/`overflow-y-auto`. 50 activity rows × ~52px each = 2,600 px of scroll inside the card on the Overview tab. A mature enterprise team (20 members, 50 recent events) will produce a near-unusable page. The earlier carryover item (UX-D-03) was the *team settings* page; this is the separate enterprise *dashboard*.

**Fix:** Wrap both lists in a bounded scroll container:
```tsx
// activityLogs list (line 257):
<div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">

// team members list (line 303):
<div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
```
**Cost:** 1 SP

### [NEW] Audio-chooser: 32 px icon buttons (`h-8 w-8`) as primary touch targets in a modal used on mobile — `app/projects/[id]/audio-chooser.tsx:270,285,297`

**Issue:** Three icon buttons — play/preview (`h-8`), delete (`h-8 w-8 p-0`) — and two `SelectTrigger` controls (`h-8 text-xs`) all sit at 32 px height, below the 44 px minimum recommended by Apple/Google for touch targets. These are inside the full-screen audio chooser modal (`h-full sm:h-auto`) which is explicitly sized for mobile (`h-full` at `<sm`). The per-track row actions are the primary interaction point in this modal.

**Fix:** Bump icon buttons from `h-8 w-8` to `h-10 w-10` (or use `size="default"` instead of `size="sm"` on icon buttons). `SelectTrigger` controls: change `h-8` to `h-9` at minimum; `h-10` preferred.
**Cost:** 1 SP (mechanical find-replace in audio-chooser.tsx)

### [NEW] `upload-client.tsx` drop zone uses a `<div role="button">` instead of a real `<button>`, causing enter/space key activation failure — `components/reader/upload-client.tsx:288-318`

**Issue:** The drag-and-drop zone is a `<div role="button" aria-label="Upload screenplay file">` with `onDragOver`/`onDrop` but no `onClick`, no `onKeyDown`, and no `tabIndex`. Keyboard users and screen readers cannot activate it — clicking the visible "Select PDF File" `<label>/<Button>` works, but the outer zone area (which is the primary affordance at 12-padding) is dead for keyboard. Additionally, a mobile user tapping the full zone area (not the "Select PDF File" button specifically) gets no response because there is no `onClick` handler on the outer `div`.

**Fix:** Add `tabIndex={0}` and an `onClick` handler (or convert to `<button>`) that triggers the hidden `<input>` via ref:
```tsx
const inputRef = useRef<HTMLInputElement>(null);
// On the outer div: onClick={() => inputRef.current?.click()} tabIndex={0}
// On the <input>: ref={inputRef}
```
**Cost:** 1 SP

### [NEW] `share-modal.tsx` Bulk tab: "Send N invites" count badge updates correctly but the `Send to...` tab has no scroll guard on bulk recipient list overflow past `max-h-48` at >9 rows — `components/dashboard/share-modal.tsx:336`

**Issue:** The recipients list has `max-h-48 overflow-y-auto` — good. However at the tablet/mobile width (`sm:max-w-lg` → ~512 px) the two-column `<Input>` row (email + name) with a 36-px name column forces the name input to be only 36-`gap-2`-wide: `w-36` = 144 px, but on a 360 px mobile viewport the full row is >`100%` of the modal width, causing the trash icon to be clipped outside the visible area. No horizontal scroll is set on the outer container.

**Fix:** On mobile, collapse name field into a second row or add `min-w-0` to the email input. Simplest fix:
```tsx
// Add flex-col at xs, flex-row at sm:
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
```
**Cost:** 1 SP

---

## Well-Designed (no issues)

- **`upload-client.tsx` step machine** — `UploadStep` union type with 5 states (select/preview/payment/processing/complete), visual stepper with CheckCircle for completed steps, explicit Back button on payment. Clean wizard pattern. Error display on preview step is correct (lines 384-393).
- **`voice-chooser.tsx` modal** — `max-h-[80vh] overflow-hidden flex flex-col` + `flex-1 overflow-y-auto pr-2` on the grid: proper overflow chaining. Grid collapses to 2-col. Filter + search bar pinned at top. Correct scroll architecture.
- **`share-modal.tsx` Link tab** — progressive disclosure via "Options" chevron toggle hides access-level/expiry controls until needed. Single visible CTA ("Create Share Link"), post-creation state replaces the button with a read-only URL + copy. Clean state machine.
- **`billing/page.tsx`** — `toLocaleDateString('en-US', {...})` with explicit options (line 136). `past_due` warning banner (line 147). `subscriptionStatus` gates correctly. No free/pro inconsistencies visible.
- **`admin-sidebar.tsx`** — `Sheet` + `onClick={() => setOpen(false)}` wrapper on `SidebarContent` closes mobile drawer on any nav click. `aria-label="Open navigation menu"` on hamburger. No issues.
- **`ScriptImprovementWizard` error paths** — both `ScoreAnalysisStep` (line 150) and `SuggestionsStep` (line 231) display inline error banners with `AlertCircle`. Error is shown only in the "empty + not loading" branch of SuggestionsStep, meaning if suggestions loaded once and a subsequent re-generate fails, error is swallowed. Minor, not blocking.
- **`enterprise/dashboard/page.tsx` query limits** — `take: 20` on `activityLogs`, `take: 50` on members prevents unbounded DB fetches. The UX issue is scroll containment only, not data volume.

---

## Sprint Plan

| ID | SP | Title | File:Line | Priority |
|----|-----|-------|-----------|----------|
| UX-E-01 | 1 | [CARRYOVER] Gate dev log panel behind `NODE_ENV !== 'production'` | `app/projects/[id]/generate-button.tsx:409` | P0 |
| UX-E-02 | 1 | [NEW] Hide enterprise upsell banner for `studio` tier users | `app/dashboard/dashboard-tabs.tsx:260` | P1 |
| UX-E-03 | 1 | [NEW] Wizard suggestions: remove `.slice(0,5)` + raise max-h to 400 px | `components/wizard/ScriptImprovementWizard.tsx:287-288` | P1 |
| UX-E-04 | 1 | [NEW] Financial `toLocaleString()` → explicit `en-US` + currency options | `app/admin/page.tsx:102`, `app/admin/analytics/page.tsx:124`, `app/impact/partners/page.tsx:86,252` | P1 |
| UX-E-05 | 1 | [CARRYOVER] Invite page: sign-up CTA for signed-out users | `app/invite/[token]/page.tsx:278` | P2 |
| UX-E-06 | 1 | [CARRYOVER] Team settings: scroll containers on member + pending lists | `app/enterprise/team/page.tsx:251,290` | P2 |
| UX-E-07 | 0.5 | [CARRYOVER] Remove invite-accept `console.log` calls | `app/invite/[token]/page.tsx:92,101` | P2 |
| UX-E-08 | 1 | [NEW] Enterprise dashboard: scroll containers on activity feed + team list | `app/enterprise/dashboard/page.tsx:257,303` | P2 |
| UX-E-09 | 1 | [NEW] Audio-chooser: bump `h-8` icon buttons to `h-10` for touch targets | `app/projects/[id]/audio-chooser.tsx:270,285,297,648,660` | P2 |
| UX-E-10 | 1 | [NEW] Upload drop zone: add `onClick` + `tabIndex` for keyboard/touch activation | `components/reader/upload-client.tsx:288` | P2 |
| UX-E-11 | 1 | [NEW] Share modal bulk tab: flex-col row on mobile to prevent name input clipping | `components/dashboard/share-modal.tsx:338` | P2 |

**Total SP:** 9.5 — **P0:** 1 | **P1:** 3 | **P2:** 5.5

**Audit completed:** 2026-05-29
