# UX/Information Design Audit — 2026-06-03

**Scope:** Delta from 2026-05-29. New code audited: enterprise dashboard, team pages, invite flow,
reader upload success, enterprise contact page, enterprise-plans activation.

## Carryover Status from 2026-05-29

| ID | Status | Notes |
|----|--------|-------|
| UX-E-01 | RESOLVED | `generate-button.tsx:404` has `NODE_ENV !== 'production'` gate |
| UX-E-02 | RESOLVED (this session) | Enterprise banner now hidden for `studio`/`enterprise` tier |
| UX-E-03 | RESOLVED (this session) | `.slice(0,5)` removed; `max-h` raised to 400px |
| UX-E-04 | RESOLVED (this session) | `partners/page.tsx:252` uses `'en-US', { maximumFractionDigits: 0 }` |
| UX-E-05 | RESOLVED | Invite page shows proactive sign-up CTA for signed-out users |
| UX-E-06 | RESOLVED | Team settings member+pending lists have scroll containers |
| UX-E-07 | RESOLVED | `[Audio]`/`[Invite]` console.logs removed |
| UX-E-08 | OPEN | Enterprise dashboard activity feed + team list + TeamNotesTab still unbounded |
| UX-E-09 | OPEN | Audio chooser `h-8`/`h-7` icon buttons below 44px touch target |
| UX-E-10 | OPEN | Upload drop zone: no `onClick`/`tabIndex` |
| UX-E-11 | OPEN | Share modal bulk tab `w-36` name input clips on mobile |

## P0 Findings

None.

## P1 Findings

### [NEW] UX-F-01 — `handleActivate` silently swallows `!res.ok` — `app/enterprise-plans/page.tsx:144`
**FIXED this session**

**Issue:** API 4xx/5xx returned with zero user feedback — spinner cleared, UI returned to idle.
**Fix applied:** Added `toast.error(data.error ?? 'Activation failed...')` on the `else` branch.
**Cost:** 0.5 SP

## P2 Findings (Polish)

### [CARRYOVER UX-E-08] Enterprise dashboard: 3 unbounded lists — `app/enterprise/(gated)/dashboard/page.tsx:310,356` + `components/enterprise/TeamNotesTab.tsx:60`

**Issue:** Activity feed (`take: 50`, ~2600px), team member list (up to 200 members), and TeamNotesTab
(20 initial + load-more) all render without `max-h`/`overflow-y-auto`. New code (TeamNotesTab) added
since UX-E-08 was first filed.

**Fix:**
```tsx
// dashboard/page.tsx:310 — activity feed
<div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">

// dashboard/page.tsx:356 — team member list
<div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">

// TeamNotesTab.tsx:60
<div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
```
**Cost:** 1 SP

### [CARRYOVER UX-E-09] Audio chooser `h-8`/`h-7` icon buttons below 44px — `app/projects/[id]/audio-chooser.tsx:270,285,297,648,660`
**Fix:** `h-8 w-8` → `h-10 w-10`; `h-7` → `h-8`. **Cost:** 1 SP

### [CARRYOVER UX-E-10] Upload drop zone: no `onClick`/`tabIndex` — `components/reader/upload-client.tsx:238`
**Fix:** Add `tabIndex={0}` + `onClick={() => inputRef.current?.click()}`. **Cost:** 1 SP

### [CARRYOVER UX-E-11] Share modal bulk: `w-36` clips trash icon on narrow — `components/dashboard/share-modal.tsx:336`
**Fix:** `flex-col sm:flex-row` on recipient row. **Cost:** 1 SP

### [NEW] UX-F-02 — `EnterpriseProjectAssignment` icon buttons 28px — `components/enterprise/EnterpriseProjectAssignment.tsx:120,155`
**Fix:** `h-7 w-7` → `h-9 w-9`. **Cost:** 0.5 SP

### [NEW] UX-F-03 — Team page uses `window.confirm()` for destructive actions — `app/enterprise/(gated)/team/page.tsx:362,398`
**Issue:** `window.confirm()` is silently suppressed in iOS PWA (returns `true` immediately → delete fires
without confirmation). Message also inaccurate ("account will be disabled" vs actual team removal).
**Fix:** Replace both calls with Radix `AlertDialog` (already a codebase dependency). **Cost:** 1.5 SP

## Sprint Plan

| ID | SP | Title | File:Line | Priority |
|----|-----|-------|-----------|----------|
| UX-F-01 | 0.5 | [FIXED] enterprise-plans toast error | `enterprise-plans/page.tsx:144` | P1 |
| UX-E-08 | 1 | Scroll containers on 3 enterprise lists | `dashboard/page.tsx:310,356` + `TeamNotesTab:60` | P2 |
| UX-E-09 | 1 | Audio chooser touch targets | `audio-chooser.tsx:270+` | P2 |
| UX-E-10 | 1 | Upload drop zone keyboard/touch | `upload-client.tsx:238` | P2 |
| UX-E-11 | 1 | Share modal bulk mobile layout | `share-modal.tsx:336` | P2 |
| UX-F-02 | 0.5 | EnterpriseProjectAssignment icon buttons | `EnterpriseProjectAssignment.tsx:120,155` | P2 |
| UX-F-03 | 1.5 | Team page AlertDialog vs window.confirm | `team/page.tsx:362,398` | P2 |

**Total remaining SP:** 6.5 — **P0:** 0 | **P1:** 0 (UX-F-01 fixed) | **P2:** 6.5
