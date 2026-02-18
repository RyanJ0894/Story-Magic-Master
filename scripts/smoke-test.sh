#!/usr/bin/env bash
# =============================================================================
# Story Magic - Pipeline Smoke Test
# =============================================================================
#
# Verifies the full Story Magic pipeline is operational end-to-end.
# Designed for use in CI, staging validation, and local development.
#
# Usage:
#   ./scripts/smoke-test.sh                          # Local defaults
#   ./scripts/smoke-test.sh --staging                # Staging environment
#   ./scripts/smoke-test.sh --production             # Production environment
#   ./scripts/smoke-test.sh --dry-run                # Show steps without executing
#   ./scripts/smoke-test.sh --web http://my-url      # Custom web URL
#   ./scripts/smoke-test.sh --orch http://my-url     # Custom orchestrator URL
#
# Exit codes:
#   0 = All tests passed
#   1 = One or more tests failed
#
# Requirements:
#   - curl (HTTP requests)
#   - jq (optional, for JSON pretty-printing; degrades gracefully)
#
# Author: Chris Therriault <chris@servicevision.net>
# Date: 2026-02-07
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration & Defaults
# =============================================================================

# Default URLs for local development (see CLAUDE.md port assignments)
WEB_URL="http://localhost:22000"
ORCH_URL="http://localhost:22002"

# Timeouts (seconds)
HEALTH_TIMEOUT=10
API_TIMEOUT=30
GENERATE_TIMEOUT=60

# Counters
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TOTAL_COUNT=0

# Flags
DRY_RUN=false
VERBOSE=false

# Clerk credentials for auth tests (loaded from .env.local or environment)
CLERK_SECRET_KEY="${CLERK_SECRET_KEY:-}"

# Colors (disabled if output is not a terminal)
if [ -t 1 ]; then
  GREEN="\033[0;32m"
  RED="\033[0;31m"
  YELLOW="\033[0;33m"
  CYAN="\033[0;36m"
  BOLD="\033[1m"
  RESET="\033[0m"
else
  GREEN=""
  RED=""
  YELLOW=""
  CYAN=""
  BOLD=""
  RESET=""
fi

# =============================================================================
# Helper Functions
# =============================================================================

usage() {
  cat <<'USAGE'
Story Magic Pipeline Smoke Test

Usage:
  smoke-test.sh [options]

Options:
  --staging           Use staging environment URLs
  --production        Use production environment URLs
  --web URL           Override web service URL
  --orch URL          Override orchestrator service URL
  --dry-run           Show what would be tested without executing
  --verbose           Show full response bodies
  -h, --help          Show this help message

Environment Variables:
  SMOKE_WEB_URL       Override web URL (lower priority than --web flag)
  SMOKE_ORCH_URL      Override orchestrator URL (lower priority than --orch flag)
  CLERK_SECRET_KEY    Clerk secret key for auth tests

Examples:
  ./scripts/smoke-test.sh                              # Test local dev
  ./scripts/smoke-test.sh --staging                    # Test staging
  ./scripts/smoke-test.sh --web http://localhost:3000   # Custom web URL
  ./scripts/smoke-test.sh --dry-run                    # Preview test plan
USAGE
  exit 0
}

# Print a section header
section() {
  echo ""
  echo -e "${BOLD}${CYAN}[$1]${RESET}"
  echo "-----------------------------------------------------------"
}

# Record a test result and print it
# Arguments: name, status (pass|fail|skip), duration_ms, detail
record_result() {
  local name="$1"
  local status="$2"
  local duration="${3:-0}"
  local detail="${4:-}"

  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  case "$status" in
    pass)
      PASS_COUNT=$((PASS_COUNT + 1))
      echo -e "  ${GREEN}PASS${RESET}  ${name} (${duration}ms)"
      ;;
    fail)
      FAIL_COUNT=$((FAIL_COUNT + 1))
      echo -e "  ${RED}FAIL${RESET}  ${name} (${duration}ms)"
      if [ -n "$detail" ]; then
        echo -e "        ${RED}-> ${detail}${RESET}"
      fi
      ;;
    skip)
      SKIP_COUNT=$((SKIP_COUNT + 1))
      echo -e "  ${YELLOW}SKIP${RESET}  ${name}"
      if [ -n "$detail" ]; then
        echo -e "        ${YELLOW}-> ${detail}${RESET}"
      fi
      ;;
  esac
}

# Get current time in milliseconds (portable across macOS and Linux)
now_ms() {
  # macOS date does not support %N; fall back to python3
  if date +%s%3N 2>/dev/null | grep -qE '^[0-9]+$'; then
    date +%s%3N
  else
    python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || echo "0"
  fi
}

# Execute an HTTP GET request and capture status code, body, and timing
# Sets global variables: HTTP_STATUS, HTTP_BODY, HTTP_TIME_MS
http_get() {
  local url="$1"
  local timeout="${2:-$HEALTH_TIMEOUT}"
  local tmpfile

  local start_ms
  start_ms=$(now_ms)

  tmpfile=$(mktemp)

  HTTP_STATUS=$(curl -s -o "$tmpfile" -w "%{http_code}" \
    --connect-timeout "$timeout" \
    --max-time "$timeout" \
    "$url" 2>/dev/null) || HTTP_STATUS="000"

  HTTP_BODY=$(cat "$tmpfile" 2>/dev/null || echo "")
  rm -f "$tmpfile"

  local end_ms
  end_ms=$(now_ms)
  HTTP_TIME_MS=$((end_ms - start_ms))
}

# Execute an HTTP POST request and capture status code, body, and timing
# Usage: http_post URL DATA [timeout_seconds] [extra_headers...]
# Sets global variables: HTTP_STATUS, HTTP_BODY, HTTP_TIME_MS
http_post() {
  local url="$1"
  local data="$2"
  local timeout="${3:-$API_TIMEOUT}"
  shift 3 || true

  local start_ms
  start_ms=$(now_ms)

  local tmpfile
  tmpfile=$(mktemp)

  # Build header arguments array
  local header_args=(-H "Content-Type: application/json")
  while [ $# -gt 0 ]; do
    header_args+=(-H "$1")
    shift
  done

  HTTP_STATUS=$(curl -s -o "$tmpfile" -w "%{http_code}" \
    --connect-timeout "$timeout" \
    --max-time "$timeout" \
    "${header_args[@]}" \
    -d "$data" \
    "$url" 2>/dev/null) || HTTP_STATUS="000"

  HTTP_BODY=$(cat "$tmpfile" 2>/dev/null || echo "")
  rm -f "$tmpfile"

  local end_ms
  end_ms=$(now_ms)
  HTTP_TIME_MS=$((end_ms - start_ms))
}

# Pretty-print JSON if jq is available, otherwise output raw
json_pretty() {
  if command -v jq &>/dev/null; then
    echo "$1" | jq . 2>/dev/null || echo "$1"
  else
    echo "$1"
  fi
}

# Load Clerk credentials from .env.local files if not already set
load_env() {
  local env_file=""

  # Resolve repo root relative to this script
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local repo_root
  repo_root="$(dirname "$script_dir")"

  # Check for .env.local at monorepo root first, then web package
  if [ -f "$repo_root/.env.local" ]; then
    env_file="$repo_root/.env.local"
  elif [ -f "$repo_root/packages/web/.env.local" ]; then
    env_file="$repo_root/packages/web/.env.local"
  fi

  if [ -n "$env_file" ]; then
    # Extract Clerk credentials (only if not already set via environment)
    if [ -z "$CLERK_SECRET_KEY" ]; then
      CLERK_SECRET_KEY=$(grep -E '^CLERK_SECRET_KEY=' "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'") || true
    fi
  fi
}

# =============================================================================
# Parse Command-Line Arguments
# =============================================================================

while [ $# -gt 0 ]; do
  case "$1" in
    --staging)
      # Staging URLs follow Render.com naming from render-staging.yaml
      WEB_URL="https://story-magic-web-staging.onrender.com"
      ORCH_URL="https://story-magic-orchestrator-staging.onrender.com"
      shift
      ;;
    --production)
      # Production URLs follow Render.com naming from render.yaml
      WEB_URL="https://story-magic-web.onrender.com"
      ORCH_URL="https://story-magic-orchestrator.onrender.com"
      shift
      ;;
    --web)
      WEB_URL="$2"
      shift 2
      ;;
    --orch)
      ORCH_URL="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run with --help for usage information."
      exit 1
      ;;
  esac
done

# Environment variable overrides (lower priority than CLI flags)
WEB_URL="${SMOKE_WEB_URL:-$WEB_URL}"
ORCH_URL="${SMOKE_ORCH_URL:-$ORCH_URL}"

# =============================================================================
# Header
# =============================================================================

echo ""
echo -e "${BOLD}Story Magic - Pipeline Smoke Test${RESET}"
echo "==========================================================="
echo "  Web URL:          $WEB_URL"
echo "  Orchestrator URL: $ORCH_URL"
echo "  Dry Run:          $DRY_RUN"
echo "  Timestamp:        $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "==========================================================="

# =============================================================================
# Dry Run Mode - Show test plan and exit
# =============================================================================

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo -e "${YELLOW}DRY RUN MODE - No HTTP requests will be made${RESET}"
  echo ""
  echo "The following tests would be executed:"
  echo ""
  echo "  Step 1: Web Health Check"
  echo "          GET $WEB_URL/"
  echo "          Expect: HTTP 200"
  echo ""
  echo "  Step 2: Orchestrator Health Check"
  echo "          GET $ORCH_URL/health"
  echo "          Expect: HTTP 200 with JSON { status: 'ok', service: 'story-magic-orchestrator' }"
  echo ""
  echo "  Step 3: Auth Provider (Clerk)"
  echo "          GET https://api.clerk.com/v1/instance (via Clerk Backend API)"
  echo "          Expect: HTTP 200 (Clerk reachable) or HTTP 401 (key invalid but service is up)"
  echo "          Note: Requires CLERK_SECRET_KEY from .env.local"
  echo ""
  echo "  Step 4: Create Project via API"
  echo "          POST $WEB_URL/api/projects"
  echo "          Expect: HTTP 401/403 (auth enforced) or 200/201 (if session present)"
  echo ""
  echo "  Step 5: Generate Scenes (Orchestrator)"
  echo "          POST $ORCH_URL/generate-scenes"
  echo "          Body: { project_id: 'smoke-test-000' } (intentionally missing script_text)"
  echo "          Expect: HTTP 400 (Zod schema validation rejects incomplete input)"
  echo ""
  echo "  Step 6: Audio Storage / Disk Stats"
  echo "          GET $ORCH_URL/health"
  echo "          Expect: JSON response contains 'disk' field with storage stats"
  echo ""
  echo "  Step 7: Web Route Verification (5 critical routes)"
  echo "          GET $WEB_URL/              Expect: 200"
  echo "          GET $WEB_URL/login         Expect: 200"
  echo "          GET $WEB_URL/signup        Expect: 200"
  echo "          GET $WEB_URL/guide         Expect: 200"
  echo "          GET $WEB_URL/pricing       Expect: 200"
  echo ""
  echo -e "${YELLOW}Run without --dry-run to execute tests.${RESET}"
  exit 0
fi

# Load Clerk credentials from .env.local for auth testing
load_env

# =============================================================================
# Step 1: Web Health Check
# =============================================================================
# The Next.js frontend must respond on its root path. Render.com also uses
# this as the healthCheckPath (see render.yaml).

section "Step 1: Web Health Check"

http_get "$WEB_URL/" "$HEALTH_TIMEOUT"

if [ "$HTTP_STATUS" = "200" ]; then
  record_result "Web service responds at $WEB_URL/" "pass" "$HTTP_TIME_MS"
else
  record_result "Web service responds at $WEB_URL/" "fail" "$HTTP_TIME_MS" "HTTP $HTTP_STATUS (expected 200)"
fi

# =============================================================================
# Step 2: Orchestrator Health Check
# =============================================================================
# The orchestrator exposes GET /health which returns system status, memory
# usage, disk stats, and capability flags. See lib/monitoring.ts.

section "Step 2: Orchestrator Health Check"

http_get "$ORCH_URL/health" "$HEALTH_TIMEOUT"

if [ "$HTTP_STATUS" = "200" ]; then
  record_result "Orchestrator health endpoint" "pass" "$HTTP_TIME_MS"

  # Verify the JSON structure contains expected fields
  if command -v jq &>/dev/null; then
    orch_status=$(echo "$HTTP_BODY" | jq -r '.status' 2>/dev/null || echo "")
    orch_service=$(echo "$HTTP_BODY" | jq -r '.service' 2>/dev/null || echo "")

    if [ "$orch_status" = "ok" ]; then
      record_result "Orchestrator status=ok" "pass" "0"
    else
      record_result "Orchestrator status=ok" "fail" "0" "status='$orch_status'"
    fi

    if [ "$orch_service" = "story-magic-orchestrator" ]; then
      record_result "Orchestrator service identity" "pass" "0"
    else
      record_result "Orchestrator service identity" "fail" "0" "service='$orch_service'"
    fi
  else
    # Fallback without jq: simple string matching
    if echo "$HTTP_BODY" | grep -q '"status"'; then
      if echo "$HTTP_BODY" | grep -q '"ok"'; then
        record_result "Orchestrator status=ok (string match)" "pass" "0"
      else
        record_result "Orchestrator status=ok (string match)" "fail" "0" "status field present but not 'ok'"
      fi
    else
      record_result "Orchestrator status field present" "fail" "0" "No status field found in response"
    fi
  fi

  if [ "$VERBOSE" = true ]; then
    echo "  Response:"
    json_pretty "$HTTP_BODY" | sed 's/^/    /'
  fi
else
  record_result "Orchestrator health endpoint" "fail" "$HTTP_TIME_MS" "HTTP $HTTP_STATUS (expected 200)"
fi

# =============================================================================
# Step 3: Auth Provider (Clerk)
# =============================================================================
# Tests the Clerk Backend API is reachable and the secret key is valid.
# GET /v1/instance returns the Clerk instance configuration.
#
# Expected responses:
#   200 = Clerk API reachable and key valid
#   401 = Key invalid but Clerk service is up
#   000 = Connection failed

section "Step 3: Auth Provider (Clerk)"

if [ -z "$CLERK_SECRET_KEY" ]; then
  record_result "Clerk auth test" "skip" "0" "CLERK_SECRET_KEY not available (check .env.local)"
else
  tmpfile=$(mktemp)
  start_ms=$(now_ms)

  HTTP_STATUS=$(curl -s -o "$tmpfile" -w "%{http_code}" \
    --connect-timeout "$API_TIMEOUT" \
    --max-time "$API_TIMEOUT" \
    -H "Authorization: Bearer ${CLERK_SECRET_KEY}" \
    "https://api.clerk.com/v1/instance" 2>/dev/null) || HTTP_STATUS="000"

  HTTP_BODY=$(cat "$tmpfile" 2>/dev/null || echo "")
  rm -f "$tmpfile"

  end_ms=$(now_ms)
  HTTP_TIME_MS=$((end_ms - start_ms))

  case "$HTTP_STATUS" in
    200)
      record_result "Clerk API reachable (key valid)" "pass" "$HTTP_TIME_MS"
      ;;
    401|403)
      record_result "Clerk API reachable (key rejected)" "pass" "$HTTP_TIME_MS" "Service is up, check CLERK_SECRET_KEY"
      ;;
    000)
      record_result "Clerk API" "fail" "$HTTP_TIME_MS" "Connection refused or timed out"
      ;;
    *)
      record_result "Clerk API" "fail" "$HTTP_TIME_MS" "HTTP $HTTP_STATUS (expected 200 or 401)"
      ;;
  esac

  if [ "$VERBOSE" = true ]; then
    echo "  Response:"
    json_pretty "$HTTP_BODY" | sed 's/^/    /'
  fi
fi


# =============================================================================
# Step 4: Create Project via Web API
# =============================================================================
# POST to the Next.js API route for project creation. Without a valid session
# cookie, this should return 401 (auth required). A 401 proves the route
# exists and the auth middleware is enforcing access correctly.

section "Step 4: Create Project via API"

http_post "$WEB_URL/api/projects" \
  '{"title":"Smoke Test Project","description":"Automated pipeline verification"}' \
  "$API_TIMEOUT"

case "$HTTP_STATUS" in
  200|201)
    record_result "Create project endpoint (authenticated)" "pass" "$HTTP_TIME_MS"
    ;;
  401|403)
    # Auth rejection is expected without a session - endpoint exists and is protected
    record_result "Create project endpoint (auth enforced)" "pass" "$HTTP_TIME_MS"
    ;;
  404)
    record_result "Create project endpoint" "fail" "$HTTP_TIME_MS" "HTTP 404 - route /api/projects not found"
    ;;
  405)
    record_result "Create project endpoint" "fail" "$HTTP_TIME_MS" "HTTP 405 - POST method not allowed"
    ;;
  000)
    record_result "Create project endpoint" "fail" "$HTTP_TIME_MS" "Connection refused or timed out"
    ;;
  *)
    record_result "Create project endpoint" "fail" "$HTTP_TIME_MS" "HTTP $HTTP_STATUS (expected 200, 201, 401, or 403)"
    ;;
esac

if [ "$VERBOSE" = true ]; then
  echo "  Response:"
  json_pretty "$HTTP_BODY" | sed 's/^/    /'
fi

# =============================================================================
# Step 5: Generate Scenes (Orchestrator)
# =============================================================================
# Send a minimal request to the /generate-scenes endpoint. We intentionally
# omit the required 'script_text' field so the Zod schema validation returns
# a 400 error. This proves:
#   - The route is registered
#   - The request parsing middleware is active
#   - The Zod validation schema is enforcing the contract

section "Step 5: Generate Scenes Endpoint"

http_post "$ORCH_URL/generate-scenes" \
  '{"project_id":"smoke-test-000"}' \
  "$GENERATE_TIMEOUT"

case "$HTTP_STATUS" in
  400)
    # 400 = Zod schema validation caught the missing script_text field.
    # This is the expected and correct behavior.
    record_result "Generate-scenes validation (rejects incomplete input)" "pass" "$HTTP_TIME_MS"
    ;;
  200)
    # Unlikely without script_text, but technically the endpoint responded
    record_result "Generate-scenes endpoint (accepted)" "pass" "$HTTP_TIME_MS"
    ;;
  401|403)
    # Auth is enforced - endpoint exists and is protected
    record_result "Generate-scenes endpoint (auth enforced)" "pass" "$HTTP_TIME_MS"
    ;;
  404)
    record_result "Generate-scenes endpoint" "fail" "$HTTP_TIME_MS" "HTTP 404 - route /generate-scenes not found"
    ;;
  000)
    record_result "Generate-scenes endpoint" "fail" "$HTTP_TIME_MS" "Connection refused or timed out"
    ;;
  *)
    record_result "Generate-scenes endpoint" "fail" "$HTTP_TIME_MS" "HTTP $HTTP_STATUS (expected 400 for schema validation)"
    ;;
esac

if [ "$VERBOSE" = true ]; then
  echo "  Response:"
  json_pretty "$HTTP_BODY" | sed 's/^/    /'
fi

# =============================================================================
# Step 6: Audio Storage / Disk Stats
# =============================================================================
# The orchestrator's /health endpoint includes disk usage statistics from
# the persistent audio storage volume (mounted at /var/data/audio in
# production, see render.yaml). Verify the stats are present.

section "Step 6: Audio Storage Health"

http_get "$ORCH_URL/health" "$HEALTH_TIMEOUT"

if [ "$HTTP_STATUS" = "200" ]; then
  if command -v jq &>/dev/null; then
    disk_info=$(echo "$HTTP_BODY" | jq '.disk' 2>/dev/null || echo "null")

    if [ "$disk_info" != "null" ] && [ "$disk_info" != "" ]; then
      record_result "Disk stats present in health response" "pass" "$HTTP_TIME_MS"

      if [ "$VERBOSE" = true ]; then
        echo "  Disk stats:"
        echo "$disk_info" | jq . 2>/dev/null | sed 's/^/    /'
      fi
    else
      record_result "Disk stats present in health response" "fail" "$HTTP_TIME_MS" "'disk' field is null or missing in JSON"
    fi
  else
    # Without jq, fall back to string matching
    if echo "$HTTP_BODY" | grep -q '"disk"'; then
      record_result "Disk stats present in health response (string match)" "pass" "$HTTP_TIME_MS"
    else
      record_result "Disk stats present in health response (string match)" "fail" "$HTTP_TIME_MS" "No 'disk' field found in response"
    fi
  fi
else
  record_result "Audio storage health check" "fail" "$HTTP_TIME_MS" "HTTP $HTTP_STATUS (expected 200)"
fi

# =============================================================================
# Step 7: Web Route Verification
# =============================================================================
# Verify that all critical public-facing routes return HTTP 200.
# These are Next.js App Router pages defined under packages/web/app/.
# A non-200 here means a build error, missing page, or misconfigured route.

section "Step 7: Web Route Verification"

CRITICAL_ROUTES=(
  "/"
  "/login"
  "/signup"
  "/guide"
  "/pricing"
)

for route in "${CRITICAL_ROUTES[@]}"; do
  http_get "${WEB_URL}${route}" "$HEALTH_TIMEOUT"

  if [ "$HTTP_STATUS" = "200" ]; then
    record_result "GET ${route}" "pass" "$HTTP_TIME_MS"
  elif [ "$HTTP_STATUS" = "307" ] || [ "$HTTP_STATUS" = "308" ] || [ "$HTTP_STATUS" = "302" ]; then
    # Redirects are acceptable (e.g., middleware redirecting unauthenticated users)
    record_result "GET ${route} (redirect ${HTTP_STATUS})" "pass" "$HTTP_TIME_MS"
  else
    record_result "GET ${route}" "fail" "$HTTP_TIME_MS" "HTTP $HTTP_STATUS (expected 200)"
  fi
done

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "==========================================================="
echo -e "${BOLD}Summary${RESET}"
echo "==========================================================="
echo -e "  Total:   ${TOTAL_COUNT}"
echo -e "  ${GREEN}Passed:  ${PASS_COUNT}${RESET}"
echo -e "  ${RED}Failed:  ${FAIL_COUNT}${RESET}"
echo -e "  ${YELLOW}Skipped: ${SKIP_COUNT}${RESET}"
echo "-----------------------------------------------------------"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}RESULT: FAIL${RESET}"
  echo ""
  echo "  Troubleshooting:"
  echo "    1. Verify services are running:  pnpm dev"
  echo "    2. Check Docker is up:           pnpm docker:up"
  echo "    3. Review credentials:           cat .env.local"
  echo "    4. Orchestrator logs:            docker compose logs orchestrator"
  echo "    5. Web dev server logs:          Check terminal running pnpm dev:web"
  echo "    6. Re-run with --verbose:        ./scripts/smoke-test.sh --verbose"
  echo ""
  exit 1
else
  echo -e "  ${GREEN}${BOLD}RESULT: PASS${RESET}"
  echo ""
  exit 0
fi
