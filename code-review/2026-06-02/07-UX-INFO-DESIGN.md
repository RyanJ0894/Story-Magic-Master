# UX/Information Design Audit — 2026-06-02

**Scope:** `packages/web/app/` and `packages/web/components/` — focused on the 35 files modified since 2026-05-29.
**Prior review:** `code-review/2026-05-29/07-UX-INFO-DESIGN.md` — 11 items (UX-E-01..11), 9.5 SP total.
**New findings today:** 5 new items (UX-F-01..05), 5 SP.

**Status of prior items since 2026-05-29:**
- UX-E-01 (dev log panel): **FIXED** — `generate-button.tsx` now gates behind `process.env.NODE_ENV !== 'production'`
- UX-E-04 (toLocaleString): **PARTIALLY FIXED** — `admin/page.tsx:102` and `admin/analytics/page.tsx:124` now use `'en-US'`; `impact/partners/page.tsx:86` also fixed. Remaining: `impact/partners/page.tsx:252` (still bare `.toLocaleString()`) and `admin/users/page.tsx:206` (new bare `.toLocaleDateString()` with no locale).
- UX-E-05 (invite sign-up CTA): **FIXED** — proactive `!isSignedIn` branch now renders before any POST attempt.
- UX-E-06 (team settings scroll): **FIXED** — new `(gated)/team/page.tsx` has `max-h-[360px]` + `max-h-[280px]` scroll containers.
- UX-E-07 (console.log calls): **FIXED** — no `console.log` found in `invite/[token]/page.tsx`.
- UX-E-02, UX-E-03, UX-E-08, UX-E-09, UX-E-10, UX-E-11: **Unchanged** (see Carryover section).

---

## P0 Findings

_(No new P0 findings in the changed files.)_

---

## P1 Findings

### [NEW] UX-F-01 — "Compare Scripts" button has no `onClick` handler — `app/projects/[id]/project-workflow.tsx:1148`

**Issue:** In the Share step of the Fine-Tuned workflow (the completed state), a `<Button variant="outline">` renders with the label "Compare Scripts" but has no `onClick` prop. Clicking it does nothing — no navigation, no dialog, no visual feedback. It is visually identical to the adjacent "Share with Team" button, so users will click it and assume the feature is broken. The `RunComparison` dialog (already imported and wired at line 522) exists and is functional for run-to-run comparison — but it is not connected here.

**Fix (minimal):** Add a disabled state with an accessible tooltip until #107 ships, or connect it to the existing `RunComparison` flow:
```tsx
// Option A — disable with tooltip until #107:
<Button variant="outline" disabled title="Multi-run comparison coming soon">
  <Play className="w-4 h-4 mr-2" />
  Compare Scripts
</Button>

// Option B — wire to handleCompareRuns (already defined) when 2+ runs exist:
{runs.length >= 2 && (
  <Button variant="outline" onClick={() => handleCompareRuns(runs[0].runNumber, runs[1].runNumber)}>
    ...
  </Button>
)}
```
Option A is the 1 SP fix. Option B is 2 SP but is already in scope for the sprint.

**Cost:** 1 SP

---

### [NEW] UX-F-02 — Enterprise project assignment `+/-` buttons at `h-7 w-7` (28 px) — below touch minimum — `components/enterprise/EnterpriseProjectAssignment.tsx:119,154`

**Issue:** The "Remove from team" (`Minus`) and "Add to team" (`Plus`) icon buttons in `EnterpriseProjectAssignment` use `h-7 w-7 p-0` — 28 px square. This is below the 44 px Apple/Google minimum touch target and also below the 32 px `h-8 w-8` that `audio-chooser.tsx` uses (already flagged as UX-E-09). These actions are the primary interaction on the Projects tab of the enterprise dashboard, and the entire tab is used on enterprise-tier accounts which are often accessed from company-issued tablets and mobile devices. The compact grid layout (`sm:grid-cols-2 lg:grid-cols-3`) makes individual row action buttons the only target.

**Fix:** Change both `h-7 w-7 p-0` to `h-9 w-9 p-0` (matching the share modal trash icon at line 351).

**Cost:** 1 SP (2-line change)

---

### [NEW] UX-F-03 — Enterprise activity feed (`take: 50`) renders unbounded in the new `(gated)/dashboard` — `app/enterprise/(gated)/dashboard/page.tsx:310`

**Issue:** The old `enterprise/dashboard/page.tsx` was replaced by `enterprise/(gated)/dashboard/page.tsx` but the UX-E-08 scroll container fix was never applied to the new file. The activity log query uses `take: 50` (line 110), and the render at line 310 is still a plain `<div className="space-y-3">` with no `max-h` or `overflow-y-auto`. At ~52 px per row, 50 items = 2,600 px inside the card on the Overview tab. The Team tab at line 356 also renders members in a plain `<div className="space-y-2">` with no scroll constraint. The old file has been deleted; this is the active route.

**Fix:**
```tsx
// Activity feed (line 310):
<div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">

// Team members list (line 356):
<div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
```
**Cost:** 1 SP

---

## P2 Findings (Polish)

### [NEW] UX-F-04 — `TeamNotesTab` renders all 20 initial comments in an unbounded list, `hasMore` button below the fold — `components/enterprise/TeamNotesTab.tsx:60`

**Issue:** `TeamNotesTab` receives up to `NOTES_PAGE_SIZE = 20` comments and renders them in a plain `<div className="space-y-1">` with no height constraint. At ~56 px per row, 20 rows = 1,120 px inside the Notes & Reactions tab card. The "Load more" button appears at the very bottom after all 20 rows scroll. On a 768 px viewport this pushes the button ~800 px below the fold — functionally invisible. Users with active teams will see a long, uncontrolled scroll and never reach the load-more trigger.

**Fix:** Wrap the comment list in a bounded, auto-scrolling container:
```tsx
<div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
  {comments.map(...)}
</div>
{hasMore && (
  <div className="pt-2 flex justify-center">
    <Button ...>Load more</Button>
  </div>
)}
```
**Cost:** 1 SP

---

### [NEW] UX-F-05 — `admin/users/page.tsx:206` — bare `.toLocaleDateString()` on join date column — `app/admin/users/page.tsx:206`

**Issue:** The "Joined" column in the admin users table renders `new Date(user.createdAt).toLocaleDateString()` with no locale argument. On a European-locale browser this formats the date with day/month/year order and dot separators, inconsistent with the explicit `'en-US'` locale used elsewhere in the same file (line 164 uses bare `toLocaleDateString()` as well, though that's a display date not the table column). Also, `impact/partners/page.tsx:252` still uses bare `.toLocaleString()` on `annualAmount` in the `<option>` label inside a `<select>` — this was flagged as UX-E-04 but missed in the partial fix.

**Fix:**
```tsx
// admin/users/page.tsx:206
{new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}

// impact/partners/page.tsx:252
${t.annualAmount.toLocaleString('en-US')}
```
**Cost:** 1 SP (both in same pass)

---

## Carryover (unchanged from 2026-05-29)

| ID | Title | File:Line | Status |
|----|-------|-----------|--------|
| UX-E-02 | Hide enterprise upsell banner for `studio` tier users | `app/dashboard/dashboard-tabs.tsx:261` | Open |
| UX-E-03 | Wizard: remove `.slice(0,5)`, raise `max-h` to 400 px | `components/wizard/ScriptImprovementWizard.tsx:287-288` | Open |
| UX-E-08 | Enterprise dashboard scroll containers (activity + team) | `app/enterprise/(gated)/dashboard/page.tsx:310,356` | Open — now in new file |
| UX-E-09 | Audio-chooser: bump `h-8` icon buttons to `h-10` for touch | `app/projects/[id]/audio-chooser.tsx:270,285,297,648,660` | Open |
| UX-E-10 | Upload drop zone: add `onClick` + `tabIndex={0}` | `components/reader/upload-client.tsx:244` | Open |
| UX-E-11 | Share modal bulk tab: `flex-col sm:flex-row` on recipient row | `components/dashboard/share-modal.tsx:336` | Open |

**Note on UX-E-08:** The prior finding referenced `app/enterprise/dashboard/page.tsx` which was deleted and replaced by `app/enterprise/(gated)/dashboard/page.tsx`. The fix is now re-logged as UX-F-03 above targeting the correct active path.

---

## Well-Designed (new since 2026-05-29)

- **`(gated)/team/page.tsx` scroll containers** — Active/pending member lists both wrapped in `max-h-[360px]` / `max-h-[280px]` scroll containers with `pr-1` for scrollbar gutter. Correct pattern.
- **`(gated)/layout.tsx` tier gate** — Clean server-side `subscriptionTier !== 'enterprise'` redirect to `/enterprise/upgrade`. No client-side flash, no role check duplication.
- **`invite/[token]/page.tsx` proactive sign-up CTA** — The `clerkLoaded && !isSignedIn && invite` branch renders "Create Account" as the primary CTA before any failed POST. Correct fix for UX-E-05.
- **`upload-client.tsx` dead-code removal** — The payment-bypass fallback and unreachable poll loop were removed, eliminating a confusing multi-path state machine that could land users in an impossible `processing` step.
- **`generate-button.tsx` dev log gate** — `process.env.NODE_ENV !== 'production'` correctly gates the log panel. The label "// Generation Log (dev mode)" is appropriately commented.

---

## Sprint Plan

| ID | SP | Title | File:Line | Priority |
|----|----|-------|-----------|----------|
| UX-F-01 | 1 | [NEW] Disable "Compare Scripts" button (no-op CTA) until wired | `app/projects/[id]/project-workflow.tsx:1148` | P1 |
| UX-F-02 | 1 | [NEW] Enterprise project assignment: bump `h-7 w-7` buttons to `h-9 w-9` | `components/enterprise/EnterpriseProjectAssignment.tsx:119,154` | P1 |
| UX-F-03 | 1 | [NEW] Enterprise (gated) dashboard: scroll containers on activity + team lists | `app/enterprise/(gated)/dashboard/page.tsx:310,356` | P1 |
| UX-F-04 | 1 | [NEW] TeamNotesTab: bound comment list height, surface Load More button | `components/enterprise/TeamNotesTab.tsx:60` | P2 |
| UX-F-05 | 1 | [NEW] `toLocaleDateString()`/`toLocaleString()` without locale — admin users + impact partners | `app/admin/users/page.tsx:206`, `app/impact/partners/page.tsx:252` | P2 |
| UX-E-02 | 1 | [CARRYOVER] Hide enterprise upsell for `studio` tier | `app/dashboard/dashboard-tabs.tsx:261` | P1 |
| UX-E-03 | 1 | [CARRYOVER] Wizard: remove `.slice(0,5)` + raise `max-h` to 400 px | `components/wizard/ScriptImprovementWizard.tsx:287-288` | P1 |
| UX-E-08 | 1 | [CARRYOVER → UX-F-03] See UX-F-03 above — now targeting new file | — | Merged |
| UX-E-09 | 1 | [CARRYOVER] Audio-chooser: `h-8` → `h-10` icon buttons | `app/projects/[id]/audio-chooser.tsx:270,285,297,648,660` | P2 |
| UX-E-10 | 1 | [CARRYOVER] Upload drop zone: `onClick` + `tabIndex={0}` | `components/reader/upload-client.tsx:244` | P2 |
| UX-E-11 | 1 | [CARRYOVER] Share modal bulk tab: `flex-col sm:flex-row` recipient row | `components/dashboard/share-modal.tsx:336` | P2 |

**New SP this cycle:** 5 — **P0:** 0 | **P1:** 3 | **P2:** 2
**Total open SP (new + carryover):** 10 — **P0:** 0 | **P1:** 5 | **P2:** 5

**Audit completed:** 2026-06-02
