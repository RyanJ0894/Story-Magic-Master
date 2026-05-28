# UX/Information Design Audit — 2026-05-27 (delta vs 2026-05-26)

**Scope:** Delta review of files changed since 2026-05-26.
**Audited:** `app/invite/[token]/page.tsx`, `app/enterprise/team/page.tsx`, `app/projects/[id]/generate-button.tsx`, `components/BuildStamp.tsx`, `app/layout.tsx`.
**Prior review:** `code-review/2026-05-26/07-UX-INFO-DESIGN.md` — all 16 of its prior findings were resolved; its 7-item sprint plan (UX-S-01..07) targets `shares/page.tsx` and `share-modal.tsx`, which are **out of scope** for this delta and not re-verified here.

The changed files are mostly mature. There is **one real production-facing P1** (a "dev mode" debug panel rendered to all users), one P2 information-hierarchy issue on the invite page, and two P2 polish items. No P0s.

---

## P0 Findings

None in the delta files.

---

## P1 Findings

### [NEW] "Dev Log Panel" rendered to all users in production — `app/projects/[id]/generate-button.tsx:409-422`

**Issue:**
During every audio generation, a dark "Generation Log (dev mode)" panel is rendered unconditionally below the progress bar. It exposes raw `Job ID`, `Status`, `Step`, `Progress %`, and `details` to every end user — including external/enterprise customers. There is no `NODE_ENV`/feature-flag gate (confirmed: no `process.env` reference in the file). The label literally says "(dev mode)", so it reads as leaked internal tooling. It also adds cognitive load: the user already has a clean progress header (`getStepLabel`), main progress bar, percent, details line, and a "Safe to leave" notice — the dev panel duplicates all of that in mono font. This is the most prominent block on the screen during the 2-minute generation, competing with the real status UI.

**Fix:**
Gate it behind dev-only rendering (and/or a debug flag), e.g. wrap the block:
```tsx
{process.env.NODE_ENV !== 'production' && (
  <div className="mt-4 p-3 bg-slate-900 rounded-lg ...">
    {/* Dev Log Panel */}
  </div>
)}
```
**Cost:** 1 SP

---

## P2 Findings (Polish)

### [NEW] Invite page shows "Accept Invitation" to signed-out users; failure path only triggers on click — `app/invite/[token]/page.tsx:207-299, 89-130`

**Issue:**
A signed-out visitor who opens an invite link sees the full invite card with a primary "Accept Invitation" button. Clicking it POSTs, the server returns `AUTH_REQUIRED`, and only then is the "Create your account" state shown (line 105-108). The happy auto-accept-after-signup flow is handled well (lines 72-87), but the first-click experience for a brand-new user is a button that appears actionable but actually round-trips to a different screen. The primary CTA should reflect the user's actual next step (sign up) rather than implying one-click acceptance.

**Fix (minimal):**
When `clerkLoaded && !isSignedIn`, render the primary button as a sign-up link instead of `Accept`, reusing the existing `needsAuth` markup/CTA (`/sign-up?redirect_url=/invite/${token}`). Keeps a single clear next action and avoids the failed-POST detour.
**Cost:** 1 SP

### [NEW] Team member + pending lists have no scroll container — long lists push page — `app/enterprise/team/page.tsx:251-277, 290-313`

**Issue:**
Both the active members list (`space-y-2`, line 251) and pending invitations list (line 290) render every row with no `max-h`/`overflow-y-auto`. Each row is ~56px. A team of 30 members + 15 pending invites produces ~2,500px of stacked rows inside the "Members" card, far exceeding the side-by-side `lg:grid-cols-2` layout's other column (the Invite form) and forcing a long scroll. Real-data scale: an enterprise "Answers Film LLC" team could easily hit 20-50 people. Mild today (most teams are small), hence P2, but it is the standard unbounded-DB-list pattern.

**Fix:**
Wrap each list's inner `<div className="space-y-2">` in `<div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">`.
**Cost:** 1 SP

### [NEW] Invite-page auto-accept logs token prefix to console on every accept — `app/invite/[token]/page.tsx:92-93, 101-102`

**Issue:**
`console.log('[Invite] Accepting token', token.slice(0, 8) + '...')` and the response log fire in production for all users. Low severity (8-char prefix, not full token), but it is noise in the console for a shipped page and pairs with the BuildStamp console log; worth removing or gating with the same dev check as the panel above.

**Fix:** Remove the two `console.log` calls (or gate behind `NODE_ENV !== 'production'`). The eslint-disable comments are already there, signalling they were meant to be temporary.
**Cost:** 0.5 SP

---

## Well-Designed in the Delta (no issues)

- **`BuildStamp.tsx`** — tiny, `pointer-events-none` footer in `layout.tsx`, `select-none`, `title` shows full ISO time. Clean deployment-verification affordance, zero layout cost. No issues.
- **`layout.tsx`** — skip-to-content link, nonce-based CSP wiring, single `<main id="main-content">`, Toaster top-right. Solid a11y/info-hierarchy baseline.
- **`generate-button.tsx` progress UX** (aside from the dev panel) — queue position card with est. wait, retry badge, step labels via `getStepLabel`, timer + actual progress reconciliation, and an explicit "Safe to leave" reassurance for a long job. Strong long-process feedback design. Session-expiry handling (3-strike 401 → reload toast) is a good error-state.
- **`team/page.tsx` destructive actions** — both remove-member and cancel-invite have `window.confirm` with the member name (carryover UX-M-08 confirmed still present). Empty states present for both no-teams and no-members. Pending vs active visually distinguished (dashed border, muted).
- **`invite/[token]/page.tsx` state machine** — loading / error / success / needsAuth / main are cleanly separated; auto-accept-after-signup and double-accept (`autoAcceptAttempted` ref + INVALID_STATUS=accepted → success) edge cases are handled well.

---

## Sprint Plan

| ID | SP | Title | File:Line | Priority |
|----|-----|-------|-----------|----------|
| UX-D-01 | 1 | [NEW] Gate "Dev Log Panel" behind NODE_ENV (hide from prod users) | `app/projects/[id]/generate-button.tsx:409` | P1 |
| UX-D-02 | 1 | [NEW] Invite page: show sign-up CTA to signed-out users instead of Accept | `app/invite/[token]/page.tsx:278` | P2 |
| UX-D-03 | 1 | [NEW] Team page: scroll containers on member + pending lists | `app/enterprise/team/page.tsx:251,290` | P2 |
| UX-D-04 | 0.5 | [NEW] Remove/gate invite-accept console.log calls | `app/invite/[token]/page.tsx:92,101` | P2 |

**Total SP:** 3.5 — **P0:** 0 | **P1:** 1 | **P2:** 2.5

**Audit completed:** 2026-05-27
