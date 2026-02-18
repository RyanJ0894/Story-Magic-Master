# 08 - UI/UX Review

**Date:** 2026-02-15
**Reviewer:** Chris Therriault <chris@servicevision.net>
**Scope:** Next.js 14 frontend (`packages/web/`) -- 26 pages, ~60 components
**Stack:** Tailwind CSS + shadcn/ui + Lucide icons + Clerk auth

---

## Executive Summary

The frontend demonstrates strong design-system discipline. shadcn/ui primitives are used consistently across all pages, the violet/purple brand gradient is applied uniformly, and the overall visual hierarchy is clear. Key gaps remain in **ARIA labeling on interactive pages**, **mobile responsiveness in the admin panel**, **form-validation feedback**, and **placeholder payment UI** in the reader upload flow. Fourteen findings are documented below, eight at Medium severity and two at High.

---

## 1. Accessibility

### UX-001 | HIGH | AlertsDropdown lacks ARIA label on trigger button

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/components/alerts/AlertsDropdown.tsx`
**Lines:** 152-160

The bell-icon trigger button has no `aria-label`. Screen readers will announce it as an empty button.

```tsx
<Button variant="ghost" size="sm" className="relative">
  <Bell className="w-4 h-4" />
  {unreadCount > 0 && (
    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 ...">
```

The unread-count badge is purely visual (`<span>` with no `aria-live` or `sr-only` text). A screen reader user has no way to know there are unread notifications.

**Recommendation:**
- Add `aria-label="Notifications"` to the trigger `<Button>`.
- Add `<span className="sr-only">{unreadCount} unread notifications</span>` or wrap the badge count in an `aria-live="polite"` region.

---

### UX-002 | MEDIUM | Dashboard page header links lack accessible names

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/dashboard/page.tsx`
**Lines:** 78-83

The logo link wraps an icon + text span. While sighted users see "Story Magic," the `<Link>` itself has no explicit `aria-label`. This is acceptable because the inner text content ("Story Magic") is programmatically associated, but the decorative icon `<Sparkles>` should have `aria-hidden="true"` to prevent double-announcement.

```tsx
<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 ...">
  <Sparkles className="w-4 h-4 text-white" />
</div>
```

**Status:** The Sparkles icon does NOT have `aria-hidden="true"`. Compare with admin page.tsx line 134 where `aria-hidden="true"` IS correctly applied.

**Recommendation:** Add `aria-hidden="true"` to decorative icons in dashboard header and project cards.

---

### UX-003 | MEDIUM | Project cards are entire clickable Links but lack focus-visible styling

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/dashboard/page.tsx`
**Lines:** 154-178

Each project card is wrapped in `<Link>` > `<Card>`. The Card has `hover:shadow-md hover:border-violet-300` but no `focus-visible:` ring. Keyboard users tabbing through the grid see no focus indicator.

```tsx
<Card className="h-full transition-all hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700 cursor-pointer">
```

**Contrast:** The project detail page collapsible headers (lines 216, 243) correctly implement `focus-visible:ring-2`.

**Recommendation:** Add `focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2` to the Card or the wrapping Link.

---

### UX-004 | LOW | Player components have excellent ARIA coverage

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/components/player/ScriptSyncPlayer.tsx`
**Lines:** 320-437

Positive finding. The audio player is the most accessible component in the codebase:
- Playback controls grouped with `role="group" aria-label="Playback controls"` (line 320)
- Individual buttons have descriptive `aria-label` values: "Skip back 10 seconds," "Pause"/"Play" (lines 323-341)
- Seek bar has `role="slider"` and `aria-label="Seek"` (lines 352-354)
- Script lines have `role="button"` with character + text labels (line 435-437)

The protected player (`protected-player.tsx`) mirrors this pattern with scene list `role="listbox"` (line 389) and per-scene `role="option"` (line 393).

**Recommendation:** Use the player components as the reference pattern when remediating other components.

---

### UX-005 | MEDIUM | Admin sidebar navigation has no active-state indicator

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/layout.tsx`
**Lines:** 57-67

All navigation links share the same style: `text-slate-400 hover:text-white hover:bg-slate-800`. There is no `aria-current="page"` attribute and no visual active state to indicate the current page.

```tsx
{navigation.map((item) => (
  <Link
    key={item.name}
    href={item.href}
    className="flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
  >
```

**Recommendation:** Use `usePathname()` (or pass the current path from the server component) to conditionally apply `bg-slate-800 text-white` and `aria-current="page"`.

---

### UX-006 | LOW | Theme toggle and mobile nav have proper ARIA

**Files:**
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/components/theme-toggle.tsx` (line 41: dynamic `aria-label`)
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/mobile-nav.tsx` (lines 14-18: `aria-expanded`, `aria-label`, `aria-hidden` on icons)

Positive finding. These components correctly implement toggle-state ARIA and decorative icon hiding.

---

## 2. Loading, Error, and Empty States

### UX-007 | LOW | Good coverage of loading/error/empty states

**Files:**
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/loading.tsx` -- Global spinner
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/error.tsx` -- Global error boundary with retry
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/not-found.tsx` -- 404 page
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/loading.tsx` -- Skeleton-based admin loader (lines 1-44)
- `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/error.tsx` -- Admin-specific error boundary

Positive finding. The global `loading.tsx` provides a simple spinner. The admin section adds a skeleton-based loading state that mirrors the real layout (stat cards + table rows). Both error boundaries use the same `Button onClick={reset}` pattern for retry.

**Dashboard empty state** (`dashboard/page.tsx` lines 182-201) is well-crafted with a folder icon, friendly copy ("No projects yet"), and a prominent CTA button.

**AlertsDropdown** (`AlertsDropdown.tsx` lines 183-191) handles all three states: loading spinner, empty "No notifications yet" with a faded bell icon, and the populated list.

---

### UX-008 | MEDIUM | New project form lacks inline validation feedback

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/projects/new/page.tsx`
**Lines:** 166-257

The form relies on HTML `required` attributes (lines 175, 212) and a disabled submit button (`disabled={loading || !name || !scriptText}`, line 242). However:

1. **No character/length limits** are enforced on the project name or description fields. A user could paste a 10,000-character name.
2. **No minimum content check** for the script textarea. A single character satisfies `required` and `!scriptText`.
3. **No inline error messages.** The `<Label>` components use `htmlFor` correctly (lines 169, 183, 198), but there are no `<FormMessage>` or error-state indicators -- validation errors surface only as `toast.error()` from API responses (lines 101-102).
4. **No maximum page count warning.** The page count display (line 203) shows estimated pages but does not warn when the user exceeds their tier limit (3 pages for free tier).

**Recommendation:**
- Add `maxLength` to name/description inputs.
- Show an inline warning when `pageCount > remaining` before submit.
- Consider using shadcn's `Form` + `FormField` + `FormMessage` pattern for consistent validation.

---

### UX-009 | MEDIUM | Audit log handles missing table gracefully

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/audit-log/page.tsx`
**Lines:** 86-103, 117-131

Positive finding. The audit log page wraps its Prisma queries in a try/catch and detects the "table does not exist" error (lines 97-103). It then renders a helpful card with the migration command rather than crashing. This is a good pattern for progressive database feature adoption.

---

## 3. Responsive Design

### UX-010 | MEDIUM | Dashboard has proper responsive breakpoints

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/dashboard/page.tsx`

Responsive patterns observed:
- **Container padding:** `px-4 sm:px-6 lg:px-8` (line 76, 116)
- **Usage indicator:** `hidden sm:flex` on desktop, dedicated `<Card className="mb-6 sm:hidden">` for mobile (lines 90, 136)
- **Page header:** `flex flex-col sm:flex-row sm:items-center sm:justify-between` (line 118)
- **Project grid:** `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (line 150)
- **Form layout:** `grid gap-6 sm:grid-cols-2` on new project page (projects/new line 167)

This is well-executed. The mobile usage indicator card (lines 136-146) is a particularly good pattern -- it shows the same data as the header indicator but in a card format that works on narrow screens.

---

### UX-011 | HIGH | Admin panel sidebar is not responsive -- breaks on mobile

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/layout.tsx`
**Lines:** 50-90

The admin sidebar uses `fixed inset-y-0 left-0 w-64` and the main content area uses `pl-64`. There are **no responsive breakpoints**. On mobile/tablet:
- The 256px sidebar consumes the entire viewport width on screens < 400px
- Content area is pushed off-screen by `pl-64`
- No hamburger menu or collapsible sidebar exists for the admin section

```tsx
<aside className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 ...">
...
<main className="pl-64">
```

**Impact:** Admin panel is completely unusable on mobile devices.

**Recommendation:** Add `hidden md:block` to the sidebar and implement a slide-out drawer with a toggle button for mobile. Alternatively, use `md:pl-64 pl-0` on the main content.

---

## 4. Form Validation

### UX-012 | MEDIUM | AI demo script dialog lacks validation timing

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/projects/new/page.tsx`
**Lines:** 44-76, 263-314

The "Generate Demo Script" dialog uses `toast.error('Please describe the scene you want')` (line 46) when the prompt is empty, but the button is already disabled when `!aiPrompt.trim()` (line 297). This means the toast can only fire if validation changes between the check -- a dead code path. This is harmless but indicates the validation was written defensively without a clear pattern.

The dialog does handle the loading state well: both buttons are disabled during generation (lines 281, 297), and the generate button shows a spinner with "Generating..." text.

---

## 5. Design System Consistency

### UX-013 | MEDIUM | Gradient brand pattern is consistent but not extracted

The violet-to-purple gradient appears in **30+ locations** across the codebase, always using one of two patterns:
- **Background gradient:** `bg-gradient-to-br from-violet-500 to-purple-600` (logo marks)
- **Button gradient:** `bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700` (CTAs)

These strings are copy-pasted verbatim. A single typo in one location would create an inconsistent brand appearance.

**Recommendation:** Extract into Tailwind utility classes or a shared constant:
```tsx
// lib/styles.ts
export const brandGradient = "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700";
export const brandMark = "bg-gradient-to-br from-violet-500 to-purple-600";
```

---

### UX-014 | MEDIUM | Admin dashboard stats use hardcoded change percentages

**File:** `/Users/admin/dev2/clients/RyanJae/story-magic/packages/web/app/admin/page.tsx`
**Lines:** 57-114

All eight stat cards show hardcoded growth percentages (`+12%`, `+8%`, `+15%`, etc.) that are not computed from actual data:

```tsx
{ label: 'Total Users', value: totalUsers || 0, icon: Users, color: 'bg-blue-500', change: '+12%' },
{ label: 'Writers', value: totalWriters || 0, icon: FileText, color: 'bg-violet-500', change: '+8%' },
```

The analytics page (`admin/analytics/page.tsx`) correctly computes real growth rates (lines 89-92). The dashboard page should either compute these or remove them to avoid misleading admins.

**Contrast:** The admin analytics page (line 89) properly calculates `subGrowth` from actual monthly data.

---

## Summary Table

| ID | Severity | Category | Description |
|----|----------|----------|-------------|
| UX-001 | HIGH | Accessibility | AlertsDropdown trigger lacks aria-label; badge not announced |
| UX-002 | MEDIUM | Accessibility | Decorative icons missing aria-hidden in dashboard header |
| UX-003 | MEDIUM | Accessibility | Project cards lack focus-visible styling for keyboard users |
| UX-004 | LOW | Accessibility | Player components have excellent ARIA (positive) |
| UX-005 | MEDIUM | Accessibility | Admin sidebar has no active-state indicator or aria-current |
| UX-006 | LOW | Accessibility | Theme toggle and mobile nav have proper ARIA (positive) |
| UX-007 | LOW | States | Good loading/error/empty state coverage (positive) |
| UX-008 | MEDIUM | Validation | New project form lacks inline validation and limit warnings |
| UX-009 | MEDIUM | States | Audit log handles missing table gracefully (positive) |
| UX-010 | MEDIUM | Responsive | Dashboard has proper responsive breakpoints (positive) |
| UX-011 | HIGH | Responsive | Admin sidebar is fixed-width, completely broken on mobile |
| UX-012 | MEDIUM | Validation | Minor dead-code validation in AI demo dialog |
| UX-013 | MEDIUM | Design System | Brand gradient used in 30+ places, not extracted |
| UX-014 | MEDIUM | Design System | Admin dashboard shows hardcoded growth percentages |

**High:** 2 | **Medium:** 8 | **Low:** 4

---

*Review conducted against commit state as of 2026-02-15. All file paths are absolute within the monorepo.*
