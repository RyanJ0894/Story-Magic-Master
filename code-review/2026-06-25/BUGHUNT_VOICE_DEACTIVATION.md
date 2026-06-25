# Bug hunt — voice deactivation on `server_degraded` (5xx)

**Date:** 2026-06-25 EOD
**Triggering log:** `voice GKENfjE5T9SchZnnzOcf returned 500 (server_degraded)` → voice flipped `isActive=false`.

## Where the bug lives

| File:line | What |
|---|---|
| `packages/orchestrator/src/lib/voice-validator.ts:102` | `else if (res.status >= 500) reason = 'server_degraded';` |
| `packages/orchestrator/src/lib/voice-validator.ts:204` | `deactivateReasons = ['revoked', 'server_degraded', 'not_found'];` |
| `packages/orchestrator/src/lib/voice-validator.ts:205-227` | the actual `prisma.voiceCatalogEntry.update({ isActive: false })` loop |
| `packages/orchestrator/src/routes/orchestrate.ts:203-204` | the user-visible "Re-running the director step will pick replacements" error message |

## Status-code → action matrix today

| Status from `/v1/text-to-speech/<id>` | `reason` tag | Auto-deactivate? | Correct? |
|---|---|---|---|
| 401, 402 | `auth` | ❌ no | ✓ ok (transient until key rotates) |
| 403 | `revoked` | ✅ **yes** | ✓ ok (real signal) |
| 404 | `not_found` | ✅ **yes** | ✓ ok (real signal) |
| 429 | `rate_limited` | ❌ no | ✓ ok (transient) |
| **5xx (500/502/503)** | **`server_degraded`** | ✅ **YES** | ❌ **WRONG** — this is the bug |
| Network/timeout | `other` (status 0) | ❌ no | ✓ ok |

The probe also has **no retry** — one 500 from a single 5-second timeout probe (line 29 `PROBE_TIMEOUT_MS = 5_000`) is enough to permanently deactivate the voice.

## What partially protects us today

Lines 187-198 — Peter's 2026-06-17 platform-incident guard: if `>50%` of probed voices come back 5xx, skip auto-deactivation entirely. **But** in a job with only 3 voices, one bad probe = 33% — under threshold, gets deactivated anyway. The exact case Ryan hit.

## Re-activation surface

| Path | Re-activates broken voices? |
|---|---|
| `scripts/refresh-voice-catalog.ts` | **No.** Reconciles `voices_metadata.json`, doesn't touch `isActive` (grep confirms zero `isActive` writes). |
| `scripts/audit-voices.ts` | **No.** Same `['revoked', 'server_degraded', 'not_found']` deactivate filter at line 78 — it can only DEactivate, never reactivate. |
| Sync-on-boot from memory (#281) | **Adds new voices**, doesn't revive existing `isActive=false` rows. |
| `PATCH /api/admin/voices/[entryId]` | **Yes — but manual only**, requires admin going into `/admin/voices` and toggling each row. |

There is no automated path back to `isActive=true` after a 5xx mis-deactivation. The voice is dead in the catalog until a human notices.

## Is the error message gaslighting?

> "Re-running the director step will pick replacements."

Mostly yes. Re-running the director will pick from the now-shrunk pool — but the user has no "re-run director only" button in the UI (this is what Ryan flagged). The cheapest path is the resume/checkpoint pattern (Issue 3, separate bughunt) or a Director-only retry endpoint. So the message describes a recovery that exists in code but not in UX.

## Minimal recommended fixes (don't write yet)

1. **Drop `'server_degraded'` from `deactivateReasons`** (line 204). 5xx is by definition transient — ElevenLabs themselves return `server_degraded` precisely to mean "try later." This is a **one-character commit** (delete the string from the array). The existing `auth` and `rate_limited` reasons already use this "broken but not deactivated" semantics — `server_degraded` should join them.

2. **Add retry-before-classify in `probeVoice`** (line 74-116). Two re-tries with 500ms+1s back-off on 5xx/429/network so a single flaky response isn't fatal. Each probe is "a" + 5 s timeout — cheap. This catches transient 500s before they propagate.

3. **Tighten the platform-incident threshold** (line 68 `0.5`). Tune to `>= 0.34` so even a single bad voice in a 3-voice job triggers "skip deactivation" — actually safer than the current 0.5. (Or move to absolute count: `serverDegraded >= 2`).

4. **Add a re-activation sweep** to `audit-voices.ts` (line 33). On `--reactivate` flag: re-probe `isActive=false, deactivatedReason='server_degraded'` rows; if they come back 200, flip back to `isActive=true`. Cron weekly. Needs a `deactivatedReason` + `deactivatedAt` column added (see #5).

5. **Schema:** add `deactivatedReason` and `deactivatedAt` to `VoiceCatalogEntry` so the re-activation sweep knows which to retry and admins can audit "why was this voice deactivated." Today the reason is only in a log line that ages out.

## Suggested PR title (when ready)
`fix(voice-validator): stop deactivating on 5xx server_degraded; retry before classify`

Self-contained PR; ~30 lines of code + tests. The existing test at `voice-validator.test.ts:113` ("auto-deactivates server_degraded (500) voices") becomes the **inverse** assertion ("does NOT deactivate on 500") — the test was pinning the bug.

Issues 2 (Ryan's own 429 throttle wave) + 3 (resume/checkpoint) tracked separately.
