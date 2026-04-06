#!/usr/bin/env bash
# cli/tests/api.test.sh — Unit tests for lib/api.sh

set -uo pipefail
CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

LIB="${CLI_DIR}/lib/api.sh"

# ── api_call ──────────────────────────────────────────────────────────────────

echo ""
echo "▶ api_call — basic success"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"ok":true}' \
  --fn 'api_call GET /api/user/me'
assert_contains "GET → response body returned" '"ok":true' "$RS_STDOUT"
assert_exit     "GET → exit 0"                 "0"          "$RS_EXIT"

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"created":true}' \
  --fn 'api_call POST /api/skills/submit "{\"name\":\"test\"}"'
assert_contains "POST with body → response returned" '"created":true' "$RS_STDOUT"

echo ""
echo "▶ api_call — no token still works (unauthenticated)"
echo ""

run_script --lib "$LIB" \
  --curl-response '{"public":true}' \
  --fn 'api_call GET /api/skills'
assert_contains "no token → request still made" '"public":true' "$RS_STDOUT"

# ── api_check_quota ───────────────────────────────────────────────────────────

echo ""
echo "▶ api_check_quota — returns remaining count"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"remaining":750}' \
  --fn api_check_quota
assert_eq "quota check → remaining printed" "750" "$RS_STDOUT"

echo ""
echo "▶ api_check_quota — fail-open when server unreachable"
echo ""

# Simulate curl failure by making curl exit non-zero
run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --pre 'curl() { return 1; }' \
  --fn api_check_quota
assert_exit     "server unreachable → exit 0 (fail-open)" "0" "$RS_EXIT"
assert_contains "server unreachable → warning on stderr"  "WARNING" "$RS_STDERR"

# ── api_refresh_token ─────────────────────────────────────────────────────────

echo ""
echo "▶ api_refresh_token — no token → returns 1"
echo ""

run_script --lib "$LIB" \
  --fn 'api_refresh_token; echo "exit:$?"'
assert_contains "no token → returns 1" "exit:1" "$RS_STDOUT"

echo ""
echo "▶ api_refresh_token — server returns new token"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=old-tok" \
  --curl-response '{"token":"new-tok-xyz"}' \
  --fn 'result=$(api_refresh_token); echo "$result"'
assert_eq "refresh → new token printed" "new-tok-xyz" "$RS_STDOUT"

echo ""
echo "▶ api_refresh_token — server returns error → returns 1"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=bad-tok" \
  --curl-response '{"error":"Token revoked."}' \
  --fn 'api_refresh_token; echo "exit:$?"'
assert_contains "error response → returns 1" "exit:1" "$RS_STDOUT"

summary
