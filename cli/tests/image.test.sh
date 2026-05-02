#!/usr/bin/env bash
# cli/tests/image.test.sh — Unit tests for lib/image.sh

set -uo pipefail
CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

LIB="${CLI_DIR}/lib/image.sh"

# ── Argument validation ───────────────────────────────────────────────────────

echo ""
echo "▶ image generate — argument validation"
echo ""

run_script --lib "$LIB" --fn 'cmd_image generate'
assert_contains "no prompt → error"  "--prompt is required" "$RS_STDERR"
assert_exit     "no prompt → exit 1" "1" "$RS_EXIT"

run_script --lib "$LIB" --env "CLAWPLAY_TOKEN=" --fn 'cmd_image generate --prompt "hi"'
assert_contains "no token → error"  "CLAWPLAY_TOKEN is not set" "$RS_STDERR"
assert_exit     "no token → exit 1" "1" "$RS_EXIT"

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --fn 'cmd_image generate --prompt "hi" --unknown-flag x'
assert_contains "unknown flag → error" "Unknown option" "$RS_STDERR"
assert_exit     "unknown flag → exit 1" "1" "$RS_EXIT"

echo ""
echo "▶ image generate — ref image not found"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --fn 'cmd_image generate --prompt "hi" --ref /tmp/no-such-file-xyz.png'
assert_contains "missing ref → error" "reference image not found" "$RS_STDERR"
assert_exit     "missing ref → exit 1" "1" "$RS_EXIT"

# ── URL response ──────────────────────────────────────────────────────────────

echo ""
echo "▶ image generate — URL response type"
echo ""

URL_RESPONSE='{"type":"url","url":"https://cdn.example.com/img.png"}'

# curl is called twice: once for the relay POST, once to download the image.
# We need the first call to return the JSON and the second to write bytes.
# The helpers.sh mock handles -o flag by creating an empty file, which is fine.
run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response "$URL_RESPONSE" \
  --fn 'cmd_image generate --prompt "a shrimp"'

assert_exit     "URL response → exit 0"         "0"   "$RS_EXIT"
assert_eq       "URL response → nothing on stderr" "" "$RS_STDERR"
# stdout is the output file path
assert_not_contains "stdout not base64"  "data:image" "$RS_STDOUT"
[[ -n "$RS_STDOUT" ]]
assert_eq "URL response → stdout is non-empty path" "0" "$?"

echo ""
echo "▶ image generate — b64 response type"
echo ""

# Minimal valid 1×1 white PNG base64
TINY_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
B64_RESPONSE="{\"type\":\"b64\",\"b64\":\"${TINY_B64}\"}"

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response "$B64_RESPONSE" \
  --fn 'out=$(cmd_image generate --prompt "a shrimp"); echo "$out"'

assert_exit "b64 response → exit 0"              "0"  "$RS_EXIT"
assert_eq   "b64 response → nothing on stderr"   ""   "$RS_STDERR"

echo ""
echo "▶ image generate — relay error response"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"error":"Token revoked."}' \
  --fn 'cmd_image generate --prompt "x"'
assert_contains "auth error → reconfigure hint shown" "重新配置后再试" "$RS_STDERR"
assert_contains "auth error → setup hint shown" "clawplay setup" "$RS_STDERR"
assert_exit     "auth error → exit 1"              "1" "$RS_EXIT"

echo ""
echo "▶ image generate — relay error response"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"error":"Quota exceeded.","reason":"daily limit reached"}' \
  --fn 'cmd_image generate --prompt "x"'
assert_contains "relay error → shown on stderr"     "Quota exceeded"   "$RS_STDERR"
assert_contains "relay error → reason appended"     "daily limit reached" "$RS_STDERR"
assert_exit     "relay error → exit 1"              "1" "$RS_EXIT"

echo ""
echo "▶ image generate — unexpected response format"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"type":"unknown_format"}' \
  --fn 'cmd_image generate --prompt "x"'
assert_contains "unexpected format → error" "Unexpected response format" "$RS_STDERR"
assert_exit     "unexpected format → exit 1" "1" "$RS_EXIT"

echo ""
echo "▶ image subcommand routing"
echo ""

run_script --lib "$LIB" --fn 'cmd_image help'
assert_contains "help → usage shown"  "Usage:" "$RS_STDOUT"
assert_exit     "help → exit 0"       "0"      "$RS_EXIT"

run_script --lib "$LIB" --fn 'cmd_image unknown_subcmd'
assert_contains "unknown subcmd → error" "Unknown subcommand" "$RS_STDERR"
assert_exit     "unknown subcmd → exit 1" "1" "$RS_EXIT"

summary
