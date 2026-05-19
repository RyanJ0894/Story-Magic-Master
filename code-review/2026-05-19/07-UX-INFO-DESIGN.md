# UX/Information Design Audit — 2026-05-19

**Scope:** Sprint K, L, M new components + carryover from 2026-05-07  
**Components audited:** ScreenplayPlayer, NotesPanel, ScreenplayReader (listen page), AudioPlayer (progressive),  
enterprise/dashboard, enterprise/team, project-workflow.tsx (Sprint M additions), AdvancedAnalysisUpgrade,  
AdvancedAnalysisSuccessBanner, ShareModal, MobileNav, upload-screenplay  
**Prior review:** `code-review/2026-05-07/07-UX-INFO-DESIGN.md`

---

## Executive Summary

Sprints K/L/M delivered substantial new UI surface. The progressive playback queue player and ScreenplayPlayer  
annotation system are well-designed. However, **5 new P0/P1 issues** were found alongside **4 carryover issues  
still unresolved** from the prior audit.

Key risk areas:
1. **ScreenplayPlayer (Sprint M)** — hover-only annotation is inaccessible on mobile/touch; note-save failure is silent
2. **NotesPanel (Sprint M)** — delete has no confirmation; fetch failure leaves panel blank with no error
3. **Enterprise dashboard Notes tab** — 200 comments loaded unbounded with no pagination
4. **ScreenplayReader `/listen`** — progress bar is mouse-drag-only (no touch/keyboard seek on mobile)
5. **project-workflow.tsx "Share with Team"** — silently picks first team with no user choice

---

## P0 Findings

### [NEW] ScreenplayPlayer note actions are hover-only — inaccessible on mobile/touch — `packages/web/components/project/ScreenplayPlayer.tsx:355`

**Issue:**  
The `+` (add note) button and the three reaction buttons (Like / Pass / ?) are only shown when `isHovered === true`  
(line 355: `{isHovered && <div className="absolute right-0 ...">}`).  
`isHovered` is driven by `onMouseEnter`/`onMouseLeave` (lines 321–322). On touch devices there is no hover  
event — the entire annotation system is invisible and unreachable on iPhone/Android.  
The enterprise use case (readers reviewing scripts on iPads at agency screenings) is the primary production  
workflow; this blocks every mobile reader from adding notes or reactions.

**Fix:**  
Change the show condition from hover-only to hover-or-focus-within, and add touch activation:
```tsx
// Replace line 310-319 (div wrapper):
<div
  key={i}
  className={cn('relative group', { ... })}
  onMouseEnter={() => setHoverBlockIndex(i)}
  onMouseLeave={() => setHoverBlockIndex(null)}
  onFocus={() => setHoverBlockIndex(i)}        // ADD
  onBlur={(e) => {                              // ADD
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setHoverBlockIndex(null);
  }}
>

// Replace line 355 condition:
// FROM:
{isHovered && (
// TO:
{(isHovered || openNoteBlockIndex === i) && (
```

Additionally, make the block itself tabbable so keyboard users can reach it:
```tsx
// Add tabIndex={0} to the outer div (line 308)
<div key={i} tabIndex={0} className={cn('relative group focus:outline-none', { ... })} ...>
```

**Cost:** 2 SP  
**Severity:** P0 — blocks all mobile/touch users from the Sprint M annotation feature

---

### [NEW] ScreenplayPlayer note-save failure is completely silent — `packages/web/components/project/ScreenplayPlayer.tsx:247-264`

**Issue:**  
`saveNote()` (lines 247–264) calls the API and on success appends the comment. But the `try` block has no  
error handler — the `finally` block only clears `submitting`. If the POST fails (network error, 401, 500),  
the popover has already been closed (line 250: `setOpenNoteBlockIndex(null)`) and no error message is shown.  
The user loses their note with no indication of failure.

`saveReaction()` (lines 267–286) has the same issue — the catch block on line 285 is `/* non-fatal */` with  
no user feedback.

**Fix:**
```tsx
// saveNote — add error handling in catch (currently no catch at all):
async function saveNote(blockIndex: number, sceneIndex: number, text: string) {
  if (submitting) return;
  setSubmitting(true);
  setOpenNoteBlockIndex(null);
  try {
    const res = await fetch(`/api/projects/${projectId}/comments`, { ... });
    if (res.ok) {
      const json = await res.json() as { comment: NoteComment };
      setComments((prev) => [...prev, json.comment]);
      onCommentAdded?.(json.comment);
    } else {
      // Reopen popover with text preserved so user can retry
      setOpenNoteBlockIndex(blockIndex);
      // toast or inline error (import toast from 'sonner'):
      toast.error('Failed to save note. Please try again.');
    }
  } catch {
    setOpenNoteBlockIndex(blockIndex);
    toast.error('Network error — note not saved.');
  } finally {
    setSubmitting(false);
  }
}
```

**Cost:** 2 SP  
**Severity:** P0 — silent data loss on a core Sprint M annotation feature

---

### [NEW] NotesPanel delete has no confirmation and silent failure — `packages/web/components/project/NotesPanel.tsx:78-86`

**Issue:**  
`deleteComment()` (lines 78–86) immediately calls DELETE with no confirmation dialog. On failure, `setDeletingId(null)`  
is called but no error is shown — the item remains in the list but the user doesn't know the delete failed.  
Additionally, the component does not do optimistic removal (unlike CommentsSidebar, which had the opposite  
problem — premature removal). Here, the note stays visible after a successful delete until the user confirms  
via the `if (res.ok)` branch, which is correct; but a failed DELETE shows no feedback.

**Fix:**
```tsx
async function deleteComment(id: string) {
  if (!window.confirm('Delete this note?')) return;   // confirmation guard
  setDeletingId(id);
  try {
    const res = await fetch(`/api/projects/${projectId}/comments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    } else {
      toast.error('Failed to delete note. Please try again.');
    }
  } catch {
    toast.error('Network error — note not deleted.');
  } finally {
    setDeletingId(null);
  }
}
```
(Requires `import { toast } from 'sonner'` — already used in adjacent files.)

**Cost:** 1 SP  
**Severity:** P0 — accidental delete risk on primary Sprint M feature; no feedback on failure

---

## P1 Findings

### [NEW] NotesPanel fetch failure leaves panel blank — no error state — `packages/web/components/project/NotesPanel.tsx:48-59`

**Issue:**  
`load()` (lines 48–59) calls the comments API but only sets comments on `res.ok`. The `finally` clears  
`loading`, but there is no `error` state. If the fetch fails, the panel shows the empty-state hint  
"Hover over any line to add a note or reaction." — exactly what appears when there are genuinely no notes.  
The user cannot distinguish a fetch failure from an empty project.

This is the **same pattern as the P0 CommentsSidebar issue** identified in the 2026-05-07 audit that was  
never fixed.

**Fix:**
```tsx
const [error, setError] = useState<string | null>(null);

const load = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch(`/api/projects/${projectId}/comments`);
    if (res.ok) {
      const json = await res.json() as { comments: NoteComment[] };
      setComments(json.comments);
    } else {
      setError('Could not load notes. Tap to retry.');
    }
  } catch {
    setError('Connection error. Tap to retry.');
  } finally {
    setLoading(false);
  }
}, [projectId]);

// In render, replace the empty-state p (line 111):
{!loading && error && (
  <button
    onClick={() => void load()}
    className="text-xs text-destructive text-center px-4 py-8 w-full hover:underline"
  >
    {error}
  </button>
)}
{!loading && !error && comments.length === 0 && (
  <p className="text-xs text-muted-foreground text-center px-4 py-8">
    Hover over any line to add a note or reaction.
  </p>
)}
```

**Cost:** 2 SP  
**Severity:** P1 — silent failure; repeated pattern from prior audit

---

### [NEW] Enterprise dashboard Notes tab fetches up to 200 comments with no pagination — `packages/web/app/enterprise/dashboard/page.tsx:109-118`

**Issue:**  
Line 109–118: `prisma.projectComment.findMany({ take: 200 })`. For an active enterprise team with 20+ projects  
and 10+ readers each, 200 comments is easily exceeded. The tab renders all 200 items in a flat list with  
`space-y-1` — no virtualization, no pagination, no "load more". At 200 items the DOM will contain 200 comment  
blocks (each with flex, icon, multiple `<p>` and `<span>`) causing layout jank.

Additionally, there is no way to filter comments by project, date range, or reader — the list is unsorted  
except by `createdAt desc`, making it impossible to triage quickly.

**Fix (minimal, 2 SP):**  
- Add pagination: `take: 20` + a "Load more" button that fetches the next page via a client component
- Or add project filter: `const [filterProject, setFilterProject] = useState<string | null>(null)` with a  
  `<Select>` above the list

**Fix (full, 4 SP):**  
Convert the Notes tab content into a client component that paginates and filters by project.

**Cost:** 2 SP (pagination) / 4 SP (filter + pagination)  
**Severity:** P1 — performance and usability on medium-size enterprise teams

---

### [NEW] ScreenplayReader progress bar is mouse-only — not touch-seekable on mobile — `packages/web/components/player/screenplay-reader.tsx:245-263`

**Issue:**  
`handleProgressMouseDown` (lines 245–263) wires up `mousemove`/`mouseup` listeners on `document` for  
drag-to-seek. There is no `onTouchStart`/`onTouchMove`/`onTouchEnd` equivalent. On mobile browsers,  
the progress bar is visually present but produces no seek behavior when tapped or swiped.  
This affects every reader on a phone or tablet using the `/listen` page.

**Fix:**
```tsx
const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
  if (!progressRef.current) return;
  const touch = e.touches[0];
  const rect = progressRef.current.getBoundingClientRect();
  seekTo((touch.clientX - rect.left) / rect.width);

  const onMove = (ev: TouchEvent) => {
    if (!progressRef.current) return;
    const t = ev.touches[0];
    const r = progressRef.current.getBoundingClientRect();
    seekTo((t.clientX - r.left) / r.width);
  };
  const onEnd = () => {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  };
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd);
};

// Add to the progress bar div (line 681):
onTouchStart={handleProgressTouchStart}
```

**Cost:** 1 SP  
**Severity:** P1 — enterprise readers (primary audience) review on iPads; seek is broken for them

---

### [NEW] "Share with Team" silently picks first team with no user confirmation — `packages/web/app/projects/[id]/project-workflow.tsx:1069-1105`

**Issue:**  
Lines 1069–1105: clicking "Share with Team" fetches `/api/teams`, takes `teams[0]` (the first team), and  
immediately shares the project with that team. There is no:
- Team picker (user may own multiple teams)
- Confirmation dialog ("Share 'Script Title' with 'Acme Films'?")
- Visual indicator that the project is now shared (no badge update, no navigation to the enterprise dashboard)

The toast on success (line 1093) says `"Shared with team!"` but doesn't name the team. If the user owns  
multiple teams and the wrong one is picked silently, there is no indication of the error.

**Fix:**  
At minimum, show a confirmation with the team name before sharing. Longer term, add a team picker:
```tsx
// Before fetch teams, show confirmation:
const teams = data.teams || [];
if (teams.length === 0) { toast.info('...'); return; }

const team = teams[0];
const confirmed = window.confirm(
  `Share "${project.name}" with team "${team.name}"?`
);
if (!confirmed) return;
// ...proceed with share
```

**Cost:** 1 SP (confirmation) / 3 SP (team picker modal)  
**Severity:** P1 — enterprise users sharing to wrong team causes data exposure concern

---

### [NEW] Enterprise team page — remove member has no confirmation — `packages/web/app/enterprise/team/page.tsx:110-124`

**Issue:**  
`removeMember()` (lines 110–124) calls DELETE immediately when the trash icon is clicked. No confirmation  
dialog. Removing a member from a team is a significant action (revokes their access to all shared scripts).  
The `toast.success('Member removed')` fires after the fact.

**Fix:**
```tsx
const removeMember = async (memberId: string, memberName: string) => {
  if (!selectedTeam) return;
  if (!window.confirm(`Remove ${memberName} from this team? They will lose access to all shared scripts.`)) return;
  // ...rest of existing code
```

**Cost:** 1 SP  
**Severity:** P1 — accidental team member removal is hard to undo (requires re-invite)

---

## P2 Findings (Polish)

### [NEW] ScreenplayPlayer/NotesPanel layout is fixed 280px — collapses poorly below 768px — `packages/web/app/projects/[id]/project-workflow.tsx:600-615, 1111-1128`

**Issue:**  
Both the automatic-mode and fine-tuned share-step render the ScreenplayPlayer+NotesPanel split layout with  
`className="grid grid-cols-[1fr_280px] ... h-[560px]"`. At viewport width below ~768px, the 280px notes column  
takes more than half the screen, leaving the screenplay area too narrow to read (~200px). On phones, this is  
unreadable. There is no responsive breakpoint to collapse the NotesPanel to a bottom sheet or tabs pattern.

**Fix:**
```tsx
// Replace grid className:
'grid grid-cols-1 sm:grid-cols-[1fr_280px] ... min-h-[400px] sm:h-[560px]'

// Make NotesPanel collapsible below sm:
<div className="sm:hidden flex items-center gap-2 px-4 py-2 border-t border-border">
  <button onClick={() => setNotesOpen(v => !v)}>
    <MessageSquare className="w-4 h-4" /> Notes ({comments.length})
  </button>
</div>
<div className={cn('sm:flex', notesOpen ? 'flex' : 'hidden')}>
  <NotesPanel ... />
</div>
```

**Cost:** 2 SP  
**Severity:** P2 — mobile layout broken for screenplay annotation on small screens

---

### [NEW] NotePopover has no keyboard dismiss (Escape key) — `packages/web/components/project/ScreenplayPlayer.tsx:170-198`

**Issue:**  
The `NotePopover` component (lines 170–198) renders inline. The Cancel button exists (line 185), but  
pressing Escape does not close the popover. Standard web UX convention is Escape to dismiss any inline  
floating element. The `<textarea>` has `autoFocus` so Escape is the natural dismiss gesture.

**Fix:**
```tsx
// In NotePopover, add onKeyDown to the container div:
<div
  className="absolute ..."
  onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
>
```

**Cost:** 1 SP  
**Severity:** P2 — minor friction; violates web keyboard navigation convention

---

### [NEW] Enterprise dashboard stat card 3 shows hardcoded "50+" — not meaningful — `packages/web/app/enterprise/dashboard/page.tsx:203-212`

**Issue:**  
The third stat card (lines 203–212) shows the hardcoded string `"50+"` as "Voice Library / Standard voices".  
This is not a dynamic metric — it is marketing copy masquerading as a dashboard stat. Users expecting  
actionable metrics (e.g., "Scripts read this month", "Pending decisions") are confused by a static count  
that doesn't change.

**Fix:**  
Replace with a real metric from the data already loaded:
```tsx
// Replace the hardcoded card with:
const totalDecisions = projectDecisions.reduce((a, d) => a + d.liked + d.passed + d.undecided, 0);
// Card content:
<p className="text-2xl font-bold">{totalDecisions}</p>
<p className="text-xs text-muted-foreground">Reader Decisions</p>
<p className="text-xs text-muted-foreground">across {projectCount} projects</p>
```

**Cost:** 1 SP  
**Severity:** P2 — credibility issue; enterprise dashboards should show real metrics

---

### [NEW] ScreenplayPlayer reaction buttons have no loading state during POST — `packages/web/components/project/ScreenplayPlayer.tsx:267-286`

**Issue:**  
`saveReaction()` (lines 267–286) fires and immediately updates local state but there is no visual  
indicator the POST is in-flight. If the server responds in 500ms, the reaction button state appears  
to "flicker" — active immediately (optimistic), then re-confirmed. If the request fails silently  
(catch block is `/* non-fatal */`), the active state persists incorrectly.

The component has no `reactionSaving` state. Because reactions can bounce quickly (user toggles Like/Pass),  
rapid clicks can issue multiple concurrent POSTs, creating a race condition in the `setComments` deduplication  
at lines 277–284.

**Fix:**
```tsx
const [reactionSaving, setReactionSaving] = useState<number | null>(null); // sceneIndex

async function saveReaction(sceneIndex: number, reactionType: string) {
  if (reactionSaving === sceneIndex) return; // debounce concurrent clicks
  setReactionSaving(sceneIndex);
  try { ... } finally { setReactionSaving(null); }
}

// In ReactionButton props, pass disabled={reactionSaving === block.sceneIndex}
```

**Cost:** 1 SP  
**Severity:** P2 — race condition + no loading state feedback

---

### [CARRYOVER] AdvancedAnalysisUpgrade benefit copy still lacks specificity — `packages/web/components/project/AdvancedAnalysisUpgrade.tsx:87-94`

**Issue:**  
The three bullet points now include meaningful content ("Richer character arcs", "Nuanced voice matching",  
"Scene-level emotion") — this is **improved from the prior audit**. However, the card appears on every  
project page even for users who have already consumed multiple free StoryScore runs. There is no experiment  
or progressive disclosure — a power user who has run 5 scorings still sees the full purple upgrade card on  
every page load. Consider dismissing/minimizing after the user has seen it N times.

**Fix (minimal):** Add a `dismissed` state in `localStorage`:
```tsx
const [dismissed, setDismissed] = useState(() =>
  typeof window !== 'undefined' && localStorage.getItem(`adv-analysis-dismissed-${projectId}`) === '1'
);
if (dismissed || initialPurchased) return null; // or show the purchased badge
// Add dismiss button to card header
```

**Cost:** 1 SP  
**Severity:** P2 — polish; experienced users are re-shown a purchase CTA on every visit

---

### [CARRYOVER] AdvancedAnalysisSuccessBanner — now fixed (resolved)

**Status:** RESOLVED. The banner now:
- Strips the `?advanced=success` query param immediately (line 26–27)
- Auto-dismisses after 6 seconds
- Has a manual dismiss X button
- Uses `role="alert"` for screen reader announcement

No further action needed.

---

### [CARRYOVER] ShareModal — field explosion on QR tab (unresolved) — `packages/web/components/dashboard/share-modal.tsx:245-282`

**Issue:**  
The QR Code tab renders a 192×192px placeholder box with a large `QrCode` icon and static descriptive text,  
but the "Download QR Code" button (line 278) does nothing — it has no `onClick` handler and no API call.  
The QR type select (line 257) changes nothing. This is a **non-functional feature** presented as ready to use.  
Users click "Download QR Code" and nothing happens.

**Fix:**  
Either:
1. Hide the QR tab until QR generation is implemented: remove it from the `TabsList` or gate behind a  
   `FEATURES.QR_CODE` flag, or
2. Implement actual QR generation using the existing share URL (a 1 SP integration with a QR library like  
   `qrcode.react`)

**Cost:** 1 SP (hide) / 3 SP (implement)  
**Severity:** P2 — broken feature CTA; damages trust when nothing downloads

---

### [CARRYOVER] Admin settings (16 controls) — collapsible per section (now implemented, resolved)

**Status:** RESOLVED. `admin-settings-client.tsx` now uses `Collapsible` per section with `openSections`  
state (lines 96–100), defaulting general to open and others closed. The prior P0 concern is addressed.

---

## Carryover Status from 2026-05-07

| Prior Issue | Status | Notes |
|---|---|---|
| VoiceCloneUploader: clear error on success | NOT CHECKED (out of scope for this sprint) | Still P0 if unpatched |
| CommentsSidebar: add error state + retry | NOT FIXED | NotesPanel has same pattern |
| AudioChooser: collapse scenes (cognitive load) | NOT FIXED | Still P0 — 90+ clickable elements |
| CommentsSidebar: delete confirmation | FIXED in NotesPanel — not in CommentsSidebar | Partial fix |
| VoiceCloneUploader: loading state on "View clones" | NOT CHECKED | P1 |
| ServiceWorkerRegistration: error tracking | NOT CHECKED | P1 |
| AudioChooser modal: fix mobile height | NOT CHECKED | P2 |
| VoiceCloneUploader: upload progress bar | NOT CHECKED | P2 |

---

## Sprint Plan

| ID | SP | Title | File:Line | Priority | Type |
|----|-----|-------|-----------|----------|------|
| UX-M-01 | 2 | [NEW] ScreenplayPlayer: enable annotations on touch/mobile | ScreenplayPlayer.tsx:310-322 | P0 | Accessibility |
| UX-M-02 | 2 | [NEW] ScreenplayPlayer: show error + re-open popover on note save failure | ScreenplayPlayer.tsx:247-264 | P0 | Error handling |
| UX-M-03 | 1 | [NEW] NotesPanel: add delete confirmation + error toast | NotesPanel.tsx:78-86 | P0 | Safety |
| UX-M-04 | 2 | [NEW] NotesPanel: add error state + retry on fetch failure | NotesPanel.tsx:48-59 | P1 | Error handling |
| UX-M-05 | 2 | [NEW] Enterprise dashboard: paginate Notes tab (take:20 + load more) | enterprise/dashboard/page.tsx:109 | P1 | Performance |
| UX-M-06 | 1 | [NEW] ScreenplayReader: add touch-seek to progress bar | screenplay-reader.tsx:245 | P1 | Mobile |
| UX-M-07 | 1 | [NEW] project-workflow: add team name confirmation before share | project-workflow.tsx:1069 | P1 | Safety |
| UX-M-08 | 1 | [NEW] enterprise/team: add confirmation before removing member | enterprise/team/page.tsx:110 | P1 | Safety |
| UX-M-09 | 2 | [NEW] ScreenplayPlayer+NotesPanel: responsive collapse below sm breakpoint | project-workflow.tsx:600 | P2 | Mobile |
| UX-M-10 | 1 | [NEW] NotePopover: Escape key to dismiss | ScreenplayPlayer.tsx:170 | P2 | Keyboard nav |
| UX-M-11 | 1 | [NEW] Enterprise dashboard: replace hardcoded stat with real metric | enterprise/dashboard/page.tsx:203 | P2 | Credibility |
| UX-M-12 | 1 | [NEW] ScreenplayPlayer reactions: debounce + save loading state | ScreenplayPlayer.tsx:267 | P2 | Race condition |
| UX-M-13 | 1 | [CARRYOVER] AdvancedAnalysisUpgrade: add dismissal memory | AdvancedAnalysisUpgrade.tsx:74 | P2 | Polish |
| UX-M-14 | 1 | [CARRYOVER] ShareModal QR tab: hide or implement Download button | share-modal.tsx:278 | P2 | Trust |
| UX-M-15 | 3 | [CARRYOVER] AudioChooser: collapse scenes by default, reduce cognitive load | audio-chooser.tsx | P0 | Refactor |
| UX-M-16 | 2 | [CARRYOVER] CommentsSidebar: add error state + retry | CommentsSidebar.tsx:46 | P0 | Error handling |

**Total new issues:** 14 (UX-M-01 through UX-M-14)  
**Carryover unresolved:** 2 (UX-M-15, UX-M-16)  
**Total sprint effort:** 24 SP

---

## What Is Well-Designed (No Issues Found)

- **AudioPlayer (Sprint L progressive playback)** — segment stitching, buffer indicator, graceful resume on new segment arrival; well-handled edge cases
- **ScreenplayReader (`/listen`) script panel** — auto-scroll to active line, seek-to-line, inline note input with Cmd+Enter save, Escape cancel — all keyboard accessible
- **ScreenplayReader decision bar** — Like/Undecided/Pass toggle with clear `aria-pressed` states, loading guard, optimistic rollback on failure; a model pattern for the rest of the codebase
- **enterprise/dashboard tab structure** — 5 focused tabs with appropriate empty states; clean information hierarchy
- **project-workflow.tsx progressive polling** — Fast Start audio with `showBufferIndicator` and "Audio started — more generating in background…" label is clear
- **AdvancedAnalysisSuccessBanner** — now correctly strips URL param, auto-dismisses, and uses `role="alert"`; the prior P0 is resolved
- **MobileNav** — closes on link click (`onClick={() => setOpen(false)}`); does not require backdrop dismiss (links do the job)

---

## Patterns to Enforce Going Forward

1. **Every async fetch in a sidebar/panel component must have an error state with a retry button** — this was the original P0 in 2026-05-06 and has now been repeated in NotesPanel despite the pattern being documented.
2. **Hover-reveal UI must have a touch fallback** — any `onMouseEnter` show pattern needs `onFocus` + `tabIndex={0}` to remain accessible.
3. **Any destructive action (delete, remove member) must confirm** — one-liner `window.confirm()` is sufficient at MVP scale; replace with a dialog component if/when branded confirmations are needed.
4. **No hardcoded metrics on dashboards** — if a number doesn't come from the database query, it should not appear in a stat card.

---

**Audit completed:** 2026-05-19  
**Next review:** After Sprint N delivery
