# 08 - UI/UX Review

**Date:** 2026-02-18
**Reviewer:** Chris Therriault (chris@servicevision.net)
**Scope:** `packages/web/` -- 26 pages, 60 components
**Framework:** Next.js 14 App Router, Tailwind CSS, Radix UI, lucide-react

---

## Executive Summary

The Story Magic frontend is well-built with consistent design language, good use of Tailwind semantic tokens (`text-foreground`, `bg-muted`, etc.), and solid component patterns via shadcn/ui. The audio players (`ScriptSyncPlayer`, `ProtectedPlayer`) demonstrate exceptional accessibility with proper ARIA roles, keyboard navigation, and focus management.

However, there are gaps in **loading/error boundaries** for several route segments, **missing accessibility attributes** on form controls (particularly the admin settings page), **hardcoded colors** in charts and skeleton components that break dark mode, and a **non-responsive admin sidebar** that collapses the content area on mobile viewports.

**Total findings:** 22
- HIGH: 6
- MEDIUM: 11
- LOW: 5

**Estimated total effort:** 29 SP

---

## 1. Missing Loading States

### UX-001 | HIGH | Missing loading.tsx for /billing route

**File:** `/packages/web/app/billing/page.tsx`
**Line:** 16-23

The billing page is an async server component that runs raw SQL and multiple Prisma queries. There is no `loading.tsx` in the `/billing` directory, so users see a blank white flash or the root-level spinner (which has no skeleton structure matching the billing layout).

```tsx
// app/billing/page.tsx:16-23
export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string };
}) {
  const { userId } = await auth();
  // ... multiple DB queries follow
```

**Impact:** Users see no visual feedback while the billing page loads. On slow connections this can last 2-3 seconds.

**SP Estimate:** 1 SP

**Recommendation:** Add `app/billing/loading.tsx` with a skeleton that mirrors the billing card layout (plan card, usage bar, features list).

---

### UX-002 | MEDIUM | Missing loading.tsx for /reader/dashboard and /writer/dashboard routes

**File:** `/packages/web/app/reader/dashboard/page.tsx`
**Line:** 15-40

**File:** `/packages/web/app/writer/dashboard/page.tsx`
**Line:** 15-41

Both dashboard pages are async server components with multiple Prisma queries (library entries, subscriptions, projects, shares, audio outputs). Neither has a `loading.tsx`. The parent root `loading.tsx` provides only a generic spinner with no skeleton structure.

```tsx
// app/reader/dashboard/page.tsx:25-40
const libraryEntries = await prisma.readerLibrary.findMany({
  where: { readerId: userId, status: { not: 'removed' } },
  include: {
    project: { include: { user: { select: { fullName: true, writerCode: true } } } },
    share: { select: { id: true, sharedBy: true } },
  },
  orderBy: { createdAt: 'desc' },
});
```

**SP Estimate:** 2 SP (1 SP each)

**Recommendation:** Add `loading.tsx` to both `app/reader/dashboard/` and `app/writer/dashboard/` with skeleton cards matching their respective layouts.

---

### UX-003 | MEDIUM | Missing loading.tsx for /projects/new route

**File:** `/packages/web/app/projects/new/page.tsx`

This is a client component so it renders immediately, but it has no initial loading state if the `useAuth()` hook takes time to resolve. Low-risk because Clerk usually resolves quickly, but on first load after session expiry there can be a flash.

**SP Estimate:** 0.5 SP

**Recommendation:** This is lower priority since it is a client component. Consider wrapping the form in a conditional check on `isSignedIn` with a brief skeleton fallback.

---

## 2. Missing Error States

### UX-004 | HIGH | Missing error.tsx for /billing route

**File:** `/packages/web/app/billing/page.tsx`

The billing page executes raw SQL (`prisma.$queryRaw`) which is more error-prone than standard Prisma queries. If the `usage` table does not exist or the query fails, the user gets the generic root error boundary with no billing-specific context or recovery action.

**SP Estimate:** 1 SP

**Recommendation:** Add `app/billing/error.tsx` with a billing-specific error message and a link to contact support or retry.

---

### UX-005 | HIGH | Missing error.tsx for /reader/dashboard and /writer/dashboard

**File:** `/packages/web/app/reader/dashboard/page.tsx`
**File:** `/packages/web/app/writer/dashboard/page.tsx`

These pages make 4-5 parallel Prisma queries each. If any fails, users get the generic root error boundary. Both routes handle authenticated users and should provide role-appropriate error recovery (e.g., "Return to your library" for readers).

**SP Estimate:** 2 SP

**Recommendation:** Add `error.tsx` files for both routes with specific messages and navigation back to the appropriate dashboard.

---

### UX-006 | MEDIUM | Silent error in FeedbackModal catch block

**File:** `/packages/web/components/feedback/FeedbackModal.tsx`
**Line:** 145-148

When feedback submission fails, the error is only logged to console. The modal does not show any user-visible error message, and the loading state is cleared, making it appear as though nothing happened.

```tsx
// FeedbackModal.tsx:145-148
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
```

**SP Estimate:** 1 SP

**Recommendation:** Add an `error` state and display a toast or inline error message: "Failed to submit feedback. Please try again."

---

### UX-007 | MEDIUM | Silent error in ShareModal catch block

**File:** `/packages/web/components/dashboard/share-modal.tsx`
**Line:** 87-89

When share link creation fails, the error is logged to console but no user-visible feedback is provided.

```tsx
// share-modal.tsx:87-89
    } catch (error) {
      console.error('Failed to create share:', error);
    } finally {
```

**SP Estimate:** 0.5 SP

**Recommendation:** Add a toast notification on failure: "Failed to create share link. Please try again."

---

## 3. Missing Empty States

### UX-008 | LOW | No empty state for admin analytics recent activity

**File:** `/packages/web/app/admin/analytics/page.tsx`
**Line:** 344-346, 371-373

Empty states exist for "recent projects" and "recent shares" sections in the analytics page, which is good. However, the daily signups chart shows empty bars (height: 4px) with no explanatory text when there are zero signups across all 7 days, which could confuse administrators.

```tsx
// analytics/page.tsx:249-261 - Shows 7 tiny bars with "0" labels when no signups
<div className="flex items-end justify-between h-40 gap-2">
  {last7DaysSignups.map((day, i) => (
    // When all counts are 0, maxSignups is 1, so bars are 4px tall
```

**SP Estimate:** 0.5 SP

**Recommendation:** When `maxSignups === 0`, show a centered "No signups in the last 7 days" message instead of the chart.

---

## 4. Accessibility

### UX-009 | HIGH | Admin settings Switch components lack accessible labels

**File:** `/packages/web/app/admin/settings/page.tsx`
**Lines:** 56, 79, 86, 93, 128, 151, 158, 165, 172

Nine `<Switch />` components are rendered without `id`, `aria-label`, or `aria-labelledby` attributes. While they appear visually next to label text, there is no programmatic association. Screen readers will announce these as unlabeled toggle switches.

```tsx
// settings/page.tsx:51-57
<div className="flex items-center justify-between">
  <div>
    <Label>Maintenance Mode</Label>
    <p className="text-sm text-muted-foreground">Temporarily disable user access</p>
  </div>
  <Switch />   {/* No id, no aria-label, no htmlFor on Label */}
</div>
```

This pattern repeats for all 9 switches on this page.

**SP Estimate:** 1 SP

**Recommendation:** Add `id` to each `Switch` and corresponding `htmlFor` to the `Label`, or add `aria-label` directly:
```tsx
<Switch id="maintenance-mode" aria-label="Toggle maintenance mode" />
```

---

### UX-010 | HIGH | Admin audit-log filter uses plain <input> without label

**File:** `/packages/web/app/admin/audit-log/page.tsx`
**Line:** 142-147

A plain `<input>` element is used without any `<label>` or `aria-label` attribute. Screen readers cannot identify this field.

```tsx
// audit-log/page.tsx:142-147
<input
  type="text"
  name="action"
  placeholder="Action (e.g., user.login)"
  defaultValue={actionFilter}
  className="px-3 py-2 border rounded-md bg-background text-sm"
/>
```

**SP Estimate:** 0.5 SP

**Recommendation:** Add `aria-label="Filter by action"` to the input element, or wrap it with a `<Label>`.

---

### UX-011 | MEDIUM | Admin filter <select> elements lack accessible labels

**File:** `/packages/web/app/admin/users/page.tsx`
**Line:** 139-148

**File:** `/packages/web/app/admin/subscriptions/page.tsx`
**Lines:** 146-152, 153-162

**File:** `/packages/web/app/admin/audit-log/page.tsx`
**Lines:** 149-157

Multiple native `<select>` elements are used without associated `<label>` elements or `aria-label` attributes. The first `<option>` text ("All Types", "All Statuses", etc.) serves as the only cue, which is insufficient for screen readers.

```tsx
// users/page.tsx:139-148
<select
  name="type"
  defaultValue={userType}
  className="px-3 py-2 border rounded-md bg-background"
>
  <option value="">All Types</option>
  ...
</select>
```

**SP Estimate:** 1 SP

**Recommendation:** Add `aria-label` to each select: `aria-label="Filter by user type"`, `aria-label="Filter by status"`, etc.

---

### UX-012 | MEDIUM | Pricing page interval toggle buttons lack ARIA role

**File:** `/packages/web/app/pricing/page.tsx`
**Lines:** 73-96

The Monthly/Yearly toggle uses plain `<button>` elements without `role="radio"`, `aria-pressed`, or `aria-checked` to communicate selection state to assistive technology. Visual styling changes on selection but this is not conveyed programmatically.

```tsx
// pricing/page.tsx:73-80
<button
  onClick={() => setInterval('monthly')}
  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
    interval === 'monthly'
      ? 'bg-violet-100 dark:bg-violet-900/30 ...'
      : 'text-muted-foreground hover:text-foreground'
  }`}
>
  Monthly
</button>
```

**SP Estimate:** 1 SP

**Recommendation:** Wrap in a `role="radiogroup"` container and add `role="radio"` with `aria-checked` to each button:
```tsx
<div role="radiogroup" aria-label="Billing interval">
  <button role="radio" aria-checked={interval === 'monthly'} ...>Monthly</button>
  <button role="radio" aria-checked={interval === 'yearly'} ...>Yearly</button>
</div>
```

---

### UX-013 | MEDIUM | Reader upload drop zone lacks ARIA attributes

**File:** `/packages/web/components/reader/upload-client.tsx`
**Lines:** 288-296

The drag-and-drop upload zone is a `<div>` with drag handlers but no ARIA role or label. The hidden file input inside has no accessible label. Users relying on assistive technology cannot discover or use this interaction pattern.

```tsx
// upload-client.tsx:288-296
<div
  className={`border-2 border-dashed rounded-lg p-12 ...`}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  ...
  <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileSelect} />
```

**SP Estimate:** 1 SP

**Recommendation:** Add `role="region"` and `aria-label="Upload area"` to the drop zone div. Add `aria-label="Select PDF file"` and an `id` to the hidden input. Associate the visible button via `htmlFor`.

---

### UX-014 | LOW | Upload client clear button lacks aria-label

**File:** `/packages/web/components/reader/upload-client.tsx`
**Line:** 365-367

```tsx
<Button variant="ghost" size="icon" onClick={handleClearFile}>
  <X className="w-4 h-4" />
</Button>
```

This icon-only button has no `aria-label`. Screen readers will announce it as an empty button.

**SP Estimate:** 0.5 SP

**Recommendation:** Add `aria-label="Remove file"`.

---

## 5. Responsive Design

### UX-015 | HIGH | Admin sidebar is fixed at 64rem and hides content on mobile

**File:** `/packages/web/app/admin/layout.tsx`
**Lines:** 50, 84

The admin sidebar is fixed at `w-64` (256px) and the main content has `pl-64`. There are no responsive breakpoints or mobile navigation. On viewports under ~768px, the sidebar and content will overlap, making the admin panel unusable on tablets and phones.

```tsx
// admin/layout.tsx:50
<aside className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 ...">

// admin/layout.tsx:84
<main className="pl-64">
```

**SP Estimate:** 3 SP

**Recommendation:** Implement a responsive admin layout:
- Hide sidebar on mobile (`hidden md:block`)
- Add a hamburger menu toggle for mobile
- Use `md:pl-64` instead of `pl-64` on main content
- Add a slide-over sidebar for mobile viewports

---

### UX-016 | MEDIUM | Admin tables lack horizontal scroll on narrow viewports

**File:** `/packages/web/app/admin/users/page.tsx`
**Line:** 168

**File:** `/packages/web/app/admin/subscriptions/page.tsx`
**Line:** 182

**File:** `/packages/web/app/admin/audit-log/page.tsx`
**Line:** 178

Admin tables have 6-7 columns with no horizontal scroll wrapper. On narrow viewports (even desktop windows resized), content will overflow and be clipped.

```tsx
// users/page.tsx:168
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>User</TableHead>
      <TableHead>Type</TableHead>
      <TableHead>Code</TableHead>
      <TableHead>Subscription</TableHead>
      <TableHead>Projects</TableHead>
      <TableHead>Joined</TableHead>
      <TableHead className="w-[50px]"></TableHead>
    </TableRow>
  </TableHeader>
```

**SP Estimate:** 1 SP

**Recommendation:** Wrap each `<Table>` in `<div className="overflow-x-auto">` to enable horizontal scrolling when content exceeds viewport width.

---

## 6. Form Validation

### UX-017 | MEDIUM | New project form lacks minimum script length validation

**File:** `/packages/web/app/projects/new/page.tsx`
**Line:** 209-228

The script textarea uses `required` (HTML5 validation) but has no minimum length check. A user could submit a single character as a script. The page count estimate (`wordCount / 250`) would show `~1 page` even for meaningless input.

```tsx
// projects/new/page.tsx:209-228
<Textarea
  id="script"
  value={scriptText}
  onChange={(e) => setScriptText(e.target.value)}
  required
  rows={20}
  className="font-mono text-sm resize-none"
  ...
/>
```

**SP Estimate:** 1 SP

**Recommendation:** Add minimum word count validation (e.g., 50 words) with a visible warning below the textarea. Disable the submit button if the word count is below minimum.

---

### UX-018 | LOW | Share modal email tab allows sending without creating a link first

**File:** `/packages/web/components/dashboard/share-modal.tsx`
**Lines:** 225-229

The email tab disables the "Open Email Client" button when `!shareUrl`, but the UX flow is confusing. A user might fill in the email, then be blocked with no clear indication that they need to switch to the "Link" tab first. The hint text at line 237 is small and easy to miss.

```tsx
// share-modal.tsx:225-229
<Button
  className="w-full"
  onClick={handleEmailShare}
  disabled={!recipientEmail || !shareUrl}
>
```

**SP Estimate:** 1 SP

**Recommendation:** Either auto-create the share link when the email tab is selected, or show a prominent callout: "Create a share link on the Link tab first" instead of just disabling the button.

---

## 7. Dark Mode

### UX-019 | MEDIUM | Pricing skeleton uses hardcoded bg-slate-200 without dark variant

**File:** `/packages/web/app/pricing/page.tsx`
**Lines:** 222-228

The pricing page fallback skeleton uses `bg-slate-200` for placeholder elements. In dark mode, these appear as bright gray blocks against the dark background, creating poor contrast.

```tsx
// pricing/page.tsx:222-228
<CardHeader>
  <div className="h-6 w-24 bg-slate-200 rounded" />
  <div className="h-4 w-32 bg-slate-200 rounded mt-2" />
</CardHeader>
<CardContent className="space-y-4">
  <div className="h-10 w-20 bg-slate-200 rounded" />
  <div className="h-20 bg-slate-200 rounded" />
  <div className="h-10 bg-slate-200 rounded" />
</CardContent>
```

**SP Estimate:** 0.5 SP

**Recommendation:** Replace `bg-slate-200` with `bg-muted` (which is theme-aware) or use `bg-slate-200 dark:bg-slate-800`.

---

### UX-020 | MEDIUM | Hardcoded hex colors in charts and code editor break dark mode

**File:** `/packages/web/components/revisions/ScoreTrajectoryChart.tsx`
**Lines:** 166-167, 200, 206, 223-233

**File:** `/packages/web/components/storyscore/StoryScore.tsx`
**Lines:** 120-123, 137

**File:** `/packages/web/components/script-editor/ScriptEditor.tsx`
**Lines:** 76-79

Multiple components use hardcoded hex colors (`#8b5cf6`, `#22c55e`, `#f59e0b`, etc.) for SVG strokes, fills, and code editor highlighting. While these specific violet/green/amber values happen to work acceptably in dark mode, the `#fff` stroke on chart dots (line 227) and the `#0891b2`/`#64748b` code editor colors have poor contrast in dark mode.

```tsx
// ScoreTrajectoryChart.tsx:226-227
  fill: '#8b5cf6',
  stroke: '#fff',    // White stroke is invisible against light backgrounds

// ScriptEditor.tsx:76-79
{ tag: tags.heading, color: '#4f46e5', fontWeight: 'bold' },
{ tag: tags.keyword, color: '#0891b2', fontWeight: 'bold' },
{ tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
{ tag: tags.operator, color: '#dc2626', fontWeight: 'bold' },
```

**SP Estimate:** 2 SP

**Recommendation:** For the code editor, detect theme and swap color palettes. For charts, use CSS variables or the Tailwind color system with dark mode variants. Replace `#fff` stroke with a theme-aware token.

---

### UX-021 | LOW | Swagger UI uses hardcoded border/background colors

**File:** `/packages/web/components/docs/swagger-ui.tsx`
**Lines:** 37, 62

```tsx
border-bottom: 1px solid #e5e7eb;
background: #0f172a;
```

**SP Estimate:** 0.5 SP

**Recommendation:** Use CSS variables from the theme system or Tailwind's `hsl(var(--border))` and `hsl(var(--background))` values.

---

### UX-022 | LOW | GenerateButton dev log panel uses hardcoded slate-900 colors

**File:** `/packages/web/app/projects/[id]/generate-button.tsx`
**Lines:** 335-347

The dev log panel uses hardcoded dark colors (`bg-slate-900`, `text-slate-300`, `text-slate-500`, `text-violet-400`, `text-green-400`) which work in both modes since it is designed as a dark terminal, but in light mode the transition from the light page to a dark terminal block is jarring. This is a minor UX concern, not a functional issue.

```tsx
// generate-button.tsx:335
<div className="mt-4 p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 ...">
```

**SP Estimate:** 0.5 SP

**Recommendation:** Consider removing the dev log panel before production, or gating it behind a `NEXT_PUBLIC_DEV_MODE` flag. If kept, the hardcoded dark theme is intentional for a terminal aesthetic and is acceptable.

---

## Coverage Summary

### Loading States

| Route | loading.tsx | Status |
|-------|:-----------:|--------|
| `/` (root) | Yes | Generic spinner |
| `/dashboard` | Yes | Skeleton cards |
| `/projects/[id]` | Yes | Skeleton layout |
| `/admin` | Yes | Skeleton with stats + table |
| `/billing` | **No** | UX-001 |
| `/reader/dashboard` | **No** | UX-002 |
| `/writer/dashboard` | **No** | UX-002 |
| `/projects/new` | N/A | Client component |
| `/pricing` | Yes | Suspense fallback |
| `/guide` | N/A | Static content |

### Error Boundaries

| Route | error.tsx | Status |
|-------|:---------:|--------|
| `/` (root) | Yes | Generic |
| `/dashboard` | Yes | Dashboard-specific |
| `/projects/[id]` | Yes | Project-specific |
| `/admin` | Yes | Admin-specific |
| `/billing` | **No** | UX-004 |
| `/reader/dashboard` | **No** | UX-005 |
| `/writer/dashboard` | **No** | UX-005 |

### Empty States

| Component | Empty State | Status |
|-----------|:-----------:|--------|
| Dashboard projects list | Yes | Excellent CTA card |
| Admin users table | Yes | "No users found" |
| Admin subscriptions table | Yes | "No subscriptions found" |
| Admin audit log table | Yes | "No audit log entries" |
| Admin recent users/subs | Yes | "No recent signups/subscriptions" |
| Analytics recent activity | Yes | Text fallbacks |
| Analytics signups chart | Partial | UX-008 |
| Share page no audio | Yes | "Audio Not Ready" card |
| Invite page error | Yes | "Invalid Invite" card |

### Accessibility Highlights (Good)

- `ScriptSyncPlayer`: Full ARIA slider, keyboard nav, `aria-label` on all buttons, `aria-hidden` on icons, `role="button"` on clickable lines
- `ProtectedPlayer`: ARIA slider, keyboard shortcuts, `role="group"`, `role="listbox"` for scene list, `aria-expanded` toggles
- `MobileNav`: `aria-expanded`, `aria-label` on toggle, `aria-hidden` on icons
- `ThemeToggle`: Dynamic `aria-label` based on current theme
- Admin dashboard: `aria-hidden="true"` on decorative icons
- Footer links: `focus-visible` styles on all links

---

## Priority Tiers

### P0 - Fix Before Staging (8 SP)
- UX-001: Billing loading.tsx (1 SP)
- UX-004: Billing error.tsx (1 SP)
- UX-005: Reader/Writer dashboard error.tsx (2 SP)
- UX-009: Admin settings Switch labels (1 SP)
- UX-015: Admin sidebar responsive (3 SP)

### P1 - Fix Before Production (12 SP)
- UX-002: Reader/Writer dashboard loading.tsx (2 SP)
- UX-006: FeedbackModal silent error (1 SP)
- UX-010: Audit-log input label (0.5 SP)
- UX-011: Admin select labels (1 SP)
- UX-012: Pricing toggle ARIA (1 SP)
- UX-016: Admin table overflow scroll (1 SP)
- UX-017: Script min length validation (1 SP)
- UX-019: Pricing skeleton dark mode (0.5 SP)
- UX-020: Chart/editor hardcoded colors (2 SP)

### P2 - Post-Launch Polish (9 SP)
- UX-003: New project loading (0.5 SP)
- UX-007: ShareModal silent error (0.5 SP)
- UX-008: Analytics empty chart state (0.5 SP)
- UX-013: Upload drop zone ARIA (1 SP)
- UX-014: Upload clear button label (0.5 SP)
- UX-018: Share modal email tab UX (1 SP)
- UX-021: Swagger UI hardcoded colors (0.5 SP)
- UX-022: Dev log panel cleanup (0.5 SP)
