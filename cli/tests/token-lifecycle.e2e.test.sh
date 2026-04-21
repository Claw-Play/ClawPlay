#!/usr/bin/env bash
# cli/tests/token-lifecycle.e2e.test.sh — End-to-end token lifecycle smoke test
#
# Covers the critical flow:
# revoked old token is rejected -> new token is accepted by setup -> whoami works

set -uo pipefail

CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

CLI_BIN="${CLI_DIR}/clawplay"
REAL_JQ="$(command -v jq)"

echo ""
echo "▶ token lifecycle e2e"
echo ""

HOME_DIR="$(mktemp -d)"
MOCK_BIN="$(mktemp -d)"
API_LOG="$(mktemp)"
OPEN_LOG="$(mktemp)"

cat > "${MOCK_BIN}/curl" << EOF
#!/usr/bin/env bash
set -euo pipefail

echo "\$*" >> "${API_LOG}"

token=""
expect_header=false
for arg in "\$@"; do
  if [[ "\$expect_header" == true ]]; then
    if [[ "\$arg" == Authorization:\ Bearer\ * ]]; then
      token="\${arg#Authorization: Bearer }"
    fi
    expect_header=false
  elif [[ "\$arg" == "-H" ]]; then
    expect_header=true
  fi
done

url="\$*"
if [[ "\$url" == *"/api/user/me"* ]]; then
  if [[ "\$token" == "old-token" ]]; then
    cat <<'JSON'
{"error":"Token revoked."}
JSON
    exit 0
  fi
  if [[ "\$token" == "new-token" ]]; then
    cat <<'JSON'
{"user":{"id":"USR-42","name":"Alice","role":"user"},"quota":{"used":10,"limit":100000,"remaining":99990}}
JSON
    exit 0
  fi
  cat <<'JSON'
{"error":"Invalid token."}
JSON
  exit 0
fi

if [[ "\$url" == *"/api/user/token/generate"* ]]; then
  cat <<'JSON'
{"token":"new-token","tokenId":"tok-new","command":"export CLAWPLAY_TOKEN=new-token","createdAt":"2026-04-22T00:00:00.000Z"}
JSON
  exit 0
fi

if [[ "\$url" == *"/api/user/token/revoke"* ]]; then
  cat <<'JSON'
{"message":"Token revoked."}
JSON
  exit 0
fi

cat <<'JSON'
{"error":"unexpected request"}
JSON
EOF
chmod +x "${MOCK_BIN}/curl"

cat > "${MOCK_BIN}/jq" << EOF
#!/usr/bin/env bash
exec "${REAL_JQ}" "\$@"
EOF
chmod +x "${MOCK_BIN}/jq"

cat > "${MOCK_BIN}/open" << 'EOF'
#!/usr/bin/env bash
echo "$*" >> "${OPEN_LOG}"
exit 0
EOF
chmod +x "${MOCK_BIN}/open"

touch "${HOME_DIR}/.zshrc"

run_cli() {
  local token_value="$1"
  local out_file err_file
  out_file=$(mktemp)
  err_file=$(mktemp)
  PATH="${MOCK_BIN}:$PATH" \
  HOME="${HOME_DIR}" \
  CLAWPLAY_API_URL="http://mock.local" \
  bash "${CLI_BIN}" setup --token "${token_value}" --lang en >"$out_file" 2>"$err_file"
  RUN_EXIT=$?
  RUN_STDOUT=$(cat "$out_file")
  RUN_STDERR=$(cat "$err_file")
  rm -f "$out_file" "$err_file"
}

run_whoami() {
  local out_file err_file
  out_file=$(mktemp)
  err_file=$(mktemp)
  PATH="${MOCK_BIN}:$PATH" \
  HOME="${HOME_DIR}" \
  CLAWPLAY_API_URL="http://mock.local" \
  CLAWPLAY_TOKEN="new-token" \
  bash "${CLI_BIN}" whoami >"$out_file" 2>"$err_file"
  WHOAMI_EXIT=$?
  WHOAMI_STDOUT=$(cat "$out_file")
  WHOAMI_STDERR=$(cat "$err_file")
  rm -f "$out_file" "$err_file"
}

run_cli "old-token"
assert_exit "old token rejected" "1" "$RUN_EXIT"
assert_contains "old token error surfaced" "Token revoked." "$RUN_STDOUT"
assert_not_contains "old token not saved" "export CLAWPLAY_TOKEN='old-token'" "$(cat "${HOME_DIR}/.zshrc")"

run_cli "new-token"
assert_exit "new token accepted" "0" "$RUN_EXIT"
assert_contains "new token saved" "export CLAWPLAY_TOKEN='new-token'" "$(cat "${HOME_DIR}/.zshrc")"
assert_contains "setup verified user/me" "Alice" "$RUN_STDOUT"
assert_contains "setup printed quota" "99990" "$RUN_STDOUT"
assert_eq "setup stderr empty" "" "$RUN_STDERR"

run_whoami
assert_exit "whoami exits 0" "0" "$WHOAMI_EXIT"
assert_contains "whoami shows user id" "USR-42" "$WHOAMI_STDOUT"
assert_contains "whoami shows remaining quota" "99990" "$WHOAMI_STDOUT"
assert_eq "whoami stderr empty" "" "$WHOAMI_STDERR"

assert_contains "API log includes user/me" "/api/user/me" "$(cat "${API_LOG}")"

rm -rf "${HOME_DIR}" "${MOCK_BIN}"
rm -f "${API_LOG}" "${OPEN_LOG}"

summary
