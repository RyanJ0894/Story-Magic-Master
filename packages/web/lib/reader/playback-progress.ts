/**
 * Playback-progress helpers for the reader dashboard.
 *
 * Closes #208 — "Recently Played" was showing nonsense percentage values
 * (>100%, NaN, or absent) when:
 *
 *   - The audio was re-generated to a shorter duration than the user's saved
 *     position (so position > duration, ratio > 1.0).
 *   - The job didn't write `duration_seconds` (early-run rows are null/0,
 *     ratio is NaN or Infinity).
 *   - The position itself was null (older rows pre-tracking).
 *
 * The text label site (`reader-dashboard-client.tsx::formatPercentComplete`)
 * had been hardened back in #178-era to clamp + handle missing duration, but
 * the matching <Progress> bar component sites in `reader-script-card.tsx`
 * were never updated. They still did the naive `(position / duration) * 100`
 * which fed >100% values into Radix's <Progress> — which renders the bar
 * overflowing its container.
 *
 * This module is the single source of truth for the calculation. Both label
 * + bar sites call into it, so they can't drift again.
 */

/**
 * Return playback progress as a percentage in [0, 100]. Safe against:
 *   - Missing / zero / negative `durationSeconds`
 *   - Missing / negative `positionSeconds`
 *   - `positionSeconds > durationSeconds` (returns 100, not >100)
 *   - NaN / Infinity inputs (returns 0)
 *
 * Returns 0 for any input we can't sensibly compute.
 */
export function computePlaybackProgress(
  positionSeconds: number | null | undefined,
  durationSeconds: number | null | undefined,
): number {
  if (positionSeconds == null || durationSeconds == null) return 0;
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) return 0;
  if (durationSeconds <= 0) return 0;
  if (positionSeconds <= 0) return 0;

  const raw = (positionSeconds / durationSeconds) * 100;
  if (!Number.isFinite(raw)) return 0;

  return Math.max(0, Math.min(100, raw));
}

/**
 * Format the user-facing "X% complete" label. Returns "In progress" when
 * duration is unknown (so we don't show a misleading 0% to the user when
 * the data is simply missing).
 */
export function formatPercentComplete(
  positionSeconds: number | null | undefined,
  durationSeconds: number | null | undefined,
): string {
  if (!durationSeconds || durationSeconds <= 0) return 'In progress';
  const pct = Math.round(computePlaybackProgress(positionSeconds, durationSeconds));
  return `${pct}% complete`;
}
