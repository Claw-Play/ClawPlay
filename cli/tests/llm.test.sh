#!/usr/bin/env bash
# cli/tests/llm.test.sh — Unit tests for lib/llm.sh

set -uo pipefail
CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

LIB="${CLI_DIR}/lib/llm.sh"

# ── Argument validation ───────────────────────────────────────────────────────

echo ""
echo "▶ llm generate — argument validation"
echo ""

run_script --lib "$LIB" --fn 'cmd_llm generate'
assert_contains "no prompt → error"  "--prompt is required" "$RS_STDERR"
assert_exit     "no prompt → exit 1" "1" "$RS_EXIT"

run_script --lib "$LIB" --env "CLAWPLAY_TOKEN=" --fn 'cmd_llm generate --prompt "hi"'
assert_contains "no token → error"  "CLAWPLAY_TOKEN is not set" "$RS_STDERR"
assert_exit     "no token → exit 1" "1" "$RS_EXIT"

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --fn 'cmd_llm generate --prompt "hi" --bad-flag x'
assert_contains "unknown flag → error" "Unknown option" "$RS_STDERR"
assert_exit     "unknown flag → exit 1" "1" "$RS_EXIT"

# ── Successful response ───────────────────────────────────────────────────────

echo ""
echo "▶ llm generate — successful response"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"text":"Hello from the LLM!"}' \
  --fn 'cmd_llm generate --prompt "say hi"'
assert_eq       "success → text on stdout"     "Hello from the LLM!" "$RS_STDOUT"
assert_exit     "success → exit 0"             "0"                   "$RS_EXIT"
assert_eq       "success → nothing on stderr"  ""                    "$RS_STDERR"

echo ""
echo "▶ llm generate — optional params forwarded"
echo ""

# We can't inspect what JSON was sent (it goes to curl), but we can verify
# the command accepts the flags without error
run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"text":"ok"}' \
  --fn 'cmd_llm generate --prompt "hi" --model ep-xxx-123 --max-tokens 256 --temperature 0.5'
assert_exit "optional flags accepted → exit 0" "0" "$RS_EXIT"

echo ""
echo "▶ llm generate — error response"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"error":"Token revoked."}' \
  --fn 'cmd_llm generate --prompt "x"'
assert_contains "auth error → reconfigure hint shown" "重新配置后再试" "$RS_STDERR"
assert_contains "auth error → setup hint shown" "clawplay setup" "$RS_STDERR"
assert_exit     "auth error → exit 1"           "1" "$RS_EXIT"

echo ""
echo "▶ llm generate — non-auth error response"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"error":"Quota exceeded."}' \
  --fn 'cmd_llm generate --prompt "x"'
assert_contains "error response → shown on stderr" "Quota exceeded" "$RS_STDERR"
assert_exit     "error response → exit 1"           "1" "$RS_EXIT"

echo ""
echo "▶ llm generate — empty text response"
echo ""

run_script --lib "$LIB" \
  --env "CLAWPLAY_TOKEN=tok" \
  --curl-response '{"text":""}' \
  --fn 'cmd_llm generate --prompt "x"'
assert_contains "empty text → error" "empty response" "$RS_STDERR"
assert_exit     "empty text → exit 1" "1" "$RS_EXIT"

echo ""
echo "▶ llm subcommand routing"
echo ""

run_script --lib "$LIB" --fn 'cmd_llm help'
assert_contains "help → usage shown"  "Usage:" "$RS_STDOUT"
assert_exit     "help → exit 0"       "0"      "$RS_EXIT"

run_script --lib "$LIB" --fn 'cmd_llm bad_subcmd'
assert_contains "unknown subcmd → error" "Unknown subcommand" "$RS_STDERR"
assert_exit     "unknown subcmd → exit 1" "1" "$RS_EXIT"

summary
