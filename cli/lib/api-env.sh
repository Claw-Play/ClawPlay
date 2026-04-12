#!/usr/bin/env bash
# lib/api-env.sh — API URL only; no functions, no side effects beyond export.

# Explicit env var always wins
if [[ -n "${CLAWPLAY_API_URL:-}" ]]; then
  export CLAWPLAY_API_URL
  return 0
fi

# Two install layouts:
#   dev repo:        api-env.sh is at cli/lib/api-env.sh
#                    BASH_SOURCE[0]="lib/api-env.sh" → __src_dir resolves from CWD
#   npm global:      api-env.sh is at <prefix>/lib/node_modules/clawplay/lib/api-env.sh
#                    BASH_SOURCE[0]="lib/api-env.sh" → __src_dir resolves from CWD
#                    npm layout detected by __src_dir containing lib/node_modules.
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  __src="${BASH_SOURCE[0]}"
  __src_dir="$(cd "$(dirname "$__src")" && pwd)"
  if [[ "$__src_dir" == */lib/node_modules/* ]]; then
    # npm global install: package root is one level up from __src_dir
    __root="$(cd "$__src_dir/.." && pwd)"
  else
    # dev repo: go up two levels (cli/lib → cli → project root)
    __root="$(cd "$__src_dir/../.." && pwd)"
  fi
else
  __root="$(cd ../.. && pwd)"
fi

# Local dev: only possible in dev repo layout — check for web/.env.local there
if [[ -d "${__root}/web" && -f "${__root}/web/.env.local" ]]; then
  export CLAWPLAY_API_URL="http://localhost:3000"
else
  export CLAWPLAY_API_URL="https://clawplay.cc"
fi
