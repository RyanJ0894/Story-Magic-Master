# UX/Information Design Audit — 2026-05-26

**Scope:** Sprint v3.1 new files + carryover resolution check from 2026-05-19  
**New files audited:** `app/projects/[id]/shares/page.tsx`, `components/dashboard/share-modal.tsx` (bulk tab), `app/s/[code]/page.tsx`  
**Modified/checked:** `ScreenplayPlayer.tsx`, `NotesPanel.tsx`, `audio-chooser.tsx`, `enterprise/dashboard/page.tsx`, `enterprise/team/page.tsx`, `project-workflow.tsx`, `screenplay-reader.tsx`, `protected-player.tsx`  
**Prior review:** `code-review/2026-05-19/07-UX-INFO-DESIGN.md`

---

## Executive Summary

Sprint v3.1 delivered bulk share, share dashboard, and play analytics — a solid feature set. **5 previously-reported P0s from the 2026-05-19 audit are now fully resolved** (ScreenplayPlayer touch annotations, note-save errors, NotesPanel errors, AudioChooser collapse, CommentsSidebar error state). However, **3 new issues** were introduced by the Sprint v3.1 code, and **3 lower-priority items remain unresolved** from prior reviews.

Key risk areas in the new code:
1. **Share dashboard fetch failure** renders a blank white page — no error state, no retry
2. **"Deactivate All" has no confirmation** — irreversible, silently revokes all recipient access
3. **ProtectedPlayer on the public `/s/[code]` page** still has no touch-seek — affects iPad/phone readers who are the primary sharing target

---

## P0 Findings

### [NEW] Share dashboard renders blank on fetch failure — `packages/web/app/projects/[id]/shares/page.tsx:137-150, 213`

**Issue:**  
`fetchData()` calls the API and on non-ok response fires a toast then `return`s early, leaving `data === null`. Line 213: `if (!data) return null` renders nothing — not a spinner, not an error message. After the toast auto-dismisses the user sees a completely blank page with no way to retry. There is also no error state persisted so a subsequent `fetchData()` call from a refresh would be the only recovery, but no retry button exists.

This is the same silent-failure pattern documented in every prior audit cycle (CommentsSidebar, NotesPanel); it has now appeared in a new page.

**Fix:**
```tsx
// Add error state alongside loading:
const [fetchError, setFetchError] = useState<string | null>(null);

const fetchData = useCallback(async () => {
  setLoading(true);
  setFetchError(null);
  try {
    const res = await apiFetch(`/api/projects/${projectId}/shares`);
    if (!res.ok) {
      setFetchError('Failed to load shares. Tap to retry.');
      return;
    }
    const json = await res.json();
    setData(json);
  } catch {
    setFetchError('Connection error. Tap to retry.');
  } finally {
    setLoading(false);
  }
}, [projectId]);

// Replace `if (!data) return null;` (line 213) with:
if (fetchError) {
  return (
    <div className="flex items-center justify-center py-20 flex-col gap-4">
      <AlertCircle className="w-8 h-8 text-destructive" />
      <p className="text-muted-foreground">{fetchError}</p>
      <Button variant="outline" size="sm" onClick={() => void fetchData()}>Retry</Button>
    </div>
  );
}
if (!data) return null; // only after loading + no error
```

**Cost:** 1 SP  
**Severity:** P0 — blank page after API failure; no escape path for user

---

### [NEW] "Deactivate All" has no confirmation — irreversible — `packages/web/app/projects/[id]/shares/page.tsx:175-193, 249`

**Issue:**  
Clicking "Deactivate All" (line 249) immediately calls `deactivateAll()` which calls `PATCH /api/projects/${projectId}/shares { action: 'deactivate_all' }`. This instantly revokes access for every recipient of this project — potentially 20+ people who were actively sent links via the bulk share feature. There is no confirmation dialog, no undo, and no indication in the UI of how many recipients will be affected before the action fires.

Additionally, individual `deactivateShare()` (line 156) has no confirmation either. Deactivating a named recipient's unique link is a less severe but still user-impacting action.

**Fix:**
```tsx
// deactivateAll — add confirmation with count:
async function deactivateAll() {
  const count = activeShares.length;
  if (!window.confirm(
    `Deactivate all ${count} active share${count === 1 ? '' : 's'}? All recipients will immediately lose access.`
  )) return;
  setDeactivatingAll(true);
  // ...rest unchanged
}

// deactivateShare — add per-row confirmation:
async function deactivateShare(shareId: string) {
  const share = data?.shares.find(s => s.id === shareId);
  const recipient = share?.recipientName || share?.recipientEmail || 'this recipient';
  if (!window.confirm(`Deactivate share for ${recipient}? They will lose access immediately.`)) return;
  setDeactivatingId(shareId);
  // ...rest unchanged
}
```

**Cost:** 1 SP  
**Severity:** P0 — "Deactivate All" is a bulk-revoke of recipient access; enterprise users sending to 10-20 agents/readers could trigger this by accident

---

## P1 Findings

### [CARRYOVER] ProtectedPlayer on public share page has no touch seek — `packages/web/components/player/protected-player.tsx:161-181`

**Issue:**  
`handleProgressMouseDown` (lines 161–181) provides drag-to-seek via `mousemove`/`mouseup` but there is no `onTouchStart`/`onTouchMove`/`onTouchEnd`. The `handleProgressKeyDown` keyboard handler (lines 183–207) is good for desktop. But the public `/s/[code]` page — the landing page for *all* external recipients (agents, producers, readers) — is heavily used on iPhone and iPad. These users cannot seek in the audio at all.

Note: `screenplay-reader.tsx` (the internal `/listen` page) had this fixed in the 2026-05-19 audit cycle. `ProtectedPlayer` was not updated at the same time.

**Fix:**
```tsx
// After handleProgressMouseDown (line 181), add:
const handleProgressTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
  if (!progressRef.current) return;
  const touch = e.touches[0];
  const rect = progressRef.current.getBoundingClientRect();
  seekToPercent((touch.clientX - rect.left) / rect.width);

  const onMove = (ev: TouchEvent) => {
    if (!progressRef.current) return;
    const t = ev.touches[0];
    const r = progressRef.current.getBoundingClientRect();
    seekToPercent((t.clientX - r.left) / r.width);
  };
  const onEnd = () => {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  };
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd);
}, [seekToPercent]);

// On the progress bar div (around line 421), add:
onTouchStart={handleProgressTouchStart}
```

**Cost:** 1 SP  
**Severity:** P1 — all mobile/tablet recipients of shared links cannot seek; affects primary external audience

---

### [NEW] Bulk share tab: recipient list has no scroll container — overflows viewport at 20 rows — `packages/web/components/dashboard/share-modal.tsx:315-408`

**Issue:**  
`<TabsContent value="bulk">` renders a flat `space-y-4` stack with no `max-h` or `overflow-y-auto` wrapper. At 20 recipients (the maximum allowed), each row is ~40px tall, giving ~800px of recipient inputs alone. Add the message textarea (~100px), expiry select (~80px), Send button (~48px), and description text — the tab body exceeds 1100px on mobile. The `DialogContent` has `sm:max-w-lg` but no max-height constraint. On a 667px-tall viewport (iPhone SE), the bottom half of the form including the Send button is unreachable without closing and reopening.

**Fix:**
```tsx
// Wrap the recipients list section in a scrollable container:
<div className="space-y-2">
  <Label>Recipients</Label>
  <div className="max-h-[240px] overflow-y-auto space-y-2 pr-1">
    {bulkRecipients.map((r, idx) => (
      // ...row unchanged
    ))}
  </div>
  {bulkRecipients.length < 20 && (
    <Button ...>Add recipient</Button>
  )}
</div>
```

**Cost:** 1 SP  
**Severity:** P1 — Send button unreachable on mobile at 8+ recipients; the primary use case for bulk share

---

### [NEW] Bulk share tab: no inline email format validation — silent server rejection — `packages/web/components/dashboard/share-modal.tsx:136-140`

**Issue:**  
`handleBulkShare` (line 136) pre-filters recipients to `filter(r => r.email.trim())` — this catches empty rows but accepts `notanemail` or `test@` as valid. The backend's Zod schema (`z.string().email()`) will reject these and return a 400, but the UI shows only the generic toast "Failed to send invites" with no indication of which row is invalid. The user must inspect all rows manually.

**Fix (minimal, 1 SP):**
```tsx
// In handleBulkShare, before the API call:
const invalid = valid.filter(r => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim()));
if (invalid.length > 0) {
  toast({
    variant: 'destructive',
    title: 'Invalid email addresses',
    description: `Fix: ${invalid.map(r => r.email).join(', ')}`,
  });
  return;
}
```

**Cost:** 1 SP  
**Severity:** P1 — users lose their bulk send attempt with no actionable error when a single bad address slips in

---

## P2 Findings (Polish)

### [NEW] Share dashboard: `GET /api/projects/[id]/shares` fetches all rows with no limit — `packages/web/app/api/projects/[id]/shares/route.ts:41-57`

**Issue:**  
`prisma.scriptShare.findMany({ where: { projectId } })` has no `take:` limit. A power user who bulk-sends to 20 people per project and shares to 5 different cohorts will accumulate 100+ rows. The table renders all rows. At 100 rows × 6 columns × ~8 DOM elements per cell, the table contains ~5,000 DOM nodes. The page has no pagination or virtualization.

For now, the practical cap is 20 per bulk send × typical usage, so real-world impact is low. But the pattern should be addressed before enterprise rollout where a single project might be shared hundreds of times.

**Fix (minimal):**
```ts
// In GET handler (route.ts:41):
const shares = await prisma.scriptShare.findMany({
  where: { projectId },
  orderBy: { createdAt: 'desc' },
  take: 100,            // ADD — hard cap prevents runaway queries
  select: { ... },
});
// Add a note in the response if truncated:
// if (shares.length === 100) add a `truncated: true` flag
```

**Cost:** 1 SP  
**Severity:** P2 — no immediate risk at current scale; add cap now before enterprise rollout

---

### [NEW] `writerCode` prop declared but never used in ShareModal — `packages/web/components/dashboard/share-modal.tsx:47, 61`

**Issue:**  
`writerCode: string` appears in `ShareModalProps` (line 47) and is destructured (line 61) but is not referenced anywhere in the component body. The QR code tab that previously used it was removed. This creates a confusing prop contract for callers — they must pass `writerCode` but it has no effect.

**Fix:**
```tsx
// Remove from interface (line 47):
// writerCode: string;   ← DELETE

// Remove from destructure (line 61):
// writerCode,           ← DELETE
```

Also remove from all call sites (search `writerCode=`).

**Cost:** 0.5 SP  
**Severity:** P2 — dead code; misleads future maintainers

---

### [CARRYOVER] ShareModal QR tab — confirmed removed (RESOLVED)

**Status:** RESOLVED. The QR tab is no longer present in `share-modal.tsx`. The modal now renders only "Link" and "Send to..." tabs. Prior P2 UX-M-14 is closed.

---

## Resolved Carryover Status from 2026-05-19

| Prior ID | Title | Status |
|---|---|---|
| UX-M-01 | ScreenplayPlayer: touch/focus annotations | ✅ FIXED — `tabIndex={0}`, `onFocus`, `onBlur` all added |
| UX-M-02 | ScreenplayPlayer: note-save error + reopen popover | ✅ FIXED — catch block with `toast.error` + reopen on failure |
| UX-M-03 | NotesPanel: delete confirmation + error toast | ✅ FIXED — `window.confirm` guard + error toasts in catch |
| UX-M-04 | NotesPanel: error state + retry on fetch failure | ✅ FIXED — `error` state + retry button rendered |
| UX-M-05 | Enterprise dashboard: paginate Notes tab | ✅ FIXED — `take: NOTES_PAGE_SIZE (20)` + `totalTeamComments` count |
| UX-M-06 | ScreenplayReader: touch-seek progress bar | ✅ FIXED — `handleProgressTouchStart` + `onTouchStart` on progress div |
| UX-M-07 | project-workflow: confirm before team share | ✅ FIXED — `window.confirm(\`Share "${name}" with team "${team.name}"?\`)` |
| UX-M-08 | enterprise/team: confirm before remove member | ✅ FIXED — confirm at call site with member name |
| UX-M-09 | ScreenplayPlayer+NotesPanel: responsive collapse | ✅ FIXED — commit `3e3d2d0`; `sm:h-full max-h-52 sm:max-h-none` |
| UX-M-10 | NotePopover: Escape to dismiss | ✅ FIXED — `onKeyDown` on container div |
| UX-M-11 | Enterprise dashboard: replace hardcoded "50+" stat | ✅ FIXED — `totalDecisions` from `prisma.projectComment.count` |
| UX-M-12 | ScreenplayPlayer reactions: debounce + loading state | ✅ FIXED — `reactionSaving` state; early return if `=== sceneIndex` |
| UX-M-13 | AdvancedAnalysisUpgrade: add dismissal memory | ✅ FIXED — `localStorage.getItem(adv-analysis-dismissed-${projectId})` |
| UX-M-14 | ShareModal QR tab: hide or implement | ✅ FIXED — QR tab removed entirely |
| UX-M-15 | AudioChooser: collapse scenes by default | ✅ FIXED — `useState<Set<number>>(new Set())` + expand/collapse all toggle |
| UX-M-16 | CommentsSidebar: error state + retry | ✅ FIXED — `fetchError` state + retry button + `deleteError` inline message |

**All 16 prior findings resolved.** Sprint N/O/v3.1 completed a comprehensive sweep.

---

## Sprint Plan

| ID | SP | Title | File:Line | Priority | Type |
|----|-----|-------|-----------|----------|------|
| UX-S-01 | 1 | [NEW] Share dashboard: add error state + retry on fetch failure | `shares/page.tsx:137` | P0 | Error handling |
| UX-S-02 | 1 | [NEW] Share dashboard: confirm before deactivateAll + deactivateShare | `shares/page.tsx:156,175` | P0 | Safety |
| UX-S-03 | 1 | [CARRYOVER] ProtectedPlayer: add touch-seek to progress bar | `protected-player.tsx:161` | P1 | Mobile |
| UX-S-04 | 1 | [NEW] Bulk share tab: wrap recipient list in scrollable container | `share-modal.tsx:323` | P1 | Mobile layout |
| UX-S-05 | 1 | [NEW] Bulk share tab: inline email format validation before POST | `share-modal.tsx:136` | P1 | Validation |
| UX-S-06 | 1 | [NEW] Share dashboard API: add `take: 100` cap | `api/projects/[id]/shares/route.ts:41` | P2 | Scale |
| UX-S-07 | 1 | [NEW] ShareModal: remove unused `writerCode` prop | `share-modal.tsx:47` | P2 | Dead code |

**Total SP:** 7  
**P0:** 2 SP | **P1:** 3 SP | **P2:** 2 SP

---

## What Is Well-Designed in the New Code (No Issues Found)

- **Share dashboard layout** — breadcrumb + summary cards + responsive table is clean information hierarchy; `opacity-50` on deactivated rows is a good visual hint without removing the data
- **Status badge system** (`statusBadge()` helper) — 4 states (Listened / Opened / Not opened / Deactivated) with appropriate color coding and icons; uses relative dates cleanly
- **`relativeDate()` helper** — handles null, Today, Yesterday, N days, and fallback to `toLocaleDateString()` correctly
- **Bulk share success toast** — `${summary.emailsSent} of ${summary.total} emails sent` is the right granularity; partial success is communicated correctly
- **`s/[code]` page state machine** — 4 clean states (loading → error | password-required | player) with proper transitions and no intermediate blank state **except** for the initial `null` fallback at line 382 which only occurs if all state branches fail (acceptable edge case)
- **`s/[code]` password form** — autoFocus, Escape works via browser default, inline error below field on bad password, loading spinner on submit — all correct
- **ProtectedPlayer keyboard seek** — `ArrowLeft`/`ArrowRight` ±2%, `Home`/`End` — complete keyboard seek affordance; only touch is missing
- **Bulk share `{name}` interpolation hint** — `<code>` element with muted background for the template variable is clear and legible

---

## Patterns to Enforce Going Forward

1. **Every fetch in a page component needs an error state with retry** — this is the third page after CommentsSidebar and (pre-fix) NotesPanel to omit it. The fix is always the same 5-line pattern; it should be a required code-review checklist item.
2. **Any bulk-revoke action needs a confirmation that states the count and consequence** — "Deactivate All" is semantically equivalent to "remove member"; the same `window.confirm()` rule applied in the team page must apply here.
3. **Touch seek must be added whenever mouse drag-to-seek is added** — treat them as a pair. The pattern from `screenplay-reader.tsx` is the approved implementation.

---

**Audit completed:** 2026-05-26  
**Next review:** After UX-S-01 through UX-S-05 are addressed
