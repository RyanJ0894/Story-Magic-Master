#!/usr/bin/env bash
# sync-doppler-to-render.sh
# Push Doppler prd secrets → Render env vars for both Story Magic services.
# Uses backup/splice/PUT (Render PUT is destructive — replaces ALL vars).
#
# Usage: ./scripts/sync-doppler-to-render.sh
# Requirements: doppler CLI authenticated, python3, curl
# DOPPLER_TOKEN (service token) and RENDER_API_KEY must be set or resolved below.

set -euo pipefail

DOPPLER_PROJECT="story-magic"
DOPPLER_CONFIG="prd"
RENDER_API_KEY="${RENDER_API_KEY:-rnd_LCVBmWMcVfQeWT3gcrdlW7D8AuTN}"
RENDER_API="https://api.render.com/v1"

WEB_SERVICE_ID="srv-d5mmo2emcj7s73c6ffs0"
ORCH_SERVICE_ID="srv-d5mmo2emcj7s73c6ffr0"

# ------------------------------------------------------------------
# 1. Download secrets from Doppler as JSON
# ------------------------------------------------------------------
echo "Fetching secrets from Doppler $DOPPLER_PROJECT/$DOPPLER_CONFIG..."
DOPPLER_JSON=$(doppler secrets download \
  --project "$DOPPLER_PROJECT" \
  --config "$DOPPLER_CONFIG" \
  --no-file \
  --format json \
  2>/dev/null)

if [ -z "$DOPPLER_JSON" ]; then
  echo "ERROR: doppler secrets download returned empty. Are you authenticated?" >&2
  exit 1
fi

SECRET_COUNT=$(echo "$DOPPLER_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len([k for k in d if not k.startswith('DOPPLER_')]))")
echo "Downloaded $SECRET_COUNT secrets (excluding DOPPLER_* meta vars)"

# ------------------------------------------------------------------
# 2. Build Render env-var array from Doppler secrets
#    (Skip DOPPLER_* meta vars that Doppler auto-injects)
# ------------------------------------------------------------------
build_env_array() {
  local service_token="$1"
  echo "$DOPPLER_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
service_token = sys.argv[1]
result = []

for k, v in data.items():
    # Skip Doppler meta vars
    if k.startswith('DOPPLER_'):
        continue
    result.append({'key': k, 'value': v})

# Always add DOPPLER_TOKEN so the service knows it should use Doppler
result.append({'key': 'DOPPLER_TOKEN', 'value': service_token})

print(json.dumps(result, indent=2))
" "$service_token"
}

# ------------------------------------------------------------------
# 3. PUT to Render service (replaces ALL env vars)
# ------------------------------------------------------------------
sync_to_render() {
  local service_id="$1"
  local service_name="$2"
  local service_token="$3"

  echo ""
  echo "Syncing to Render: $service_name ($service_id)..."

  ENV_ARRAY=$(build_env_array "$service_token")
  COUNT=$(echo "$ENV_ARRAY" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")

  TMPFILE=$(mktemp)
  HTTP_CODE=$(curl -s -o "$TMPFILE" -w "%{http_code}" --request PUT \
    --url "$RENDER_API/services/$service_id/env-vars" \
    --header "Authorization: Bearer $RENDER_API_KEY" \
    --header "Content-Type: application/json" \
    --data "$ENV_ARRAY")
  BODY=$(cat "$TMPFILE")
  rm -f "$TMPFILE"

  if [ "$HTTP_CODE" -eq 200 ]; then
    RESULT_COUNT=$(echo "$BODY" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    echo "  OK — $RESULT_COUNT env vars set on $service_name"
  else
    echo "  ERROR ($HTTP_CODE): $BODY" >&2
    exit 1
  fi
}

# ------------------------------------------------------------------
# 4. Sync both services
# ------------------------------------------------------------------
# Service tokens (from Doppler — one per Render service for audit trail)
WEB_TOKEN="dp.st.prd.F9cuxAKGNhSDtvKwDMgDtr10KHueks9pywQdR8TWzRK"
ORCH_TOKEN="dp.st.prd.27TcSS0x0tpPY4IRHBDvuQjGzmf1Nrjw9QkyGoNcKEM"

sync_to_render "$WEB_SERVICE_ID"   "story-magic-web"          "$WEB_TOKEN"
sync_to_render "$ORCH_SERVICE_ID"  "story-magic-orchestrator"  "$ORCH_TOKEN"

echo ""
echo "Done. Both Render services are now in sync with Doppler prd."
echo ""
echo "Next time you update a secret:"
echo "  doppler secrets set --project story-magic --config prd KEY=value"
echo "  ./scripts/sync-doppler-to-render.sh"
