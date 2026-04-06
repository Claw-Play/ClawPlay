#!/usr/bin/env bash
# lib/api.sh — HTTP calls to ClawPlay server

CLAWPLAY_API_URL="${CLAWPLAY_API_URL:-https://api.clawplay.example.com}"

# Refresh CLAWPLAY_TOKEN using the refresh endpoint.
# Returns 0 on success and prints the new token to stdout.
# Returns 1 if refresh fails.
api_refresh_token() {
  if [[ -z "${CLAWPLAY_TOKEN:-}" ]]; then
    return 1
  fi

  local response
  response=$(curl -s --fail-with-body -X POST \
    "${CLAWPLAY_API_URL}/api/user/token/refresh" \
    -H "Authorization: Bearer ${CLAWPLAY_TOKEN}" \
    -H "Content-Type: application/json") || return 1

  local err
  err=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
  if [[ -n "$err" ]]; then
    return 1
  fi

  local new_token
  new_token=$(echo "$response" | jq -r '.token // empty' 2>/dev/null)
  if [[ -z "$new_token" || "$new_token" == "null" ]]; then
    return 1
  fi

  echo "$new_token"
  return 0
}

# Perform an authenticated API call with auto token refresh on 401.
# Usage: api_call <method> <path> [body_json]
# On success: outputs response body.
# On 401 expired: attempts token refresh then retries once.
api_call() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  local headers=("-H" "Content-Type: application/json")
  if [[ -n "${CLAWPLAY_TOKEN:-}" ]]; then
    headers+=("-H" "Authorization: Bearer ${CLAWPLAY_TOKEN}")
  fi

  local curl_args=("-s" "--fail-with-body" "-X" "$method" "${CLAWPLAY_API_URL}${path}" "${headers[@]}")
  [[ -n "$body" ]] && curl_args+=("-d" "$body")

  local response
  response=$(curl "${curl_args[@]}") || {
    local status=$?
    # Try to detect 401 (unauthorized) for token refresh
    if [[ $status -eq 22 ]]; then
      # curl --fail-with-body returns 22 on HTTP 4xx — check if it's a 401
      local http_code
      http_code=$(curl -s -o /dev/null -w "%{http_code}" "${curl_args[@]}" 2>/dev/null)
      if [[ "$http_code" == "401" ]]; then
        local new_token
        new_token=$(api_refresh_token) && {
          # Update token and retry once
          headers[3]="Authorization: Bearer ${new_token}"
          response=$(curl "${curl_args[@]}")
        }
      fi
    fi
    echo "$response"
    return $status
  }

  # Check if server flagged the token as needing refresh (e.g. "Token expired.")
  local err refreshed
  err=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
  refreshed=$(echo "$response" | jq -r '.refreshed // empty' 2>/dev/null)

  if [[ "$err" == *"expired"* && -z "$refreshed" ]]; then
    local new_token
    new_token=$(api_refresh_token) && {
      headers[3]="Authorization: Bearer ${new_token}"
      response=$(curl "${curl_args[@]}")
    }
  fi

  echo "$response"
}

# Check quota by calling whoami on the server (server-side validation)
api_check_quota() {
  local response
  response=$(api_call GET "/api/ability/check" 2>/dev/null) || {
    echo "[clawplay] WARNING: Could not reach ClawPlay server — skipping quota pre-check" >&2
    return 0  # Fail open: let the relay enforce quota server-side
  }

  local remaining
  remaining=$(echo "$response" | jq -r '.remaining // 0' 2>/dev/null)
  echo "$remaining"
}
