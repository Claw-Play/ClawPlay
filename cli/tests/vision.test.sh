#!/usr/bin/env bash
# cli/tests/vision.test.sh — Unit tests for lib/vision.sh

set -uo pipefail
CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

LIB="${CLI_DIR}/lib/vision.sh"

# ── Test fixtures ─────────────────────────────────────────────────────────────

# Create a tiny test image file for local-file tests
TEST_IMG_DIR=$(mktemp -d)
TEST_PNG="${TEST_IMG_DIR}/test.png"
# Minimal 1×1 white PNG (binary-safe via base64 decode)
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" \
  | base64 -d > "$TEST_PNG"

cleanup() { rm -rf "$TEST_IMG_DIR"; }
trap cleanup EXIT

# ── Argument validation ───────────────────────────────────────────────────────

echo ""
echo "▶ vision analyze — argument validation"
echo ""

run_script --lib "$LIB" --fn 'cmd_vision analyze'
assert_contains "no image → error"  "at least one --image" "$RS_STDERR"
assert_exit     "no image → exit 1" "1" "$RS_EXIT"

run_script --lib "$LIB" \
  --fn "cmd_vision analyze --image ${TEST_PNG}"
assert_contains "no prompt → error"  "--prompt is required" "$RS_STDERR"
assert_exit     "no prompt → exit 1" "1" "$RS_EXIT"

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=" \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'describe'"
assert_contains "no token → error"  "CLAWPLAY_TOKEN is not set" "$RS_STDERR"
assert_exit     "no token → exit 1" "1" "$RS_EXIT"

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'x' --unknown-opt"
assert_contains "unknown option → error" "Unknown option" "$RS_STDERR"
assert_exit     "unknown option → exit 1" "1" "$RS_EXIT"

echo ""
echo "▶ vision analyze — missing local file"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --fn 'cmd_vision analyze --image /tmp/no-such-file-xyz.jpg --prompt "x"'
assert_contains "missing file → error" "image file not found" "$RS_STDERR"
assert_exit     "missing file → exit 1" "1" "$RS_EXIT"

# ── Text (describe) response ──────────────────────────────────────────────────

echo ""
echo "▶ vision analyze — text response (describe mode)"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"type":"text","text":"A small white square."}' \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'describe'"
assert_eq      "text response → printed to stdout"  "A small white square." "$RS_STDOUT"
assert_exit    "text response → exit 0"             "0"                     "$RS_EXIT"
assert_eq      "text response → nothing on stderr"  ""                      "$RS_STDERR"

echo ""
echo "▶ vision analyze — text response with --output"
echo ""

OUT_FILE="${TEST_IMG_DIR}/result.txt"
run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"type":"text","text":"A white square."}' \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'describe' --output ${OUT_FILE}"
assert_eq          "text + output → stdout is file path" "$OUT_FILE" "$RS_STDOUT"
assert_file_exists "text + output → file created"        "$OUT_FILE"

# ── JSON (detect) response ────────────────────────────────────────────────────

echo ""
echo "▶ vision analyze — JSON response (detect mode)"
echo ""

DETECT_RESPONSE='{"type":"json","data":[{"label":"cat","box":[10,20,100,200]}]}'
run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response "$DETECT_RESPONSE" \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'find objects' --mode detect"
assert_contains "detect → JSON on stdout" '"label"' "$RS_STDOUT"
assert_contains "detect → JSON contains value" '"cat"' "$RS_STDOUT"
assert_exit     "detect → exit 0"         "0"             "$RS_EXIT"

echo ""
echo "▶ vision analyze — detect mode auto-enables JSON output"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response "$DETECT_RESPONSE" \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'x' --mode detect"
# No --json flag needed — detect auto-enables JSON
assert_contains "detect auto-json → data present" '"label"' "$RS_STDOUT"

echo ""
echo "▶ vision analyze — JSON response with --output"
echo ""

JSON_OUT="${TEST_IMG_DIR}/boxes.json"
run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response "$DETECT_RESPONSE" \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'x' --mode detect --output ${JSON_OUT}"
assert_eq          "detect + output → stdout is file path" "$JSON_OUT" "$RS_STDOUT"
assert_file_exists "detect + output → file created"        "$JSON_OUT"

# ── URL image input ───────────────────────────────────────────────────────────

echo ""
echo "▶ vision analyze — URL image input"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"type":"text","text":"A remote image."}' \
  --fn 'cmd_vision analyze --image https://example.com/photo.jpg --prompt "describe"'
assert_eq   "URL image → text response" "A remote image." "$RS_STDOUT"
assert_exit "URL image → exit 0"        "0"              "$RS_EXIT"

# ── Error response ────────────────────────────────────────────────────────────

echo ""
echo "▶ vision analyze — relay error"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"error":"Token revoked."}' \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'x'"
assert_contains "auth error → reconfigure hint shown" "重新配置后再试" "$RS_STDERR"
assert_contains "auth error → setup hint shown" "clawplay setup" "$RS_STDERR"
assert_exit     "auth error → exit 1"              "1" "$RS_EXIT"

echo ""
echo "▶ vision analyze — relay error"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"error":"Image too large.","reason":"max 10MB"}' \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'x'"
assert_contains "relay error → shown on stderr"    "Image too large"  "$RS_STDERR"
assert_contains "relay error → reason appended"    "max 10MB"         "$RS_STDERR"
assert_exit     "relay error → exit 1"             "1" "$RS_EXIT"

echo ""
echo "▶ vision analyze — unexpected response format"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"type":"audio"}' \
  --fn "cmd_vision analyze --image ${TEST_PNG} --prompt 'x'"
assert_contains "unexpected format → error" "Unexpected response format" "$RS_STDERR"
assert_exit     "unexpected format → exit 1" "1" "$RS_EXIT"

echo ""
echo "▶ vision subcommand routing"
echo ""

run_script --lib "$LIB" --fn 'cmd_vision help'
assert_contains "help → usage shown"  "Usage:" "$RS_STDOUT"
assert_exit     "help → exit 0"       "0"      "$RS_EXIT"

run_script --lib "$LIB" --fn 'cmd_vision bad_subcmd'
assert_contains "unknown subcmd → error" "Unknown subcommand" "$RS_STDERR"
assert_exit     "unknown subcmd → exit 1" "1" "$RS_EXIT"

summary
