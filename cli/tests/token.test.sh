#!/usr/bin/env bash
# cli/tests/token.test.sh — Unit tests for lib/token.sh (cmd_whoami)

set -uo pipefail
CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

LIB="${CLI_DIR}/lib/token.sh"

echo ""
echo "▶ whoami — missing token"
echo ""

run_script --lib "$LIB" --env "CLAWPLAY_TOKEN=" --fn cmd_whoami
assert_contains "no token → error message"    "CLAWPLAY_TOKEN is not set" "$RS_STDERR"
assert_exit     "no token → exit 1"           "1" "$RS_EXIT"
assert_eq       "no token → stdout empty"     ""  "$RS_STDOUT"

echo ""
echo "▶ whoami — API error response"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=fake-token" \
  --curl-response '{"error":"Token revoked."}' \
  --fn cmd_whoami
assert_contains "API error → reconfigure hint shown" "重新配置后再试" "$RS_STDERR"
assert_contains "API error → dashboard hint shown" "clawplay setup" "$RS_STDERR"
assert_exit     "API error → exit 1"             "1" "$RS_EXIT"

echo ""
echo "▶ whoami — successful response"
echo ""

USER_JSON='{"user":{"id":"USR-42","name":"Alice","role":"user"},"quota":{"used":10,"limit":1000,"remaining":990}}'
run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=valid-token" \
  --curl-response "$USER_JSON" \
  --fn cmd_whoami

assert_contains "success → user ID shown"        "USR-42"   "$RS_STDOUT"
assert_contains "success → name shown"           "Alice"    "$RS_STDOUT"
assert_contains "success → quota remaining"      "990"      "$RS_STDOUT"
assert_exit     "success → exit 0"               "0"        "$RS_EXIT"
assert_eq       "success → nothing on stderr"    ""         "$RS_STDERR"

echo ""
echo "▶ whoami — admin role shown"
echo ""

ADMIN_JSON='{"user":{"id":"USR-1","name":"Bob","role":"admin"},"quota":{"used":0,"limit":9999,"remaining":9999}}'
run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=admin-token" \
  --curl-response "$ADMIN_JSON" \
  --fn cmd_whoami
assert_contains "admin role displayed" "admin" "$RS_STDOUT"

summary
