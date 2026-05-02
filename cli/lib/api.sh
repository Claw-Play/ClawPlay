#!/usr/bin/env bash
# lib/api.sh — HTTP calls to ClawPlay server
# Exports CLAWPLAY_API_URL and provides api_call with 401 auto-refresh.

# Auto-detect nearest server based on user IP (CN → domestic, otherwise → overseas).
# Explicit CLAWPLAY_API_URL always takes priority.
_auto_detect_api_url() {
  local country
  country=$(curl -s --max-time 3 "https://ipapi.co/country/" 2>/dev/null) || country=""

  if [[ "$country" == "CN" ]]; then
    echo "https://clawplay.com.cn"
  else
    echo "https://clawplay.shop"
  fi
}

if [[ -z "${CLAWPLAY_API_URL:-}" ]]; then
  export CLAWPLAY_API_URL="$(_auto_detect_api_url)"
fi

clawplay_detect_lang() {
  local locale="${CLAWPLAY_LANG:-}"
  if [[ -z "$locale" ]]; then
    locale="${LANG:-}${LC_ALL:-}"
  fi

  if [[ "$locale" =~ zh ]]; then
    echo "zh"
  else
    echo "en"
  fi
}

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

# Return 0 when a response looks like an auth failure that should prompt the
# user to reconfigure their key.
api_is_auth_error_response() {
  local response="${1:-}"
  local err

  if [[ -z "$response" ]]; then
    return 1
  fi

  err=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
  err=$(printf '%s' "$err" | tr '[:upper:]' '[:lower:]')

  printf '%s' "$err" | grep -Eiq 'unauthorized|not authorized|invalid token|token revoked|token expired|token invalid|authentication required|未授权|令牌失效|密钥失效'
}

# Print a consistent guidance message for revoked/invalid keys.
api_print_reconfigure_key_hint() {
  local prefix="${1:-[clawplay]}"
  local lang
  lang="$(clawplay_detect_lang)"

  if [[ "$lang" == "zh" ]]; then
    echo "${prefix} ERROR: 你的 ClawPlay 密钥已失效或已被撤销，请重新配置后再试。" >&2
    echo "${prefix} 运行 'clawplay setup' 重新绑定密钥，或前往 https://clawplay.shop/dashboard 重新生成。" >&2
  else
    echo "${prefix} ERROR: Your ClawPlay key has expired or been revoked. Please reconfigure it and try again." >&2
    echo "${prefix} Run 'clawplay setup' to bind a new key, or visit https://clawplay.shop/dashboard to regenerate one." >&2
  fi
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
