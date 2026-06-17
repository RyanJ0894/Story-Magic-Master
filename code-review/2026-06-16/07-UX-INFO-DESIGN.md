# UX/Information Design Audit — 2026-06-16

**Scope:** Delta from 2026-06-14. Window covers commits `dcc4cca` → `a4a55f4` (10 commits, including PRs #296, #298, #299, #304, #308, #310 and `ef292ad` UX-polish bundle). The 2026-06-14 review's full P1/P2 backlog was landed by `ef292ad` — see "Prior-Round Status" below. New findings concentrate around the brand-new Audio Tuning surface (PRs #299/#310/#308) and the PWA install-prompt rewrite (#304).

## Summary
- 0 P0 findings
- 1 P1 finding (NEW — audio tuning unsaved-changes loss)
- 4 P2 findings (all NEW — audio tuning a11y/dirty-state/preview UX, PWA dismiss persistence)

## Prior-Round Status

| Prior ID | Status | Notes |
|----------|--------|-------|
| UX-G-01 (`window.confirm` × 7) | **RESOLVED** | `components/ui/confirm-dialog.tsx` shipped. `grep window.confirm` over `app/`+`components/` returns zero non-comment hits. `project-workflow.tsx:287` and `team/page.tsx:506` carry "replaces window.confirm" headers — all 7 sites refactored. |
| UX-H-01 (`toLocaleString()` × 5) | **RESOLVED** | `lib/format.ts::fmtInt()` shipped with a useful comment justifying the helper. All 5 prior sites now use `fmtInt()` or an explicit `'en-US'` arg. Remaining `toLocaleString()` calls are intentional (`run-selector.tsx` dates, `date-time.tsx`, `email/impact.ts`). |
| UX-G-03 (Wizard `max-h-[400px]` no scrollbar) | **RESOLVED** | `ScriptImprovementWizard.tsx:288` now wraps in `<ScrollArea className="max-h-[400px] pr-2">`. |
| UX-H-02 (`ScriptSyncPlayer` lyric pane clipping) | **RESOLVED** | `ScriptSyncPlayer.tsx:438` introduces `<ScrollArea className={cn(expanded ? 'h-[calc(100vh-200px)]' : 'h-[350px]')}>` inside the existing wrapper. Inner outer `max-h-[400px]` at line 424 is now redundant but not harmful. |
| UX-E-10 (Drop zone keyboard) | **RESOLVED** | `upload-client.tsx:247-251` adds `tabIndex={0}` and `onKeyDown` (Enter/Space). |

**All 5 carryover items closed in one PR (`ef292ad`).** Strong follow-through.

## P0 Findings

None.

## P1 Findings

### [NEW] UX-I-01 — Audio Tuning loses preview iteration on navigation — `components/settings/AudioTuningPanel.tsx:47-51`
**Issue:** The panel is built around an explicit "preview many times → lock once" workflow (per `CardDescription` line 132 and the lock card copy line 245). Users are encouraged to generate multiple test previews before locking. However:

1. There is **no `beforeunload` warning** when `dirty === true`. If the user clicks any nav link (sidebar back to `/settings`, the in-page `<Link href="/settings">` at `audio/page.tsx:29`, or the browser back button) after spending 5+ minutes generating previews, all slider positions silently vanish — the page reloads from `initial` on return.
2. When the row is already `locked: true` and the user moves a slider, the **Unlock button is shown** (line 252-260) but there is no "Save without locking" path — the only way to persist changes is to click Unlock (which calls `saveTuning({ lock: false })` with the *current slider values* — see line 253). That works, but the button label says "Unlock" not "Save changes". The user moving sliders on a locked row has no signal that clicking Unlock will overwrite their locked values with the current slider state. A careful user expecting "Unlock = revert to defaults" or "Unlock = keep saved values, just allow edits" gets neither.

**Fix:**
```tsx
useEffect(() => {
  if (!dirty) return;
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = ''; // Chrome
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  return () => window.removeEventListener('beforeunload', onBeforeUnload);
}, [dirty]);
```
And split the locked-state action row into two buttons: `Unlock (keep current saved values)` and `Save & re-lock with new values` — the latter only enabled when `dirty`. Or, simpler: rename the locked-state button from "Unlock" to "Unlock to edit" and add an inline note: "Sliders will revert to your locked values" + a `useEffect` that resets sliders to `initial` on unlock.

**Cost:** 1.5 SP

## P2 Findings (Polish)

### [NEW] UX-I-02 — Audio Tuning sliders have no programmatic label association — `components/settings/AudioTuningPanel.tsx:294-302`
**Issue:** `SliderRow` renders `<label className="text-sm font-medium">{label}</label>` as a sibling of `<Slider>` (Radix). The label has no `htmlFor` and the Slider's underlying thumb has no `aria-labelledby` or `aria-label`. Screen-reader users hear "slider, -8 to 8" with no information about which axis (music? ambience? speed?). The visual `displayValue` ("+2 dB (default -12 dB → -10)") is also invisible to AT.
**Fix:** Add `aria-label` to the Slider prop and forward it to the Radix root, or wrap the slider thumb with the label via `aria-labelledby`:
```tsx
<Slider
  aria-label={`${label}, currently ${displayValue}`}
  min={min} max={max} step={step}
  value={[value]}
  onValueChange={(vs) => onChange(vs[0])}
/>
```
Requires forwarding `aria-label` through `components/ui/slider.tsx` to `SliderPrimitive.Root` (Radix supports it but the current wrapper doesn't pass it).
**Cost:** 0.5 SP

### [NEW] UX-I-03 — Audio Tuning "Reset to defaults" can silently disable Lock — `components/settings/AudioTuningPanel.tsx:61-66, 262`
**Issue:** `dirty` is computed against `initial` (the row loaded from DB at SSR time). If the user has saved-non-locked tuning equal to defaults, then clicks "Reset to defaults", `dirty` becomes `false` and the Lock button at line 262 disables — but the slider positions are correct, the user *wants* to lock them. More commonly: user moves sliders, previews, clicks Reset, moves sliders again to exact same `initial` values, lock disables despite slider activity. Reset should set `dirty=true` whenever `initial !== defaults`, or the Lock button gating should be against "values differ from currently-saved-locked-state" not "values differ from `initial`".
**Fix:** Compute `dirty` against `DEFAULT_AUDIO_TUNING` when `!initial.locked`, and against `initial` when `initial.locked`. Or simpler — drop the `!dirty` gate from Lock entirely (line 262) and let the user lock any state, including defaults.
**Cost:** 0.5 SP

### [NEW] UX-I-04 — Audio Tuning preview audio stale-source flash — `components/settings/AudioTuningPanel.tsx:53-59, 225-232`
**Issue:** The `<audio>` element uses a child `<source>` tag whose `src` is bound to `previewUrl`. When `previewUrl` changes (second preview), React updates the `<source>` `src` attribute, then `useEffect` calls `audio.load()`. Between React commit and the `audio.load()` call, the `<audio>` element still has the old buffered media — Safari and Firefox briefly display the old duration on the controls. Also: there is no busy state on the player while a new preview is being generated; the previous preview remains playable, which is confusing because the user just moved sliders and expects the player to reflect new settings.
**Fix:** Either bind `src` directly on `<audio>` (not via child `<source>`) and use `key={previewUrl}` to force a clean remount; or hide the player block while `previewing === true`:
```tsx
{previewUrl && !previewing && (
  <div className="...">
    <audio key={previewUrl} ref={audioRef} controls className="w-full" src={previewUrl} preload="metadata" />
  </div>
)}
```
**Cost:** 0.5 SP

### [NEW] UX-I-05 — PWA install prompt dismiss is permanent, no resurfacing — `components/pwa/PwaInstallPrompt.tsx:19, 52-55`
**Issue:** `#304` correctly fixed the console-flood bug. But `handleDismiss` writes `pwa-install-dismissed = '1'` to localStorage with no TTL and no per-version key. A user who dismisses on day 1 will never see the prompt again, even months later when they're a regular user on mobile. Industry pattern: re-show after 30 days, or after N sessions. Also no analytics event on dismiss vs. install — there is no way to know whether the prompt is working.
**Fix:** Store an ISO timestamp instead of `'1'`, and re-show after 30 days:
```ts
const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// ...
const dismissedAt = localStorage.getItem(DISMISS_KEY);
if (dismissedAt && Date.now() - new Date(dismissedAt).getTime() < DISMISS_TTL_MS) return;
```
And add a `posthog.capture('pwa_install_prompt_dismissed' | '_installed')` for instrumentation parity with the rest of the onboarding funnel.
**Cost:** 0.5 SP

## Items Verified Clean

- `app/settings/audio/page.tsx` — clean SSR page, only 49 lines, single link back, no information overload.
- `app/settings/page.tsx:107-137` — new Audio Tuning card is well-scoped: badge ("New"), single CTA, no nested fields. Mirrors the existing notification/billing card pattern.
- `AudioTuningPanel` color contrast: amber lock-card text uses `text-amber-900 dark:text-amber-100` on `bg-amber-50 dark:bg-amber-950/30` — passes WCAG AA in both modes.
- `AudioTuningPanel` mobile: `flex flex-wrap gap-2` action row (line 204) wraps cleanly under 360px.
- Toast error paths in `AudioTuningPanel` (lines 86, 92, 114, 120) — every error path renders a Sonner toast. No dead error states.
- `PwaInstallPrompt` is appropriately small (4 lines of copy, 2 buttons) and dismissible — no progressive-disclosure issue.
- Listen UI alignment (#207 fix at `lib/listen/alignment-mapper.ts`) — pure logic change, no UI surface affected.
- `dashboard/reader-dashboard-client.tsx` + `reader-script-card.tsx` (#296 progress clamp) — pure numerical clamp, no new info-design concerns.
- `run-selector.tsx` `toLocaleString(undefined, ...)` calls (lines 105, 184) — intentional locale-respecting date/time, correct usage.
- No new `max-h-[...]` over DB-sourced lists. No new onboarding banners.

## Sprint Plan

| ID | SP | Title | File:Line | Priority |
|----|-----|-------|-----------|----------|
| UX-I-01 | 1.5 | Audio tuning `beforeunload` warning + clarify locked-row Unlock semantics | `AudioTuningPanel.tsx:47-51, 252-260` | P1 |
| UX-I-02 | 0.5 | Slider `aria-label` forwarding for screen readers | `AudioTuningPanel.tsx:297`, `components/ui/slider.tsx` | P2 |
| UX-I-03 | 0.5 | Drop `!dirty` gate on Lock button (or recompute dirty vs. locked baseline) | `AudioTuningPanel.tsx:262` | P2 |
| UX-I-04 | 0.5 | Preview player: key by URL, hide while previewing | `AudioTuningPanel.tsx:225-232` | P2 |
| UX-I-05 | 0.5 | PWA dismiss TTL (30d) + instrumentation | `PwaInstallPrompt.tsx:19, 52-55` | P2 |

**Total SP:** 3.5 — **P0:** 0 | **P1:** 1.5 | **P2:** 2.0

**Trend:** Down from 5.5 SP (2026-06-14) to 3.5 SP. The `ef292ad` polish PR cleared the entire prior-round backlog in one shot. New findings are all on the brand-new Audio Tuning surface (PRs #299/#310 just shipped two days ago) — none are critical, but UX-I-01 should land before the page is featured in any GTM email, because losing 5 minutes of preview tuning to a stray nav click is the kind of paper cut that turns a power user against the feature. Recommendation: bundle UX-I-01 through UX-I-04 into a single "Audio Tuning polish" PR (3.0 SP); UX-I-05 can ship independently with any PWA-related work.
