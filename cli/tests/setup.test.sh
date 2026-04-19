#!/usr/bin/env bash
# cli/tests/setup.test.sh — Unit tests for clawplay setup

set -uo pipefail

CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

CLI_BIN="${CLI_DIR}/clawplay"
REAL_JQ="$(command -v jq)"

run_setup() {
  local home_dir=""
  local api_url="http://example.com"
  local mock_dir=""
  local -a setup_args=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --home)    home_dir="$2"; shift 2 ;;
      --api-url) api_url="$2";  shift 2 ;;
      --mock-dir) mock_dir="$2"; shift 2 ;;
      --) shift; setup_args=("$@"); break ;;
      *) setup_args+=("$1"); shift ;;
    esac
  done

  local tmp_out tmp_err
  tmp_out=$(mktemp)
  tmp_err=$(mktemp)

  PATH="${mock_dir}:$PATH" \
  HOME="${home_dir}" \
  CLAWPLAY_API_URL="${api_url}" \
  bash "${CLI_BIN}" "${setup_args[@]}" >"$tmp_out" 2>"$tmp_err"

  RS_EXIT=$?
  RS_STDOUT=$(cat "$tmp_out")
  RS_STDERR=$(cat "$tmp_err")
  rm -f "$tmp_out" "$tmp_err"
}

make_mock_bin_dir() {
  local dir="$1"
  local curl_log="$2"
  local open_log="$3"

  cat > "${dir}/curl" << EOF
#!/usr/bin/env bash
echo "\$*" >> "${curl_log}"
cat <<'JSON'
{"user":{"id":"USR-7","name":"Ada","role":"user"},"quota":{"used":3,"limit":50,"remaining":47}}
JSON
EOF
  chmod +x "${dir}/curl"

  cat > "${dir}/jq" << EOF
#!/usr/bin/env bash
exec "${REAL_JQ}" "\$@"
EOF
  chmod +x "${dir}/jq"

  cat > "${dir}/open" << EOF
#!/usr/bin/env bash
echo "\$*" >> "${open_log}"
exit 99
EOF
  chmod +x "${dir}/open"
}

echo ""
echo "▶ setup --agent"
echo ""

AGENT_HOME=$(mktemp -d)
AGENT_BIN=$(mktemp -d)
AGENT_CURL_LOG=$(mktemp)
AGENT_OPEN_LOG=$(mktemp)
make_mock_bin_dir "$AGENT_BIN" "$AGENT_CURL_LOG" "$AGENT_OPEN_LOG"

run_setup --home "$AGENT_HOME" --mock-dir "$AGENT_BIN" -- setup --agent --lang en

assert_contains "agent mode headline" "ClawPlay CLI Setup Guide" "$RS_STDOUT"
assert_contains "agent mode includes login url" "login / registration page" "$RS_STDOUT"
assert_contains "agent mode includes token command" "clawplay setup --token" "$RS_STDOUT"
assert_eq "agent mode exit 0" "0" "$RS_EXIT"
assert_eq "agent mode stderr empty" "" "$RS_STDERR"
assert_eq "agent mode no curl" "" "$(cat "$AGENT_CURL_LOG")"
assert_eq "agent mode no open" "" "$(cat "$AGENT_OPEN_LOG" 2>/dev/null)"

rm -rf "$AGENT_HOME" "$AGENT_BIN"
rm -f "$AGENT_CURL_LOG" "$AGENT_OPEN_LOG"

echo ""
echo "▶ setup --token"
echo ""

TOKEN_HOME=$(mktemp -d)
TOKEN_BIN=$(mktemp -d)
TOKEN_CURL_LOG=$(mktemp)
TOKEN_OPEN_LOG=$(mktemp)
make_mock_bin_dir "$TOKEN_BIN" "$TOKEN_CURL_LOG" "$TOKEN_OPEN_LOG"

touch "${TOKEN_HOME}/.zshrc"

run_setup --home "$TOKEN_HOME" --mock-dir "$TOKEN_BIN" -- setup --token "export CLAWPLAY_TOKEN=tok_123" --lang en

assert_contains "token mode skips TUI headline" "Setup complete" "$RS_STDOUT"
assert_contains "token mode verifies user" "Ada" "$RS_STDOUT"
assert_contains "token mode saves token" "${TOKEN_HOME}/.zshrc" "$RS_STDOUT"
assert_eq "token mode exit 0" "0" "$RS_EXIT"
assert_eq "token mode stderr empty" "" "$RS_STDERR"
assert_contains "token mode writes shell profile" "export CLAWPLAY_TOKEN='tok_123'" "$(cat "${TOKEN_HOME}/.zshrc")"
assert_eq "token mode no open" "" "$(cat "$TOKEN_OPEN_LOG" 2>/dev/null)"
assert_contains "token mode no curl prompt" "api/user/me" "$(cat "$TOKEN_CURL_LOG")"

rm -rf "$TOKEN_HOME" "$TOKEN_BIN"
rm -f "$TOKEN_CURL_LOG" "$TOKEN_OPEN_LOG"

summary
