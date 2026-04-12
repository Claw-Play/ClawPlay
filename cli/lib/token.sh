#!/usr/bin/env bash
# lib/token.sh — Read user info from CLAWPLAY_TOKEN via ClawPlay server
# Token is AES-256-GCM encrypted; decryption is server-side only.
# We call /api/user/me to validate and retrieve user info.

set -euo pipefail

cmd_whoami() {
  if [[ -z "${CLAWPLAY_TOKEN:-}" ]]; then
    echo "[clawplay] ERROR: CLAWPLAY_TOKEN is not set." >&2
    echo "[clawplay] Run 'clawplay help' for usage." >&2
    echo "[clawplay] Get your token at: https://clawplay.cc/dashboard" >&2
    exit 1
  fi

  # Call /api/user/me with the encrypted token (uses global CLAWPLAY_API_URL)
  local response
  response=$(curl -s \
    -H "Authorization: Bearer ${CLAWPLAY_TOKEN}" \
    "${CLAWPLAY_API_URL}/api/user/me") || {
    echo "[clawplay] ERROR: Failed to reach ClawPlay server at ${CLAWPLAY_API_URL}" >&2
    exit 1
  }

  # Check for errors
  local err
  err=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
  if [[ -n "$err" ]]; then
    echo "[clawplay] ERROR: ${err}" >&2
    exit 1
  fi

  # Extract user info
  local userId name role used limit remaining
  userId=$(echo "$response" | jq -r '.user.id // empty')
  name=$(echo "$response" | jq -r '.user.name // empty')
  role=$(echo "$response" | jq -r '.user.role // empty')
  used=$(echo "$response" | jq -r '.quota.used // 0')
  limit=$(echo "$response" | jq -r '.quota.limit // 0')
  remaining=$(echo "$response" | jq -r '.quota.remaining // 0')

  echo ""
  echo "  ClawPlay User ID: ${userId}"
  echo "  Name:             ${name}"
  echo "  Role:             ${role}"
  echo "  Quota Used:       ${used}"
  echo "  Quota Limit:      ${limit}"
  echo "  Quota Remaining:  ${remaining}"
  echo ""
}
