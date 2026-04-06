#!/usr/bin/env bash
# lib/image.sh — Image generation relay client
# Sends normalized request to ClawPlay relay; relay handles provider routing.
# stdout: file path only (prevents AI context explosion)

cmd_image() {
  local subcmd="${1:-}"
  shift || true
  case "$subcmd" in
    generate) _image_generate "$@" ;;
    help|--help|-h)
      cat << EOF
Usage: clawplay image generate [options]

Options:
  --prompt, -p  <text>   Required. Image generation prompt
  --size        <ratio>  Aspect ratio: 1:1 | 16:9 | 9:16 | 4:3 | 3:4 | 3:2 | 2:3 | 21:9
                         Default: 1:1
  --quality     <tier>   Resolution: 1K | 2K | 4K  (default: 2K)
  --ref         <path>   Reference image path (repeat up to 14 times)
  --output, -o  <path>   Output file path (default: /tmp/clawplay_image_XXXX.png)
  --web                  Enable web search grounding
  --help, -h             Show this help

Examples:
  clawplay image generate --prompt "a cyberpunk shrimp"
  clawplay image generate --prompt "..." --size 9:16 --quality 2K
  clawplay image generate --prompt "change outfit" --ref ./photo.png
  clawplay image generate --prompt "latest news infographic" --web
EOF
      ;;
    *) echo "[clawplay image] Unknown subcommand: ${subcmd}. Try 'clawplay image help'" >&2; exit 1 ;;
  esac
}

_image_generate() {
  local prompt=""
  local size="1:1"
  local quality="2K"
  local output=""
  local web=false
  local ref_images=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prompt|-p)   prompt="$2"; shift 2 ;;
      --size)        size="$2";   shift 2 ;;
      --quality)     quality="$2"; shift 2 ;;
      --output|-o)   output="$2"; shift 2 ;;
      --ref)         ref_images+=("$2"); shift 2 ;;
      --web)         web=true; shift ;;
      --help|-h)
        cmd_image help; return 0 ;;
      *)
        echo "[clawplay image] Unknown option: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$prompt" ]]; then
    echo "[clawplay image] ERROR: --prompt is required" >&2; exit 1
  fi

  if [[ -z "${CLAWPLAY_TOKEN:-}" ]]; then
    echo "[clawplay image] ERROR: CLAWPLAY_TOKEN is not set." >&2
    echo "[clawplay image] Get your token at https://clawplay.example.com/dashboard" >&2
    exit 1
  fi

  local out_file="${output:-$(mktemp /tmp/clawplay_image_XXXXXX.png)}"
  local api_url="${CLAWPLAY_API_URL:-https://api.clawplay.example.com}"

  # Build JSON body
  local json
  json=$(jq -n \
    --arg prompt "$prompt" \
    --arg size "$size" \
    --arg quality "$quality" \
    --argjson web "$web" \
    '{prompt: $prompt, size: $size, quality: $quality, webSearch: $web}')

  # Attach reference images as base64
  if [[ ${#ref_images[@]} -gt 0 ]]; then
    local images_json="[]"
    for ref in "${ref_images[@]}"; do
      if [[ ! -f "$ref" ]]; then
        echo "[clawplay image] ERROR: reference image not found: $ref" >&2; exit 1
      fi
      local mime="image/png"
      case "${ref##*.}" in
        jpg|jpeg) mime="image/jpeg" ;;
        webp)     mime="image/webp" ;;
        gif)      mime="image/gif"  ;;
      esac
      local b64
      b64=$(base64 < "$ref" | tr -d '\n')
      images_json=$(echo "$images_json" | jq --arg d "data:${mime};base64,${b64}" '. + [$d]')
    done
    json=$(echo "$json" | jq --argjson imgs "$images_json" '. + {refImages: $imgs}')
  fi

  # Call relay (api_call handles 401 auto-refresh)
  source "${CLI_DIR}/lib/api.sh"

  local response
  response=$(api_call POST "/api/ability/image/generate" "$json") || {
    echo "[clawplay image] ERROR: Request to ClawPlay relay failed." >&2
    exit 1
  }

  # Handle errors
  local err refreshed new_token
  err=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
  refreshed=$(echo "$response" | jq -r '.refreshed // empty' 2>/dev/null)

  # If server refreshed token, update env and echo a note
  if [[ "$refreshed" == "true" ]]; then
    new_token=$(echo "$response" | jq -r '.token // empty' 2>/dev/null)
    if [[ -n "$new_token" && "$new_token" != "null" ]]; then
      export CLAWPLAY_TOKEN="$new_token"
    fi
  fi

  if [[ -n "$err" ]]; then
    local reason
    reason=$(echo "$response" | jq -r '.reason // empty' 2>/dev/null)
    echo "[clawplay image] ERROR: ${err}${reason:+ — $reason}" >&2
    exit 1
  fi

  # Handle response: url or b64
  local resp_type
  resp_type=$(echo "$response" | jq -r '.type // empty')

  if [[ "$resp_type" == "url" ]]; then
    local img_url
    img_url=$(echo "$response" | jq -r '.url')
    curl -s -o "$out_file" "$img_url" || {
      echo "[clawplay image] ERROR: Failed to download image from provider." >&2
      exit 1
    }
  elif [[ "$resp_type" == "b64" ]]; then
    local b64
    b64=$(echo "$response" | jq -r '.b64')
    echo "$b64" | base64 -d > "$out_file"
  else
    echo "[clawplay image] ERROR: Unexpected response format from relay." >&2
    echo "$response" >&2
    exit 1
  fi

  # stdout: only the file path (keeps AI context clean)
  echo "$out_file"
}
