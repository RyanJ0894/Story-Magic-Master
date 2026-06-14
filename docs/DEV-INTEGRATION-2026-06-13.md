# `dev` integration manifest — 2026-06-13

The `origin/dev` branch is an **integration-test surface** for the nine PRs that landed on Friday 2026-06-13. None of these have been approved into `main` yet — they're queued for codeowner review on the dates noted in the [3-day plan](./GO-TO-MARKET-3DAY-2026-06-13.md).

Use `dev` when you want to exercise the **combined behavior** (Stripe walkthrough end-to-end, UAT batch, prod smoke) without committing to a particular PR's merge. The individual PRs stay open against `main` for review.

## What's on `dev`

`dev` is `main` plus the nine PRs below, layered with `--no-ff` so each integration commit is auditable. The order matches the merge order recommended in the 3-day plan v1.1.

| # | Merge commit | PR | Subject | Files |
|---|---|---|---|---|
| 1 | `791308d` | [#270](https://github.com/dbbuilder-org/story-magic/pull/270) | whisper install static-link | `scripts/install-whisper.sh` |
| 2 | `6f8878b` | [#269](https://github.com/dbbuilder-org/story-magic/pull/269) | ai-health classify transients | `packages/orchestrator/src/lib/ai-health.*` |
| 3 | `f7cbaf8` | [#268](https://github.com/dbbuilder-org/story-magic/pull/268) | `/health` alignment + runnable check | `packages/orchestrator/src/lib/monitoring.*` |
| 4 | `b2b9684` | [#273](https://github.com/dbbuilder-org/story-magic/pull/273) | STORY-MAGIC-1G job-poll timeout | `packages/web/lib/db/with-query-timeout.ts` + 2 routes |
| 5 | `758b4b8` | [#271](https://github.com/dbbuilder-org/story-magic/pull/271) | listen flow dead-end (#206) | `screenplay-reader.tsx`, `reader/dashboard/page.tsx`, new helper |
| 6 | `8457195` | [#272](https://github.com/dbbuilder-org/story-magic/pull/272) | STORY-MAGIC-1F TimeAgo | `enterprise/(gated)/dashboard/page.tsx`, `components/ui/time-ago.tsx` |
| 7 | `c40f12a` | [#274](https://github.com/dbbuilder-org/story-magic/pull/274) | hydration audit sweep | `components/ui/date-time.tsx`, 3 admin/exchange pages |
| 8 | `b142d3f` | [#275](https://github.com/dbbuilder-org/story-magic/pull/275) | listen flow E2E spec | `e2e/listen-flow-navigation.authenticated.spec.ts` |
| 9 | `6205993` | [#276](https://github.com/dbbuilder-org/story-magic/pull/276) | stripe walkthrough + 3-day plan v1.1 | `docs/STRIPE-LIVE-WALKTHROUGH-2026-06-13.md`, plan v1.1 |

Audit the per-PR integration trail:

```bash
git fetch origin dev
git log --merges --oneline origin/main..origin/dev
```

## Validation against integrated state

Verified locally at the time of integration:

| Surface | Result |
|---|---|
| `pnpm --filter @story-magic/orchestrator typecheck` | clean |
| `pnpm --filter @story-magic/web typecheck` | clean |
| `pnpm --filter @story-magic/orchestrator test --run` | **877 / 877** |
| `pnpm --filter @story-magic/web test --run` | **1,340 / 1,340** |

Total: **2,217 tests pass.**

## How to use `dev`

### Local checkout for integration testing

```bash
git fetch origin dev
git checkout dev
git reset --hard origin/dev   # if you already had an old dev locally
pnpm install
pnpm --filter @story-magic/orchestrator test --run
pnpm --filter @story-magic/web test --run
```

### Deploy `dev` to a Render preview env (optional)

If you want to put the integrated state in front of real traffic before approving the PRs:

1. In the Render dashboard, on the `story-magic-web` and `story-magic-orchestrator` services, change **Branch** to `dev` temporarily, OR
2. Create temporary `story-magic-web-dev` / `story-magic-orchestrator-dev` services pointed at `dev` so production stays on `main`.

Either way, remember to flip back to `main` once review concludes.

### Pulling new PR changes into `dev`

If a reviewer requests changes on one of the open PRs and the author pushes to that PR's source branch, the integration on `dev` will drift. To bring `dev` back in sync, ask Claude to re-integrate (the merge is mechanical):

```bash
git checkout dev
git pull --ff-only
git merge --no-ff origin/<that-PR-branch> -m "Re-integrate <branch> into dev (updated PR #N)"
git push origin dev
```

## What's NOT on `dev` (history reset rationale)

The previous `origin/dev` (HEAD `ee71704`) held pre-squash versions of three branches that had since landed on `main` via squash-merge:

- `0b375cb` voice catalog auto-seed (same content as `#246` on main as `81436ce`)
- `64eb99a` sentry gap coverage (same content as `#245` on main as `44d2a6f`)
- `7721a97` rate-limit per user (open PR `#244`, not merged)

Merging `main` into the old `dev` produced real conflicts in `packages/orchestrator/src/index.ts` and `packages/web/lib/api/middleware.ts` — the same logical changes arriving via different SHAs.

Resolution: `dev` was force-reset to `origin/main` and the nine open PRs were layered on top. Nothing of unique value was lost since `#245`/`#246` are already on `main`. `#244` (rate-limit per user) remains an open PR; if it gets approved later, it can be merged into `dev` the same way.

If anyone had a personal branch based on the old `dev`, they should rebase onto the new `dev` (or branch from a specific PR's source branch if the old work was tied to that PR).

## Bookkeeping

- `dev` is **not** branch-protected. CI is informational only on this branch.
- `dev` may be force-pushed by Claude (or whoever is doing the integration) when the open-PR set changes.
- This manifest gets regenerated when the open-PR set changes meaningfully. The current version reflects the queue as of **2026-06-13 ~23:30 PT**.
