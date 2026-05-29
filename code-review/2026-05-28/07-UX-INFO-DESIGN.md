# UX/Information Design Audit — 2026-05-28

**Prior review:** `code-review/2026-05-27/07-UX-INFO-DESIGN.md`

## Status of Prior Findings

| ID | Title | Status |
|----|-------|--------|
| UX-D-01 | Gate dev log panel behind NODE_ENV | ✅ RESOLVED (2026-05-27) |
| UX-D-02 | Invite page: sign-up CTA for signed-out users | ⚠️ CARRYOVER |
| UX-D-03 | Team page: scroll containers on member lists | ⚠️ CARRYOVER |
| UX-D-04 | Remove invite-accept console.log calls | ✅ RESOLVED (this session) |

---

## P0 Findings

None.

---

## P1 Findings

### [NEW] ✅ FIXED THIS SESSION — 5 diagnostic console.logs in generate-button.tsx + invite/page.tsx

**Issue:** Three `console.log` calls in `generate-button.tsx` (lines 151, 163, 174) fired in every user's browser console during generation polling — logging signed CDN audio URLs and internal pipeline state. Two more in `invite/[token]/page.tsx` (lines 93, 102) logged token prefixes and response codes.
**Fix applied:** All 5 removed.
**Cost:** 1 SP ✅

---

## P2 Findings (Polish)

### [CARRYOVER] UX-D-02 — Invite page: "Accept Invitation" shown to signed-out users before auth — `invite/[token]/page.tsx:278`

**Issue:** Signed-out user sees "Accept Invitation" button → POST → `AUTH_REQUIRED` → sign-up prompt. Correct next step is account creation, not acceptance. Causes a failed HTTP round-trip and screen flicker.
**Fix:** Check `clerkLoaded && !isSignedIn` before rendering accept button; show sign-up CTA proactively:
```tsx
if (clerkLoaded && !isSignedIn) return <NeedsAuthView token={token} />;
```
**Cost:** 1 SP

### [CARRYOVER] UX-D-03 — Team member lists have no scroll container — `enterprise/team/page.tsx:251,290`

**Issue:** Both active members and pending invites render as unbounded lists. A 30-member team breaks the `lg:grid-cols-2` symmetry.
**Fix:**
```tsx
<div className="max-h-[360px] overflow-y-auto space-y-2 pr-1"> {/* active */}
<div className="max-h-[280px] overflow-y-auto space-y-2 pr-1"> {/* pending */}
```
**Cost:** 1 SP

### [NEW] ✅ FIXED THIS SESSION — UX-E-02 — Bare toLocaleString() on MRR in admin pages

**Where:** `admin/analytics/page.tsx:124`, `admin/page.tsx:102`
**Fix applied:** `toLocaleString('en-US', { maximumFractionDigits: 0 })` on both.

### [NEW] ✅ FIXED THIS SESSION — UX-E-03 — Bare toLocaleString() on public impact/partners dollar amounts

**Where:** `impact/partners/page.tsx:86,252`
**Fix applied:** `toLocaleString('en-US')` on both occurrences.

### [NEW] ✅ FIXED THIS SESSION — UX-E-04 — Redundant "You can leave this page" toast — `generate-button.tsx:266`

**Issue:** Instructional text in the toast duplicated the persistent "Safe to leave" banner below the progress bar. Noisy for returning users.
**Fix applied:** Shortened to `toast.success('Generation started!')`.

### [NEW] UX-E-05 — Stepper labels too small on mobile — `project-workflow.tsx:202`

**Issue:** 5 step labels at `text-[10px] max-w-[60px]` in `flex justify-between`. Below WCAG 1.4.4 minimum on narrow viewports. Labels crowd on 375px and overflow on 320px.
**Fix:** Hide labels below `sm` breakpoint; the `CurrentActionCard` already communicates the active step:
```tsx
<span className={cn('hidden sm:block text-[10px] mt-1 text-center max-w-[60px]', ...)}>
```
**Cost:** 1 SP

---

## Sprint Plan

| ID | SP | Title | File:Line | Priority | Status |
|----|-----|-------|-----------|----------|--------|
| UX-E-01 | 1 | [NEW] Gate audio console.logs behind NODE_ENV | `generate-button.tsx:151,163,174` | P1 | ✅ DONE |
| UX-D-04 | 0.5 | [CARRYOVER] Remove invite console.logs | `invite/[token]/page.tsx:93,102` | P2 | ✅ DONE |
| UX-E-02 | 1 | [NEW] Fix MRR toLocaleString in admin pages | `admin/analytics/page.tsx:124`, `admin/page.tsx:102` | P2 | ✅ DONE |
| UX-E-03 | 0.5 | [NEW] Fix toLocaleString on public partner amounts | `impact/partners/page.tsx:86,252` | P2 | ✅ DONE |
| UX-E-04 | 1 | [NEW] Shorten redundant "leave this page" toast | `generate-button.tsx:266` | P2 | ✅ DONE |
| UX-D-02 | 1 | [CARRYOVER] Invite page: pro-active sign-up CTA | `invite/[token]/page.tsx:278` | P2 | Open |
| UX-D-03 | 1 | [CARRYOVER] Team scroll containers | `enterprise/team/page.tsx:251,290` | P2 | Open |
| UX-E-05 | 1 | [NEW] Hide stepper labels below sm breakpoint | `project-workflow.tsx:202` | P2 | Open |

**Total open SP:** 3 | **Fixed this session:** 4 SP across 5 items
