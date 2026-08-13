#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

set -a
source .env
set +a

export N8N_COOKIE_JAR="${N8N_COOKIE_JAR:-/tmp/n8n-verify-cookies.txt}"

# Log in fresh each run so the script works from a clean checkout without
# any pre-existing session state.
curl -s -c "${N8N_COOKIE_JAR}" -X POST "${N8N_API_URL}/rest/login" \
  -H 'Content-Type: application/json' \
  -d "{\"emailOrLdapLoginId\":\"${N8N_OWNER_EMAIL}\",\"password\":\"${N8N_OWNER_PASSWORD}\"}" \
  > /dev/null

python3 scripts/verify_workflows.py
