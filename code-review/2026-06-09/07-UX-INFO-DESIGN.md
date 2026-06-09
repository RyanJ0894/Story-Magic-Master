# UX/Information Design Audit — 2026-06-09

**Scope:** Delta from 2026-06-03. UI changes since: PR #167 (silent-pipeline-failures),
PR #168 (user-errors-shared-projects), Sprint-D UX fixes (commit b0067fd), team-share
fixes (02588b0). Most merges since 2026-06-03 were orchestrator cost-optimization PRs.

## Delta Summary

- **Resolved since 2026-06-03 (5):**
  - UX-E-08 — enterprise dashboard activity feed + team list now have `max-h-[480px] overflow-y-auto` (`dashboard/page.tsx:312,358`)
  - UX-E-08 — TeamNotesTab now bounded (`TeamNotesTab.tsx:60`)
  - UX-E-09 — audio-chooser icon buttons raised to `h-10 w-10` / `h-9` (`audio-chooser.tsx:270,297,482,494,728`)
  - UX-E-11 — share modal bulk name input now `w-full sm:w-36` (`share-modal.tsx:348`)
  - UX-F-03 — team page replaced `window.confirm` with AlertDialog (`team/page.tsx:420`)
- **Carryover (1):** UX-E-10 (drop zone)
- **New (3):** UX-G-01, UX-G-02, UX-G-03

## P0 Findings

None.

## P1 Findings

### [NEW] UX-G-01 — `window.confirm` for destructive actions across project flows — `app/projects/[id]/project-workflow.tsx:1084,1125`, `app/projects/[id]/shares/page.tsx:162,183`, `components/project/CommentsSidebar.tsx:91`, `components/project/NotesPanel.tsx:86`
**Issue:** Same iOS-PWA-suppression risk that justified UX-F-03's AlertDialog migration on the team page is now present in 5 other sites:
- Remove project from team share (`project-workflow.tsx:1084`)
- Add project to team share (`project-workflow.tsx:1125`)
- Deactivate single share link (`shares/page.tsx:162`)
- Deactivate ALL share links (`shares/page.tsx:183`) — highest risk: irreversible bulk action
- Delete comment (`CommentsSidebar.tsx:91`)
- Delete note (`NotesPanel.tsx:86`)

In iOS standalone PWA mode, `window.confirm()` returns `true` immediately without showing a dialog, causing silent destructive actions. The `shares/page.tsx:183` bulk-deactivate is the highest priority.

**Fix:** Reuse the AlertDialog pattern from `team/page.tsx:420`. Minimal version for the bulk-deactivate:
```tsx
const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
// replace window.confirm with:
setConfirmBulkOpen(true);
// then AlertDialog renders with onConfirm={() => doBulkDeactivate()}
```
**Cost:** 2 SP (one shared `<ConfirmDialog>` wrapper component + 6 callsite refactors)

## P2 Findings (Polish)

### [CARRYOVER UX-E-10] Upload drop zone: missing `tabIndex`/`onClick` — `components/reader/upload-client.tsx:238`
**Status:** Partially mitigated — `role="button"` + `aria-label` added, but still no `tabIndex={0}` (keyboard cannot focus) and no `onClick` to open file picker (must click the inner "Select PDF" button, not the drop area).
**Fix:**
```tsx
const inputRef = useRef<HTMLInputElement>(null);
<div
  className={...}
  role="button"
  tabIndex={0}
  aria-label="Upload screenplay file"
  onClick={() => inputRef.current?.click()}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
  onDragOver={...} onDragLeave={...} onDrop={...}
>
  ...
  <input ref={inputRef} type="file" ... className="hidden" />
</div>
```
**Cost:** 1 SP

### [NEW] UX-G-02 — `wordCount.toLocaleString()` without locale — `app/projects/new/page.tsx:223`
**Issue:** Default locale on server can differ from client → SSR/CSR hydration mismatch warnings; also inconsistent with `admin/page.tsx:102` and `admin/analytics/page.tsx:124` which both pass `'en-US'`.
**Fix:**
```tsx
{wordCount.toLocaleString('en-US')} words
```
**Cost:** 0.5 SP

### [NEW] UX-G-03 — `ScriptImprovementWizard` suggestion list `max-h-[400px]` may clip silently — `components/wizard/ScriptImprovementWizard.tsx:287`
**Issue:** Container is `max-h-[400px] overflow-y-auto`, but no scrollbar styling and no visual "more below" cue. With 15+ suggestions (realistic for a 100-page script), users scanning the list have no signal more content exists. Compare to `SuggestionPanel` which uses Radix `ScrollArea` (visible scrollbar).
**Fix:**
```tsx
import { ScrollArea } from '@/components/ui/scroll-area';
<ScrollArea className="max-h-[400px]">
  <div className="space-y-3">...</div>
</ScrollArea>
```
**Cost:** 0.5 SP

## Items Verified Clean

- Number formatting in `admin/page.tsx:102`, `admin/analytics/page.tsx:124` — both pass `'en-US', { maximumFractionDigits: 0 }`. Good.
- StoryAdviser/AdviserWizard/ScriptImprovementWizard all render error UI from `setError` state — no error-state gaps.
- Enterprise dashboard scroll containers (UX-E-08) confirmed present at `dashboard/page.tsx:312,358` + `TeamNotesTab.tsx:60`.
- Audio chooser touch targets confirmed `h-10 w-10` (`audio-chooser.tsx:270,297`) and `h-9` (`audio-chooser.tsx:482,494,728`) — all ≥36px.

## Sprint Plan

| ID | SP | Title | File:Line | Priority |
|----|-----|-------|-----------|----------|
| UX-G-01 | 2 | Replace `window.confirm` with AlertDialog (6 callsites) | `project-workflow.tsx:1084,1125`, `shares/page.tsx:162,183`, `CommentsSidebar.tsx:91`, `NotesPanel.tsx:86` | P1 |
| UX-E-10 | 1 | Drop zone keyboard + click-to-open | `upload-client.tsx:238` | P2 |
| UX-G-02 | 0.5 | Word count locale arg | `projects/new/page.tsx:223` | P2 |
| UX-G-03 | 0.5 | Wizard suggestion list ScrollArea | `ScriptImprovementWizard.tsx:287` | P2 |

**Total remaining SP:** 4.0 — **P0:** 0 | **P1:** 2.0 | **P2:** 2.0

**Trend:** Net improvement from 2026-06-03 (6.5 SP remaining → 4.0 SP). 5 of 7 prior-round items
shipped. The team-page AlertDialog pattern is the canonical fix for UX-G-01 — should be promoted
into a shared `<ConfirmDialog>` component so the next round closes all 6 sites at once.
