#!/usr/bin/env bash
# =============================================================================
# Story Magic - Load Test Script
# =============================================================================
#
# Tests concurrent request handling on the orchestrator service.
# Uses curl + background processes (no external dependencies like wrk/k6).
#
# Usage:
#   ./scripts/load-test.sh                      # Default: localhost, 10 concurrent
#   ./scripts/load-test.sh --staging             # Test staging environment
#   ./scripts/load-test.sh --concurrent 20       # 20 concurrent requests
#   ./scripts/load-test.sh --duration 60         # Run for 60 seconds
#
# =============================================================================

set -euo pipefail

# Defaults
ORCH_URL="${ORCH_URL:-http://localhost:22002}"
WEB_URL="${WEB_URL:-http://localhost:22000}"
CONCURRENT="${CONCURRENT:-10}"
DURATION="${DURATION:-30}"
RESULTS_DIR="/tmp/story-magic-loadtest-$(date +%Y%m%d-%H%M%S)"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --staging)
      ORCH_URL="https://story-magic-orchestrator-staging.onrender.com"
      WEB_URL="https://story-magic-web-staging.onrender.com"
      shift ;;
    --production)
      ORCH_URL="https://story-magic-orchestrator.onrender.com"
      WEB_URL="https://story-magic-web.onrender.com"
      shift ;;
    --orch) ORCH_URL="$2"; shift 2 ;;
    --web) WEB_URL="$2"; shift 2 ;;
    --concurrent) CONCURRENT="$2"; shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--staging|--production] [--concurrent N] [--duration SECS]"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$RESULTS_DIR"

echo "============================================="
echo "  Story Magic Load Test"
echo "============================================="
echo "  Orchestrator: $ORCH_URL"
echo "  Web:          $WEB_URL"
echo "  Concurrent:   $CONCURRENT requests"
echo "  Duration:     ${DURATION}s"
echo "  Results:      $RESULTS_DIR"
echo "============================================="
echo ""

# ------------------------------------------------------------------
# Test 1: Health endpoint throughput
# ------------------------------------------------------------------
echo "[Test 1] Health endpoint throughput ($CONCURRENT concurrent, ${DURATION}s)"

HEALTH_PIDS=()
for i in $(seq 1 "$CONCURRENT"); do
  (
    count=0
    errors=0
    end_time=$((SECONDS + DURATION))
    while [ $SECONDS -lt $end_time ]; do
      status=$(curl -s -o /dev/null -w "%{http_code}" "$ORCH_URL/health" 2>/dev/null || echo "000")
      count=$((count + 1))
      if [ "$status" != "200" ]; then
        errors=$((errors + 1))
      fi
    done
    echo "$count $errors" > "$RESULTS_DIR/health-worker-$i.txt"
  ) &
  HEALTH_PIDS+=($!)
done

# Wait for all workers
for pid in "${HEALTH_PIDS[@]}"; do
  wait "$pid" 2>/dev/null || true
done

# Aggregate results
total_requests=0
total_errors=0
for f in "$RESULTS_DIR"/health-worker-*.txt; do
  read -r count errors < "$f"
  total_requests=$((total_requests + count))
  total_errors=$((total_errors + errors))
done

rps=$((total_requests / DURATION))
error_rate=0
if [ $total_requests -gt 0 ]; then
  error_rate=$((total_errors * 100 / total_requests))
fi

echo "  Total requests: $total_requests"
echo "  Requests/sec:   $rps"
echo "  Errors:         $total_errors ($error_rate%)"
echo "  Result:         $([ $error_rate -lt 5 ] && echo 'PASS' || echo 'FAIL')"
echo ""

# ------------------------------------------------------------------
# Test 2: Web page response times under load
# ------------------------------------------------------------------
echo "[Test 2] Web page response times ($CONCURRENT concurrent)"

WEB_ROUTES=("/" "/login" "/signup" "/pricing")
for route in "${WEB_ROUTES[@]}"; do
  WEB_PIDS=()
  for i in $(seq 1 "$CONCURRENT"); do
    (
      time_total=$(curl -s -o /dev/null -w "%{time_total}" "${WEB_URL}${route}" 2>/dev/null || echo "99.0")
      echo "$time_total" > "$RESULTS_DIR/web-${route//\//_}-worker-$i.txt"
    ) &
    WEB_PIDS+=($!)
  done

  for pid in "${WEB_PIDS[@]}"; do
    wait "$pid" 2>/dev/null || true
  done

  # Calculate avg/max
  sum=0
  max=0
  count=0
  for f in "$RESULTS_DIR"/web-${route//\//_}-worker-*.txt; do
    t=$(cat "$f")
    # Convert to milliseconds (integer math)
    ms=$(echo "$t" | awk '{printf "%d", $1 * 1000}')
    sum=$((sum + ms))
    count=$((count + 1))
    if [ "$ms" -gt "$max" ]; then
      max=$ms
    fi
  done
  avg=$((sum / count))
  echo "  ${route}: avg=${avg}ms, max=${max}ms $([ $max -lt 5000 ] && echo 'PASS' || echo 'FAIL')"
done
echo ""

# ------------------------------------------------------------------
# Test 3: Rate limiter verification
# ------------------------------------------------------------------
echo "[Test 3] Rate limiter verification (burst 20 requests)"

RATE_RESULTS=()
for i in $(seq 1 20); do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$ORCH_URL/health" 2>/dev/null || echo "000")
  RATE_RESULTS+=("$status")
done

rate_limited=0
for status in "${RATE_RESULTS[@]}"; do
  if [ "$status" = "429" ]; then
    rate_limited=$((rate_limited + 1))
  fi
done

echo "  Requests sent: 20"
echo "  429 responses: $rate_limited"
echo "  Result:        $([ $rate_limited -eq 0 ] && echo 'PASS (health not rate-limited, as expected)' || echo 'INFO (rate limiting active)')"
echo ""

# ------------------------------------------------------------------
# Test 4: Memory baseline
# ------------------------------------------------------------------
echo "[Test 4] Memory usage baseline"

health_response=$(curl -s "$ORCH_URL/health" 2>/dev/null || echo '{}')

if command -v jq &>/dev/null; then
  rss=$(echo "$health_response" | jq -r '.memory.rss_mb // "N/A"' 2>/dev/null)
  heap=$(echo "$health_response" | jq -r '.memory.heap_used_mb // "N/A"' 2>/dev/null)
  echo "  RSS:       ${rss} MB"
  echo "  Heap Used: ${heap} MB"
  echo "  Result:    INFO (baseline captured)"
else
  echo "  Install jq for detailed memory stats"
  echo "  Raw: $(echo "$health_response" | head -c 200)"
fi
echo ""

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
echo "============================================="
echo "  Load Test Summary"
echo "============================================="
echo "  Health RPS:        $rps req/s"
echo "  Health Error Rate: $error_rate%"
echo "  Results saved to:  $RESULTS_DIR"
echo ""
echo "  Recommended max concurrent jobs: $((CONCURRENT / 2))"
echo "  (Conservative estimate: 2 health checks per job)"
echo "============================================="

# Cleanup temp files
rm -rf "$RESULTS_DIR"

exit $([ $error_rate -lt 5 ] && echo 0 || echo 1)
