#!/usr/bin/env bash
# lib/api-env.sh — API URL only; no functions, no side effects beyond export.
export CLAWPLAY_API_URL="${CLAWPLAY_API_URL:-http://localhost:3000}"
