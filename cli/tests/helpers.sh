#!/usr/bin/env bash
# cli/tests/helpers.sh — Shared test harness for all CLI unit tests
#
# Source this file at the top of each test:
#   source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

PASS=0
FAIL=0
declare -a FAILED_TESTS=()

pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1"; echo "    $2"; ((FAIL++)); FAILED_TESTS+=("$1"); }

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then pass "$desc"
  else fail "$desc" "expected: '${expected}'  got: '${actual}'"; fi
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then pass "$desc"
  else fail "$desc" "expected to contain: '${needle}'  got: '${haystack}'"; fi
}

assert_not_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if [[ "$haystack" != *"$needle"* ]]; then pass "$desc"
  else fail "$desc" "expected NOT to contain: '${needle}'  got: '${haystack}'"; fi
}

assert_file_exists() {
  local desc="$1" file="$2"
  if [[ -f "$file" ]]; then pass "$desc"
  else fail "$desc" "file not found: ${file}"; fi
}

assert_exit() {
  local desc="$1" expected="$2" actual="$3"
  assert_eq "$desc" "$expected" "$actual"
}

# summary — print final results and exit 1 if any failures
summary() {
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
}

# run_script — run a bash snippet in an isolated subprocess with mocked curl.
#
# Usage:
#   run_script \
#     --lib     <path>          lib file to source (required)
#     --fn      <name> [args…]  function call (required)
#     --curl-response <json>    curl mock stdout (default: '{}')
#     --curl-http     <code>    http_code printed after -w "%{http_code}" (default: 200)
#     --env     KEY=VAL         extra env variable (repeatable)
#     --pre     <code>          bash snippet inserted before the function call
#
# Sets after call: RS_STDOUT, RS_STDERR, RS_EXIT
#
run_script() {
  local lib=""
  local fn_call=""
  local curl_response='{}'
  local curl_http="200"
  local -a env_vars=()
  local pre_code=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --lib)           lib="$2";            shift 2 ;;
      --fn)            shift; fn_call="$*"; break   ;;
      --curl-response) curl_response="$2";  shift 2 ;;
      --curl-http)     curl_http="$2";      shift 2 ;;
      --env)           env_vars+=("$2");    shift 2 ;;
      --pre)           pre_code="$2";       shift 2 ;;
      *) echo "run_script: unknown arg $1" >&2; return 1 ;;
    esac
  done

  local tmp_script tmp_out tmp_err
  tmp_script=$(mktemp); tmp_out=$(mktemp); tmp_err=$(mktemp)

  # Build env lines
  local env_lines=""
  if [[ ${#env_vars[@]} -gt 0 ]]; then
    for kv in "${env_vars[@]}"; do
      env_lines+="export $(printf '%q' "$kv")"$'\n'
    done
  fi

  # Escape curl_response for embedding in heredoc
  local escaped_response
  escaped_response=$(printf '%s' "$curl_response" | sed "s/'/'\\\\''/g")

  cat > "$tmp_script" << SCRIPT
#!/usr/bin/env bash
set -uo pipefail

CLI_DIR="${CLI_DIR}"
${env_lines}
  # Source api.sh for CLAWPLAY_API_URL and shared helpers
  source "\${CLI_DIR}/lib/api.sh"

info()  { echo "[info] \$*" >&2; }
warn()  { echo "[warn] \$*" >&2; }
error() { echo "[error] \$*" >&2; exit 1; }

# curl mock
# - If called with -w "%{http_code}": prints http code only
# - Otherwise: prints MOCK_RESPONSE (the JSON body)
MOCK_RESPONSE='${escaped_response}'
MOCK_HTTP='${curl_http}'

curl() {
  local has_w=false has_o=false outfile=""
  local args=("\$@")
  for ((i=0; i<\${#args[@]}; i++)); do
    [[ "\${args[\$i]}" == "-w" ]] && has_w=true
    if [[ "\${args[\$i]}" == "-o" ]]; then
      has_o=true
      outfile="\${args[\$(( i+1 ))]}"
    fi
  done
  if \$has_o && [[ -n "\$outfile" ]]; then
    printf '' > "\$outfile"   # create empty file (caller downloads to it)
  fi
  if \$has_w; then
    echo "\$MOCK_HTTP"
  else
    echo "\$MOCK_RESPONSE"
  fi
}

${pre_code}

source '${lib}'
${fn_call}
SCRIPT

  bash "$tmp_script" >"$tmp_out" 2>"$tmp_err"
  RS_EXIT=$?
  RS_STDOUT=$(cat "$tmp_out")
  RS_STDERR=$(cat "$tmp_err")
  rm -f "$tmp_script" "$tmp_out" "$tmp_err"
}
