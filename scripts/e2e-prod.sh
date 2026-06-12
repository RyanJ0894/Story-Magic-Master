#!/usr/bin/env bash
# =============================================================================
# Run the prod-smoke Playwright spec against production.
#
# Layers it covers:
#   - PUBLIC         : page loads (always runs)
#   - AUTH           : dashboard for authenticated user (when E2E_TEST_EMAIL is set)
#   - FULL_GENERATION: real audio job, ~$0.05–$0.15 per run (when E2E_PROD_FULL_GENERATION=true)
#
# Usage:
#   ./scripts/e2e-prod.sh                              # public + auth (no money)
#   E2E_PROD_FULL_GENERATION=true ./scripts/e2e-prod.sh # public + auth + paid generation
#   PLAYWRIGHT_BASE_URL=https://www.storymagicapp.net ./scripts/e2e-prod.sh
#
# Pulls E2E_TEST_EMAIL + CLERK_SECRET_KEY from Doppler dev when available so
# `doppler run -- ./scripts/e2e-prod.sh` is the easy mode. Falls back to the
# values already in your shell env when Doppler isn't on PATH.
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# Defaults
# -----------------------------------------------------------------------------
: "${PLAYWRIGHT_BASE_URL:=https://www.storymagicapp.net}"
: "${E2E_PROD_FULL_GENERATION:=false}"

cd "$(dirname "$0")/.."

# -----------------------------------------------------------------------------
# Sanity: confirm target is reachable before spinning up Playwright
# -----------------------------------------------------------------------------
echo "─── prod smoke ───────────────────────────────────────────────"
echo "  Target:           ${PLAYWRIGHT_BASE_URL}"
echo "  Full generation:  ${E2E_PROD_FULL_GENERATION}"
if [[ -n "${E2E_TEST_EMAIL:-}" ]]; then
  echo "  Test email:       (set — auth layer will run)"
else
  echo "  Test email:       (not set — auth + generation layers skip)"
fi
echo "──────────────────────────────────────────────────────────────"

if ! curl -fsS --max-time 10 "${PLAYWRIGHT_BASE_URL}/" >/dev/null; then
  echo "ERROR: ${PLAYWRIGHT_BASE_URL} is not reachable. Aborting before the test even loads."
  exit 1
fi

# -----------------------------------------------------------------------------
# Run the specs
# -----------------------------------------------------------------------------
export PLAYWRIGHT_BASE_URL E2E_PROD_FULL_GENERATION

# Always run the public layer (no auth dependency, no setup project).
echo ""
echo "─── public layer ─────────────────────────────────────────────"
pnpm --filter @story-magic/web exec playwright test \
  --project=chromium \
  --reporter=list \
  e2e/prod-smoke-public.spec.ts \
  "$@"

# Auth + paid-generation layers run only when E2E_TEST_EMAIL is set. The
# CLERK_SECRET_KEY in the environment MUST match the target Clerk instance
# (prod sk_live_… when PLAYWRIGHT_BASE_URL points at prod) — otherwise the
# Clerk testing helper mints tickets that the target rejects.
if [[ -n "${E2E_TEST_EMAIL:-}" ]]; then
  echo ""
  echo "─── auth + (opt-in) generation layer ─────────────────────────"
  pnpm --filter @story-magic/web exec playwright test \
    --project=chromium-authenticated \
    --reporter=list \
    e2e/prod-smoke.authenticated.spec.ts \
    "$@"
else
  echo ""
  echo "─── auth layer SKIPPED (E2E_TEST_EMAIL not set) ──────────────"
fi
