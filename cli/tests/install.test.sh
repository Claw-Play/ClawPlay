#!/usr/bin/env bash
# cli/tests/install.test.sh — Unit tests for lib/install.sh
#
# Usage: bash cli/tests/install.test.sh
# No external dependencies — curl/unzip are mocked via function override.

set -uo pipefail

CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Harness ───────────────────────────────────────────────────────────────────

PASS=0
FAIL=0
declare -a FAILED_TESTS=()

pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1"; echo "    $2"; ((FAIL++)); FAILED_TESTS+=("$1"); }

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then pass "$desc"
  else fail "$desc" "expected to contain: '$needle'  got: '$haystack'"; fi
}
assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then pass "$desc"
  else fail "$desc" "expected: '$expected'  got: '$actual'"; fi
}
assert_file_exists() {
  local desc="$1" file="$2"
  if [[ -f "$file" ]]; then pass "$desc"
  else fail "$desc" "file not found: $file"; fi
}

# Run cmd_install with mocked helpers; capture stdout, stderr, exit code.
# Usage: run_install [--mock-http <code>] [--mock-zip <path>] [--skills-dir <path>] [-- install args...]
#
# Globals set after call: RI_STDOUT, RI_STDERR, RI_EXIT
run_install() {
  local mock_http="200"
  local mock_zip=""
  local skills_dir="${HOME}/.clawplay/skills"
  local install_args=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --mock-http)   mock_http="$2";   shift 2 ;;
      --mock-zip)    mock_zip="$2";    shift 2 ;;
      --skills-dir)  skills_dir="$2";  shift 2 ;;
      --)            shift; install_args=("$@"); break ;;
      *)             install_args+=("$1"); shift ;;
    esac
  done

  local tmp_out tmp_err tmp_script
  tmp_out=$(mktemp); tmp_err=$(mktemp)
  tmp_script=$(mktemp /tmp/clawplay-test-XXXXXX.sh)

  # Build quoted arg string safely
  local args_str=""
  for a in "${install_args[@]+"${install_args[@]}"}"; do
    args_str+=" $(printf '%q' "$a")"
  done

  cat > "$tmp_script" << SCRIPT
#!/usr/bin/env bash
set -uo pipefail

CLI_DIR="${CLI_DIR}"
MOCK_HTTP="${mock_http}"
MOCK_ZIP="${mock_zip}"
CLAWPLAY_SKILLS_DIR="${skills_dir}"

info()  { echo "[info] \$*" >&2; }
warn()  { echo "[warn] \$*" >&2; }
error() { echo "[error] \$*" >&2; exit 1; }

curl() {
  local args=("\$@")
  local outfile=""
  for ((i=0; i<\${#args[@]}; i++)); do
    [[ "\${args[\$i]}" == "-o" ]] && outfile="\${args[\$(( i+1 ))]}"
    if [[ "\${args[\$i]}" == *"/api/skills/"* ]]; then
      echo "\${args[\$i]}" > "\${URL_CAPTURE_FILE:-/dev/null}"
    fi
  done
  if [[ -n "\$outfile" && -n "\$MOCK_ZIP" && -f "\$MOCK_ZIP" ]]; then
    cp "\$MOCK_ZIP" "\$outfile"
  elif [[ -n "\$outfile" ]]; then
    touch "\$outfile"
  fi
  echo "\$MOCK_HTTP"
}

source "\${CLI_DIR}/lib/install.sh"
cmd_install${args_str}
SCRIPT

  bash "$tmp_script" >"$tmp_out" 2>"$tmp_err"
  RI_EXIT=$?
  RI_STDOUT=$(cat "$tmp_out")
  RI_STDERR=$(cat "$tmp_err")
  rm -f "$tmp_script" "$tmp_out" "$tmp_err"
}

# ── Test: slug validation ─────────────────────────────────────────────────────

echo ""
echo "▶ slug validation"
echo ""

run_install --mock-http 404
assert_contains "no slug → prints Usage" "Usage:" "$RI_STDERR"

run_install --mock-http 404 -- "Bad_Slug"
assert_contains "uppercase slug → error" "Invalid slug" "$RI_STDERR"

run_install --mock-http 404 -- "../etc/passwd"
assert_contains "path traversal → error" "Invalid slug" "$RI_STDERR"

run_install --mock-http 404 -- "has-no-spaces-but-UPPER"
assert_contains "mixed case slug → error" "Invalid slug" "$RI_STDERR"

# ── Test: HTTP errors ─────────────────────────────────────────────────────────

echo ""
echo "▶ HTTP error handling"
echo ""

run_install --mock-http 404 -- "nonexistent-skill"
assert_contains "HTTP 404 → not found message" "not found" "$RI_STDERR"
assert_eq "HTTP 404 → exit 1" "1" "$RI_EXIT"

run_install --mock-http 500 -- "some-skill"
assert_contains "HTTP 500 → download failed" "Download failed" "$RI_STDERR"
assert_eq "HTTP 500 → exit 1" "1" "$RI_EXIT"

run_install --mock-http 403 -- "some-skill"
assert_contains "HTTP 403 → download failed" "Download failed" "$RI_STDERR"

# ── Test: successful install ──────────────────────────────────────────────────

echo ""
echo "▶ successful install"
echo ""

INSTALL_DIR=$(mktemp -d)
MOCK_ZIP_DIR=$(mktemp -d)
MOCK_ZIP_FILE="${MOCK_ZIP_DIR}/test.zip"

# Build a real zip (unzip needs a real zip; path must not pre-exist for zip)
tmp_src=$(mktemp -d)
echo "# Test SKILL.md content" > "${tmp_src}/SKILL.md"
echo '{"slug":"test-skill","version":"1.0.0","source":"clawplay"}' > "${tmp_src}/origin.json"
(cd "$tmp_src" && zip -q "$MOCK_ZIP_FILE" SKILL.md origin.json)
rm -rf "$tmp_src"

run_install --mock-http 200 --mock-zip "$MOCK_ZIP_FILE" --skills-dir "$INSTALL_DIR" -- "test-skill"

assert_eq   "stdout is install path" "${INSTALL_DIR}/test-skill" "$RI_STDOUT"
assert_file_exists "SKILL.md extracted"    "${INSTALL_DIR}/test-skill/SKILL.md"
assert_file_exists "origin.json extracted" "${INSTALL_DIR}/test-skill/origin.json"
assert_eq   "exit 0 on success" "0" "$RI_EXIT"

rm -rf "$MOCK_ZIP_DIR" "$INSTALL_DIR"

# ── Test: install report on success ────────────────────────────────────────────

echo ""
echo "▶ install report to server"
echo ""

INSTALL_DIR2=$(mktemp -d)
MOCK_ZIP_DIR2=$(mktemp -d)
MOCK_ZIP_FILE2="${MOCK_ZIP_DIR2}/test.zip"

tmp_src2=$(mktemp -d)
echo "# SKILL" > "${tmp_src2}/SKILL.md"
echo '{"slug":"rpt-skill","version":"2.0.0","source":"clawplay"}' > "${tmp_src2}/origin.json"
(cd "$tmp_src2" && zip -q "$MOCK_ZIP_FILE2" SKILL.md origin.json)
rm -rf "$tmp_src2"

INSTALL_REPORT_FILE=$(mktemp)
export INSTALL_REPORT_FILE

INSTALL_TOKEN="test-token-abc123"
export CLAWPLAY_TOKEN="$INSTALL_TOKEN"

tmp_script2=$(mktemp /tmp/clawplay-test-XXXXXX.sh)
cat > "$tmp_script2" << 'SCRIPT'
#!/usr/bin/env bash
set -uo pipefail
CLI_DIR="${CLI_DIR}"
MOCK_ZIP="${MOCK_ZIP}"
INSTALL_DIR="${INSTALL_DIR}"
INSTALL_TOKEN="${INSTALL_TOKEN}"
INSTALL_REPORT_FILE="${INSTALL_REPORT_FILE}"

info()  { echo "[info] $*" >&2; }
warn()  { echo "[warn] $*" >&2; }
error() { echo "[error] $*" >&2; exit 1; }

# Mock curl: capture download URL for version test, capture install report + auth header
curl() {
  local args=("$@")
  local capturing_auth=false
  local auth_header=""
  local found_install=false
  local install_url=""
  for ((i=0; i<${#args[@]}; i++)); do
    if [[ "$capturing_auth" == "true" ]]; then
      auth_header="${args[$i]}"
      capturing_auth=false
    fi
    [[ "${args[$i]}" == "-H" ]] && capturing_auth=true
    # Mark install URL but keep processing to find auth header
    if [[ "${args[$i]}" == *"/api/skills/"*"/install"* ]]; then
      found_install=true
      install_url="${args[$i]}"
    fi
  done
  if [[ "$found_install" == "true" ]]; then
    echo "INSTALL_REPORT:$install_url" >> "$INSTALL_REPORT_FILE"
    [[ -n "$auth_header" ]] && echo "INSTALL_AUTH:$auth_header" >> "$INSTALL_REPORT_FILE"
    echo "200"
    return
  fi
  local outfile=""
  for ((i=0; i<${#args[@]}; i++)); do
    [[ "${args[$i]}" == "-o" ]] && outfile="${args[$(( i+1 ))]}"
  done
  if [[ -n "$outfile" && -f "$MOCK_ZIP" ]]; then
    cp "$MOCK_ZIP" "$outfile"
  elif [[ -n "$outfile" ]]; then
    touch "$outfile"
  fi
  echo "200"
}

source "${CLI_DIR}/lib/api.sh"
source "${CLI_DIR}/lib/install.sh"
cmd_install "rpt-skill" >/dev/null 2>&1 || true
SCRIPT

sed -i '' "s|\${CLI_DIR}|${CLI_DIR}|g; s|\${MOCK_ZIP}|${MOCK_ZIP_FILE2}|g; s|\${INSTALL_DIR}|${INSTALL_DIR2}|g; s|\${INSTALL_TOKEN}|${INSTALL_TOKEN}|g; s|\${INSTALL_REPORT_FILE}|${INSTALL_REPORT_FILE}|g" "$tmp_script2"
bash "$tmp_script2" 2>/dev/null || true
rm -f "$tmp_script2"

captured=$(cat "$INSTALL_REPORT_FILE" 2>/dev/null || true)
assert_contains "install report POST to /api/skills/rpt-skill/install" "/api/skills/rpt-skill/install" "$captured"
assert_contains "install report includes Bearer token" "Authorization: Bearer ${INSTALL_TOKEN}" "$captured"

rm -f "$INSTALL_REPORT_FILE" "$MOCK_ZIP_FILE2" "$MOCK_ZIP_DIR2"
unset CLAWPLAY_TOKEN INSTALL_TOKEN

# ── Test: --version flag ──────────────────────────────────────────────────────

echo ""
echo "▶ --version flag"
echo ""

URL_CAPTURE_FILE=$(mktemp)
export URL_CAPTURE_FILE

# Inline script that also sets URL_CAPTURE_FILE for the curl mock
tmp_script=$(mktemp /tmp/clawplay-test-XXXXXX.sh)
cat > "$tmp_script" << 'SCRIPT'
#!/usr/bin/env bash
set -uo pipefail
info()  { :; }; warn() { :; }; error() { echo "[error] $*" >&2; exit 1; }
curl() {
  local args=("$@")
  for ((i=0; i<${#args[@]}; i++)); do
    if [[ "${args[$i]}" == *"/api/skills/"* ]]; then
      echo "${args[$i]}" > "$URL_CAPTURE_FILE"
    fi
  done
  echo "404"
}
source "${CLI_DIR}/lib/api.sh"
source "${CLI_DIR}/lib/install.sh"
cmd_install "my-skill" --version "1.2.3" 2>/dev/null || true
SCRIPT

# Substitute CLI_DIR
sed -i '' "s|\${CLI_DIR}|${CLI_DIR}|g" "$tmp_script"
bash "$tmp_script" 2>/dev/null || true

captured_url=$(cat "$URL_CAPTURE_FILE" 2>/dev/null || true)
assert_contains "--version 1.2.3 appended to URL" "?version=1.2.3" "$captured_url"

rm -f "$tmp_script" "$URL_CAPTURE_FILE"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────────────"
echo "Results: ${PASS} passed, ${FAIL} failed"
if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
  echo ""
  echo "Failed:"
  for t in "${FAILED_TESTS[@]}"; do echo "  - $t"; done
  echo ""
  exit 1
fi
echo "────────────────────────────────────────"
echo ""
