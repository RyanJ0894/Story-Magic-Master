# E2E Test Suite — Story Magic

Playwright tests live in `packages/web/e2e/`. This document explains the two test tiers, their required environment, and common pitfalls.

---

## Quick Start

```bash
# 1. Ensure the dev server is running (or tests auto-start it)
pnpm --filter @story-magic/web dev

# 2. Run all unauthenticated tests
pnpm --filter @story-magic/web test:e2e

# 3. Run authenticated tests (requires Clerk env vars — see below)
pnpm --filter @story-magic/web test:e2e -- --project=chromium-authenticated

# 4. Run a single spec file
pnpm --filter @story-magic/web test:e2e -- ryan-flow

# 5. Run with Playwright UI (recommended for debugging)
pnpm --filter @story-magic/web exec playwright test --ui

# 6. Run against production
PLAYWRIGHT_BASE_URL=https://www.storymagicapp.net \
  pnpm --filter @story-magic/web test:e2e -- ryan-flow --headed
```

---

## Test Tiers

### Unauthenticated (`*.spec.ts`)

- File naming: `foo.spec.ts`
- No login required; tests use public routes only
- Run automatically in all browser projects (Chrome, Firefox, Safari, Mobile)
- **No extra setup needed** — just a running dev server

### Authenticated (`*.authenticated.spec.ts`)

- File naming: `foo.authenticated.spec.ts`
- Require a Clerk testing token to sign in programmatically
- Run only in `chromium-authenticated` project (depends on `setup` project)
- The `setup` project runs `e2e/auth.setup.ts` first, which writes auth state to `e2e/.auth/user.json`

**Required environment variables for authenticated tests:**

| Variable | Where to get it | Purpose |
|----------|----------------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Doppler `story-magic/dev` | Clerk frontend key |
| `CLERK_SECRET_KEY` | Doppler `story-magic/dev` | Used by `clerkSetup()` in global-setup |
| `E2E_TEST_EMAIL` | Doppler `story-magic/dev` | Test account email |
| `E2E_TEST_PASSWORD` | Doppler `story-magic/dev` | Test account password |

All are available via `doppler run --`:

```bash
doppler run --project story-magic --config dev -- \
  pnpm --filter @story-magic/web test:e2e -- --project=chromium-authenticated
```

---

## Hardcoded Project IDs (Important)

Several authenticated specs reference real project IDs from a seeded test account:

| Spec | Variable | ID | What it expects |
|------|----------|----|-----------------|
| `audio-generation-1page.authenticated.spec.ts` | `REAL_DRAFT_PROJECT_ID` | `606f2749-…` | Draft project with a 1-page script |
| `audio-generation-1page.authenticated.spec.ts` | `REAL_COMPLETED_PROJECT_ID` | `71e98a0f-…` | Completed project with audio |
| `audio-generation-15page.authenticated.spec.ts` | `REAL_DRAFT_PROJECT_ID` | *(see file)* | Draft project with a 15-page script |

**These IDs must exist in the database for the test account.** If the account's projects were deleted, the tests will either skip silently (via `test.skip()`) or 404.

To reset, run the seed script:

```bash
# Set E2E_TEST_USER_ID to the Clerk user ID of the test account (find it
# in Clerk Dashboard > Users, or in Doppler story-magic/dev).
doppler run --project story-magic --config dev -- \
  pnpm --filter @story-magic/web e2e:seed
```

This creates the three well-known projects (draft + two completed) via idempotent upserts.
The seed script is safe to run repeatedly — it will not overwrite real data belonging to
other users because it targets the dedicated test account only.

---

## Why Some Tests Skip Silently

Tests that depend on a specific project ID use `test.skip()` when the project is not found:

```typescript
const project = await page.goto(`/projects/${REAL_DRAFT_PROJECT_ID}`);
if (response?.status() === 404) {
  test.skip(); // ← test disappears from output, no failure reported
}
```

This is by design — the test is skipped rather than failed because the database state is a precondition outside the test's control. **A skipped test does not mean the feature works.** Monitor skipped counts and investigate if tests that were previously passing start being skipped.

---

## Auth State File

`e2e/.auth/user.json` — written by `auth.setup.ts`, consumed by all `*.authenticated.spec.ts` files.

- **Gitignored** — never committed
- Expires with the Clerk session (typically 1 day)
- If authenticated tests fail with "not signed in", delete `e2e/.auth/user.json` and re-run; the setup project will recreate it

---

## Fixtures

`e2e/fixtures/` — shared test helpers and page object models used by multiple specs. Import from here rather than duplicating setup logic.

---

## CI Behaviour

On CI (GitHub Actions), tests run with:
- `workers: 1` (sequential, avoids port conflicts)
- `retries: 2` (flakiness tolerance)
- `forbidOnly: true` (catches accidentally committed `test.only`)
- Authenticated tests only run if `CLERK_SECRET_KEY` is set in CI secrets

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `auth.json` not found | Setup project didn't run | Run `--project=setup` first, or use `--project=chromium-authenticated` which depends on setup |
| Tests skip silently on audio specs | Seeded project IDs not in DB | Re-create projects and update constants |
| `CLERK_TESTING_TOKEN` not set | Missing env vars | Use `doppler run --` prefix |
| Dev server not starting | Port 22000 in use | Kill the existing process: `lsof -ti:22000 \| xargs kill` |
| `page.goto` 401 on API routes | Auth state expired | Delete `e2e/.auth/user.json` and rerun |
