#!/usr/bin/env bash
# ============================================================================
# Story Magic — Environment Variable Backup
#
# Pulls current env vars from Render, saves them locally, and optionally
# uploads them as GitHub encrypted secrets for encrypted offsite backup.
#
# Usage:
#   bash scripts/backup-env.sh              # local backup only
#   bash scripts/backup-env.sh --github     # local + GitHub secrets backup
#
# Requirements:
#   - curl, python3 in PATH
#   - For --github: gh CLI installed and authenticated (gh auth login)
#
# Output files (gitignored via .env-backup/ in .gitignore):
#   .env-backup/web-production.env           human-readable key=value
#   .env-backup/orchestrator-production.env
#   .env-backup/web-production.json          raw Render API format
#   .env-backup/orchestrator-production.json
# ============================================================================

RENDER_API_KEY="rnd_LCVBmWMcVfQeWT3gcrdlW7D8AuTN"
WEB_SERVICE_ID="srv-d5mmo2emcj7s73c6ffs0"
ORCH_SERVICE_ID="srv-d5mmo2emcj7s73c6ffr0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/.env-backup"
GITHUB_REPO="dbbuilder-org/story-magic"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M UTC')
UPLOAD_GITHUB=false

for arg in "$@"; do
  case "$arg" in
    --github) UPLOAD_GITHUB=true ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

mkdir -p "$BACKUP_DIR"
echo ""
echo "📦  Story Magic — Environment Backup"
echo "    $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── Fetch and save one service ────────────────────────────────────────────────

fetch_env() {
  local service_id="$1"
  local service_name="$2"
  local json_file="$BACKUP_DIR/${service_name}-production.json"
  local env_file="$BACKUP_DIR/${service_name}-production.env"

  echo "→  Fetching $service_name env vars from Render..."

  local response
  response=$(curl -s \
    "https://api.render.com/v1/services/${service_id}/env-vars?limit=50" \
    -H "Authorization: Bearer ${RENDER_API_KEY}")

  if [[ -z "$response" ]] || echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if isinstance(d, list) else 1)" 2>/dev/null; then
    : # ok
  fi

  # Check for API error
  if echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(1 if isinstance(d, list) else 0)" 2>/dev/null; then
    echo "   ❌  API error: $response"
    return 1
  fi

  # Save raw JSON (for re-upload if needed)
  echo "$response" > "$json_file"

  # Build human-readable .env and masked console summary
  python3 - "$json_file" "$env_file" "$service_name" "$service_id" "$TIMESTAMP" << 'PYEOF'
import json, sys

json_file, env_file, service_name, service_id, timestamp = sys.argv[1:]
SECRETS = {'KEY','SECRET','TOKEN','PASSWORD','PASS','DSN','WEBHOOK'}

with open(json_file) as f:
    data = json.load(f)

items = data if isinstance(data, list) else data.get('envVars', [])

# Write .env file
with open(env_file, 'w') as f:
    f.write(f"# Story Magic — {service_name} production env vars\n")
    f.write(f"# Backed up: {timestamp}\n")
    f.write(f"# Service ID: {service_id}\n")
    f.write("# DO NOT COMMIT — gitignored via .env-backup/\n\n")
    for ev in sorted(items, key=lambda x: x.get('envVar', x).get('key', '')):
        item = ev.get('envVar', ev)
        k = item.get('key', '')
        v = item.get('value', '') or ''
        f.write(f"{k}={v}\n")

print(f"   ✅  {len(items)} vars saved to {env_file}")
print()
print("   Key inventory:")
for ev in sorted(items, key=lambda x: x.get('envVar', x).get('key', '')):
    item = ev.get('envVar', ev)
    k = item.get('key', '')
    v = item.get('value', '') or ''
    is_secret = any(s in k.upper() for s in SECRETS)
    if is_secret and len(v) > 4:
        display = v[:4] + '***'
    elif len(v) > 50:
        display = v[:50] + '...'
    else:
        display = v
    status = '✓' if v else '⚠ EMPTY'
    print(f"     {status:8s}  {k}={display}")
PYEOF

  echo ""
}

fetch_env "$WEB_SERVICE_ID" "web"
fetch_env "$ORCH_SERVICE_ID" "orchestrator"

# ── GitHub Secrets Backup ─────────────────────────────────────────────────────

if [[ "$UPLOAD_GITHUB" == "true" ]]; then
  echo ""
  echo "→  Uploading to GitHub encrypted secrets..."

  if ! command -v gh &>/dev/null; then
    echo "   ❌  gh CLI not found. Install from https://cli.github.com"
    exit 1
  fi

  if ! gh auth status &>/dev/null 2>&1; then
    echo "   ❌  gh CLI not authenticated. Run: gh auth login"
    exit 1
  fi

  encode_env() {
    local json_file="$1"
    python3 - "$json_file" << 'PYEOF'
import json, sys, base64
with open(sys.argv[1]) as f:
    data = json.load(f)
items = data if isinstance(data, list) else data.get('envVars', [])
lines = []
for ev in items:
    item = ev.get('envVar', ev)
    k = item.get('key', '')
    v = item.get('value', '') or ''
    lines.append(f'{k}={v}')
print(base64.b64encode('\n'.join(lines).encode()).decode())
PYEOF
  }

  web_b64=$(encode_env "$BACKUP_DIR/web-production.json")
  orch_b64=$(encode_env "$BACKUP_DIR/orchestrator-production.json")

  echo "$web_b64" | gh secret set ENV_WEB_PRODUCTION --repo "$GITHUB_REPO" \
    && echo "   ✅  GitHub secret ENV_WEB_PRODUCTION updated" \
    || echo "   ❌  Failed to set ENV_WEB_PRODUCTION"

  echo "$orch_b64" | gh secret set ENV_ORCHESTRATOR_PRODUCTION --repo "$GITHUB_REPO" \
    && echo "   ✅  GitHub secret ENV_ORCHESTRATOR_PRODUCTION updated" \
    || echo "   ❌  Failed to set ENV_ORCHESTRATOR_PRODUCTION"

  echo ""
  echo "   Decrypt locally:"
  echo "   echo \$ENV_WEB_PRODUCTION | base64 -d"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Backup complete: $BACKUP_DIR"
echo ""
echo "  Files:"
echo "    web-production.env           (human-readable, gitignored)"
echo "    orchestrator-production.env  (human-readable, gitignored)"
echo "    web-production.json          (raw Render format, for re-upload)"
echo "    orchestrator-production.json (raw Render format, for re-upload)"
if [[ "$UPLOAD_GITHUB" == "true" ]]; then
  echo ""
  echo "  GitHub secrets updated:"
  echo "    ENV_WEB_PRODUCTION"
  echo "    ENV_ORCHESTRATOR_PRODUCTION"
fi
echo "═══════════════════════════════════════════════════════════"
echo ""
