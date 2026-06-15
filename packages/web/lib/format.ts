/**
 * Formatting helpers.
 *
 * `fmtInt` exists to head off a hydration-warning class of bug surfaced by
 * the 2026-06-14 UX review: `.toLocaleString()` without an explicit locale
 * returns server-environment-dependent output (Node may default to en-US-POSIX
 * while the browser uses the user's actual locale), causing React 18+ to flag
 * a hydration mismatch on SSR pages like `/billing`.
 *
 * Use this for any non-currency integer rendering in user-facing copy:
 *   - word counts ("12,345 words")
 *   - quota numbers ("Generate up to 1,000 audio segments")
 *   - input length errors ("Script text exceeds 200,000 characters")
 *
 * For currency, build a real Intl.NumberFormat with the right currency code.
 */

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
