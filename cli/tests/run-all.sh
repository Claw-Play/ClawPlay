#!/usr/bin/env bash
# cli/tests/run-all.sh — Run all CLI unit tests
#
# Usage: bash cli/tests/run-all.sh
# Exit code: 0 if all pass, 1 if any fail.

set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_PASS=0
TOTAL_FAIL=0
declare -a FAILED_SUITES=()

run_suite() {
  local file="$1"
  local name
  name=$(basename "$file" .test.sh)

  echo "══════════════════════════════════════════════"
  echo "  Suite: ${name}"
  echo "══════════════════════════════════════════════"

  # Run in subshell; capture exit code
  bash "$file"
  local exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    FAILED_SUITES+=("$name")
  fi
}

# Run all *.test.sh files in order
for suite in \
  "${TESTS_DIR}/token.test.sh" \
  "${TESTS_DIR}/api.test.sh" \
  "${TESTS_DIR}/image.test.sh" \
  "${TESTS_DIR}/llm.test.sh" \
  "${TESTS_DIR}/vision.test.sh" \
  "${TESTS_DIR}/install.test.sh"; do
  run_suite "$suite"
done

echo ""
echo "══════════════════════════════════════════════"
echo "  CLI Test Run Complete"
echo "══════════════════════════════════════════════"

if [[ ${#FAILED_SUITES[@]} -gt 0 ]]; then
  echo ""
  echo "  FAILED suites:"
  for s in "${FAILED_SUITES[@]}"; do
    echo "    ✗ $s"
  done
  echo ""
  exit 1
else
  echo ""
  echo "  All suites passed."
  echo ""
fi
