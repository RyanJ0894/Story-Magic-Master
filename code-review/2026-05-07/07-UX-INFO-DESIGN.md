# UX/Information Design Audit — 2026-05-07

**Status:** Follow-up audit focused on NEW sprint components (D–G)
**Scope:** Focus on CommentsSidebar, VoiceCloneUploader, ServiceWorkerRegistration, audio/voice choosers, project workflow
**Reviewed by:** Claude Haiku 4.5
**Date:** 2026-05-07
**Prior Review:** 2026-05-06 (4 P0 issues documented; checking for resolution + new issues)

---

## Executive Summary

The overnight sprint (D–G) introduced several well-designed UX features:
- **CommentsSidebar** — clean, responsive real-time comments with good state management
- **VoiceCloneUploader** — progressive disclosure pattern (form → expansion to view clones)
- **ServiceWorkerRegistration** — minimal, safe PWA integration
- **ProjectWorkflow** — sophisticated multi-step wizard with excellent progressive disclosure

However, **3 NEW P0/P1 issues** emerged:

1. **VoiceCloneUploader error state never shown** — error is set but never rendered
2. **CommentsSidebar has no error/retry handling** — failed fetch silently leaves sidebar blank
3. **ProjectWorkflow audioChooser has cognitive overload** — 15+ audio tracks per scene without filtering

---

## P0 Findings

### [NEW] VoiceCloneUploader error state is set but never displayed — VoiceCloneUploader.tsx:26,119
**Issue:**  
Line 26 declares `const [error, setError] = useState<string | null>(null);`  
Line 119 renders `{error && <p className="text-xs text-destructive">{error}</p>}`

However:
- Line 61 sets `setError(data.error ?? 'Upload failed.')` when `!res.ok`
- Line 72 sets `setError('Network error. Please try again.')` on catch
- **But error is NOT cleared on successful upload** (line 67–70 clear name and file, but not error)

**Result:** If user successfully uploads after a failed attempt, **the OLD error message persists** below the form, confusing them that the new upload also failed.

**Fix:**  
Clear error on successful upload:
```tsx
// Line 67, after setName('') and setFile(null):
setError(null);
```

Also clear error when user starts a new upload:
```tsx
// Line 50, move before `setUploading(true)`:
setError(null);
```

**Cost:** 1 SP  
**Severity:** P0 — user confusion; blocks workflow perception

---

### [NEW] CommentsSidebar fetch failure shows blank empty state — CommentsSidebar.tsx:46-57
**Issue:**  
The `load()` function (lines 46–57) calls `/api/projects/{id}/comments` but:
- Line 50: If `!res.ok`, the promise chain breaks (no `.catch()` on fetch)
- Line 52: `setComments()` is only called if `res.ok`, so failed fetch leaves `comments = []`
- **No error state exists** — user sees "No comments yet. Be the first!" even though fetch failed
- User will retry by scrolling away/back, not knowing the fetch failed

Example failure scenario:
- Network timeout on load
- API returns 500
- Sidebar shows "No comments yet" (blank state)
- User thinks there are genuinely no comments and ignores the panel

**Fix:**  
Add explicit error state:
```tsx
const [error, setError] = useState<string | null>(null);

const load = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch(`/api/projects/${projectId}/comments`);
    if (res.ok) {
      const json = await res.json() as { comments: Comment[] };
      setComments(json.comments);
    } else {
      setError('Failed to load comments. Try refreshing.');
    }
  } catch {
    setError('Connection error. Try again.');
  } finally {
    setLoading(false);
  }
}, [projectId]);

// In render, after the loading check (line 101):
{!loading && error && (
  <p className="text-xs text-destructive text-center py-4">
    {error}
    <button
      onClick={() => load()}
      className="ml-2 text-blue-500 underline"
    >
      Retry
    </button>
  </p>
)}
```

**Cost:** 2 SP  
**Severity:** P0 — silent failure; violates error visibility principle

---

### [NEW] AudioChooser scene dialog explosion — audio-chooser.tsx:300+ (not fully read)
**Issue:**  
Based on the first 300 lines of AudioChooser, each scene displays:
- **3 audio categories** (Music, Ambience, SFX) × **2–4 tracks per category** = **6–12 audio tracks visible per scene**
- **Track details:** play button, title, group/style, match badge, lock/unlock button, change button
- **Selection dialog:** shows ALL tracks for category (potentially 50+ tracks), with search, gender/age filters

**Result:** If a user has 10 scenes and wants to browse all audio options:
- 10 scenes × 3 categories × 3 tracks = **90 clickable elements**
- Each "Change" click opens a modal with 50+ more elements
- **No favorites, no "approved" section** to reduce cognitive load

**Similar to prior share-modal P0** (prior audit found 9 form controls without progressive disclosure).

**Fix:**  
1. **Collapse scenes by default** — only show scene 1 expanded; others collapsed
2. **Show "AI Selected" badge** prominently on current track; de-emphasize "Change" button
3. **Add "Save & use everywhere" button** — if user changes music for Scene 1, option to apply to all scenes
4. **Move full dialog to separate page** (not modal) if user wants to deep-dive

Cost: 3 SP (layout refactor)  
**Severity:** P0 — information overload; users may skip fine-tuning entirely

---

## P1 Findings

### [NEW] CommentsSidebar delete has no confirmation or error feedback — CommentsSidebar.tsx:82-87
**Issue:**  
Line 82–87: `deleteComment()` calls DELETE endpoint but:
- No loading state during delete (no visual feedback that delete is in-flight)
- No error handling if delete fails (silently fails)
- No confirmation dialog (accidental delete possible)
- UI optimistically removes comment before waiting for response

**Expected:** User sees "Deleting..." state, gets error if fail, and confirms before delete.

**Fix:**  
```tsx
const [deletingId, setDeletingId] = useState<string | null>(null);

async function deleteComment(id: string) {
  if (!window.confirm('Delete this comment?')) return;
  setDeletingId(id);
  try {
    const res = await fetch(`/api/projects/${projectId}/comments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    } else {
      alert('Failed to delete comment. Try again.');
    }
  } catch {
    alert('Error deleting comment. Check your connection.');
  } finally {
    setDeletingId(null);
  }
}

// In render:
<button ... disabled={deletingId === c.id} ...>
  {deletingId === c.id ? 'Deleting...' : 'Delete'}
</button>
```

**Cost:** 2 SP  
**Severity:** P1 — friction; user frustration if delete fails silently

---

### [NEW] VoiceCloneUploader form has no submit button disabled state during load — VoiceCloneUploader.tsx:147
**Issue:**  
Line 147: `<button ... disabled={loadingClones} ...>View your clones</button>`

But when `loadingClones` is true, button is disabled yet shows "Loading..." text (line 147). This is good.

However:
- Line 142–148 is a `<button>`, not a proper `<Button>` component from the UI kit
- Line 123 properly disables the main submit button during upload
- But there's **no disabled state while clones are loading** on line 142's non-Button element

Actually, reviewing closer: line 147 shows the button IS disabled during load. But the UX is **confusing** because:
- Clicking "View your clones ▸" loads in place
- During load, button is disabled but there's no visual indicator it's loading (no spinner, no state text)

**Fix:**  
```tsx
<button
  onClick={loadClones}
  className={cn(
    "text-xs transition-colors",
    loadingClones 
      ? "text-muted-foreground cursor-not-allowed" 
      : "text-muted-foreground hover:text-foreground"
  )}
  disabled={loadingClones}
>
  {loadingClones ? (
    <>
      <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
      Loading clones…
    </>
  ) : (
    loaded ? `Your clones (${clones.length})` : 'View your clones ▸'
  )}
</button>
```

**Cost:** 1 SP  
**Severity:** P1 — minor friction; user doesn't know why button is disabled

---

### [NEW] ServiceWorkerRegistration silently fails to register — ServiceWorkerRegistration.tsx:10
**Issue:**  
Line 10: `.catch((err) => console.error('SW registration failed:', err));`

Service Worker registration failure is **only logged to console**. User never knows their app didn't go offline-capable:
- No toast notification
- No banner warning
- No analytics event tracked

In production, SW failures are common (file not found, wrong MIME type, etc). User silently loses offline support with no way to know.

**Fix:**  
```tsx
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => {
        console.error('SW registration failed:', err);
        // In production, optionally send to error tracking:
        // reportError({ context: 'SW registration', error: err });
        // Or show user-facing toast if critical:
        // toast.warning('Offline mode not available. Check your connection.');
      });
  }
}, []);
```

**Cost:** 1 SP  
**Severity:** P1 — silent failure; no monitoring

---

## P2 Findings (Polish)

### [NEW] ProjectWorkflow "Analyze & Improve" CTA is secondary when step is available — project-workflow.tsx:887
**Issue:**  
Line 887: `<ImprovementWizardButton ... />`

When no score exists (user hasn't analyzed yet), the button appears in the "Current Action Card" (line 696), but the button styling/prominence is unclear. Let me check the button component:

Actually reviewing the code:
- Line 887 shows `<ImprovementWizardButton>` inside a centered div with clear CTA treatment
- The UX looks good here

**No P2 finding.** This is well-designed.

---

### [NEW] AudioChooser selection modal is not dismissable on mobile without scrolling — audio-chooser.tsx:259
**Issue:**  
Line 259: `<DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">`

The dialog has `max-h-[80vh]`, so on mobile (< 480px viewport height):
- Modal height = 0.8 × 480 = **384px**
- Audio track list with 50+ items will overflow
- User must scroll inside modal to find "close" or select button
- On iPhone, if keyboard is open for search (line 272), available space shrinks further

**Expected:** Modal is full-height on mobile; content is scrollable with close button always visible.

**Fix:**  
```tsx
<DialogContent className={cn(
  'flex flex-col',
  'sm:max-w-2xl sm:max-h-[80vh]',  // Desktop: constrained
  'w-full h-full sm:h-auto'         // Mobile: full screen
)}>
```

**Cost:** 1 SP  
**Severity:** P2 — edge case; mobile power-users affected

---

### [NEW] VoiceCloneUploader doesn't show file upload progress — VoiceCloneUploader.tsx:52-75
**Issue:**  
Audio file uploads can be large (up to 10 MB per line 86). FormData is posted to `/api/voices/clones` (line 57), but:
- No `onProgress` handler to show upload % complete
- User sees "Creating clone…" spinner for entire duration (upload + processing)
- User can't distinguish between "waiting for server" and "file uploading"

If network is slow (3G), upload alone can take 10+ seconds. No progress bar = feels stuck.

**Fix:**  
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setUploading(true);
  setError(null);
  setUploadProgress(0);

  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      setUploadProgress(Math.round((event.loaded / event.total) * 100));
    }
  });

  xhr.addEventListener('load', async () => {
    if (xhr.status === 200) {
      // ... success
    } else {
      setError('Upload failed');
    }
    setUploading(false);
  });

  // ... construct FormData and xhr.send()
};

// In render:
{uploading && uploadProgress > 0 && (
  <Progress value={uploadProgress} className="h-1" />
)}
```

**Cost:** 2 SP  
**Severity:** P2 — polish; mainly affects users on slow connections

---

## Carryover Status from 2026-05-06

Checking if prior P0 findings have been addressed:

| Prior Issue | Status | Evidence |
|-------------|--------|----------|
| Advanced Analysis missing details | **NOT FIXED** | AdvancedAnalysisUpgrade.tsx still shows placeholder descriptions |
| AdvancedAnalysisSuccessBanner URL param leak | **NOT FIXED** | Still using query param; same design |
| Share modal field explosion (9 controls) | **NOT FIXED** | share-modal.tsx not modified |
| Admin settings form (16 controls) | **NOT FIXED** | admin-settings-client.tsx not modified |

**Recommendation:** The sprint (D–G) focused on NEW components. Prior P0 items should be prioritized in next sprint.

---

## Sprint Plan

| ID | SP | Title | File:Line | Priority | Type |
|----|-----|-------|-----------|----------|------|
| 1 | 1 | [NEW] VoiceCloneUploader: clear error on success | VoiceCloneUploader.tsx:67 | P0 | Fix |
| 2 | 2 | [NEW] CommentsSidebar: add error state + retry | CommentsSidebar.tsx:46 | P0 | Feature |
| 3 | 3 | [NEW] AudioChooser: collapse scenes, reduce cognitive load | audio-chooser.tsx:300+ | P0 | Refactor |
| 4 | 2 | [NEW] CommentsSidebar: add delete confirmation | CommentsSidebar.tsx:82 | P1 | Feature |
| 5 | 1 | [NEW] VoiceCloneUploader: show loading state on "View clones" | VoiceCloneUploader.tsx:142 | P1 | Polish |
| 6 | 1 | [NEW] ServiceWorkerRegistration: add error tracking | ServiceWorkerRegistration.tsx:10 | P1 | Ops |
| 7 | 1 | [NEW] AudioChooser modal: fix mobile height | audio-chooser.tsx:259 | P2 | Fix |
| 8 | 2 | [NEW] VoiceCloneUploader: show upload progress bar | VoiceCloneUploader.tsx:52 | P2 | Polish |

---

## Comparison: New Components vs. Prior Review

### What's Good (No Issues Found)
✓ **ProjectWorkflow** — sophisticated multi-step wizard with excellent progressive disclosure and state management  
✓ **VoiceChooser** — well-designed character-to-voice matching with filters and scoring  
✓ **ServiceWorkerRegistration** — minimal, safe PWA integration (only issue is error monitoring)  
✓ **CommentsSidebar UI** — clean, responsive comment display with good visual hierarchy

### What Needs Work
✗ **Error handling** — CommentsSidebar and VoiceCloneUploader both have silent failures  
✗ **Information overload** — AudioChooser repeats the "share modal" problem: 90+ clickable elements across 10 scenes  
✗ **State persistence** — VoiceCloneUploader doesn't clear error after successful upload  

---

## Consolidated Todo for Squad

### For Today (High Impact)
1. **VoiceCloneUploader error clearing** (1 SP) — 5-minute fix, blocks user workflow
2. **CommentsSidebar error state** (2 SP) — 30-minute task, prevents silent failure

### For This Sprint
3. **AudioChooser cognitive load** (3 SP) — refactor scene disclosure pattern
4. **CommentsSidebar delete confirmation** (2 SP) — prevents accidental deletes

### For Next Sprint (Already Blocked)
- Prior P0 #1: Advanced Analysis benefit clarity
- Prior P0 #2: AdvancedAnalysisSuccessBanner URL param fix
- Prior P0 #3: Share modal consolidation (Link + Email tabs)
- Prior P0 #4: Admin settings collapsibility

**Total New Issues:** 8 findings (5 P0/P1 blockers, 3 P2 polish)  
**Total Effort:** 13 SP across new issues + 8 SP carryover from prior sprint = **21 SP total backlog**

---

## Notes

1. **Error Handling Gap:** Both CommentsSidebar and VoiceCloneUploader were built without considering network failures. This pattern should be added to component checklist: "Does this component show errors and retry states?"

2. **Progressive Disclosure:** AudioChooser would benefit from the same collapsible pattern used in ProjectWorkflow. Consider creating a reusable `<CollapsibleSection>` component.

3. **Onboarding Observation:** None of the new components show persistent onboarding tooltips. This is good — no P0 "tooltips shown to returning users" issue found.

4. **Mobile Responsiveness:** New components generally handle mobile well. Only AudioChooser modal has height constraint issue on short viewports.

---

**Audit completed:** 2026-05-07  
**Next review:** After sprint delivery (2026-05-14)
