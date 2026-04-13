#!/usr/bin/env bash
# lib/llm.sh — LLM text generation via ClawPlay relay (free)
# stdout: raw text output from LLM

cmd_llm() {
  local subcmd="${1:-}"
  shift || true
  case "$subcmd" in
    generate) _llm_generate "$@" ;;
    help|--help|-h)
      cat << EOF
Usage: clawplay llm generate [options]

Options:
  --prompt, -p    <text>   Required. Prompt text
  --model         <id>     Model ID override (provider-specific)
  --max-tokens    <n>      Maximum output tokens
  --temperature   <float>  Sampling temperature (e.g. 0.7)
  --help, -h               Show this help

Examples:
  clawplay llm generate --prompt "Summarize this skill description"
  clawplay llm generate --prompt "..." --model ep-xxx --max-tokens 512
EOF
      ;;
    *) echo "[clawplay llm] Unknown subcommand: ${subcmd}. Try 'clawplay llm help'" >&2; exit 1 ;;
  esac
}

_llm_generate() {
  local prompt=""
  local model=""
  local max_tokens=""
  local temperature=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prompt|-p)     prompt="$2";      shift 2 ;;
      --model)         model="$2";       shift 2 ;;
      --max-tokens)    max_tokens="$2";  shift 2 ;;
      --temperature)   temperature="$2"; shift 2 ;;
      --help|-h)       cmd_llm help; return 0 ;;
      *) echo "[clawplay llm] Unknown option: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$prompt" ]]; then
    echo "[clawplay llm] ERROR: --prompt is required" >&2; exit 1
  fi

  if [[ -z "${CLAWPLAY_TOKEN:-}" ]]; then
    echo "[clawplay llm] ERROR: CLAWPLAY_TOKEN is not set." >&2
    echo "[clawplay llm] Get your token at https://clawplay.shop/dashboard" >&2
    exit 1
  fi

  source "${CLI_DIR}/lib/api.sh"

  # Build JSON body
  local json
  json=$(jq -n --arg prompt "$prompt" '{prompt: $prompt}')

  if [[ -n "$model" ]]; then
    json=$(echo "$json" | jq --arg v "$model" '. + {model: $v}')
  fi
  if [[ -n "$max_tokens" ]]; then
    json=$(echo "$json" | jq --argjson v "$max_tokens" '. + {maxTokens: $v}')
  fi
  if [[ -n "$temperature" ]]; then
    json=$(echo "$json" | jq --argjson v "$temperature" '. + {temperature: $v}')
  fi

  # Call relay
  local response
  response=$(curl -s --fail-with-body \
    -X POST "${CLAWPLAY_API_URL}/api/ability/llm/generate" \
    -H "Authorization: Bearer ${CLAWPLAY_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$json") || {
    echo "[clawplay llm] ERROR: Request to ClawPlay relay failed." >&2
    exit 1
  }

  # Handle errors
  local err
  err=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
  if [[ -n "$err" ]]; then
    echo "[clawplay llm] ERROR: $err" >&2
    exit 1
  fi

  local text
  text=$(echo "$response" | jq -r '.text // empty' 2>/dev/null)
  if [[ -z "$text" ]]; then
    echo "[clawplay llm] ERROR: LLM returned empty response" >&2
    exit 1
  fi

  echo "$text"
}
