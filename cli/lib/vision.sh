#!/usr/bin/env bash
# lib/vision.sh — Image understanding relay client
# Sends normalized request to ClawPlay relay; relay handles provider routing.
# stdout: analysis text (describe) or file path (detect/segment with --output)

source "${CLI_DIR}/lib/api.sh"

cmd_vision() {
  local subcmd="${1:-}"
  shift || true
  case "$subcmd" in
    analyze) _vision_analyze "$@" ;;
    help|--help|-h)
      cat << EOF
Usage: clawplay vision analyze [options]

Options:
  --image, -i   <path|url>  Required. Image file path or URL (repeat for multiple images)
  --prompt, -p  <text>      Required. Analysis task or question
  --provider    <ark|gemini> Provider (default: ark)
  --mode        <mode>      describe | detect | segment (default: describe)
                              describe — text description / Q&A (both providers)
                              detect  — object detection with bounding boxes (both providers)
                              segment — semantic segmentation masks (gemini only)
  --output, -o  <path>      Save result to file (detect/segment: JSON; describe: text)
  --json                    Output raw JSON to stdout (default for detect/segment)
  --help, -h                Show this help

Examples:
  clawplay vision analyze --image ./photo.jpg --prompt "描述这张图片"
  clawplay vision analyze --image ./photo.jpg --prompt "what's in this image" --provider gemini
  clawplay vision analyze --image ./photo.jpg --prompt "find all objects" --mode detect --json
  clawplay vision analyze --image ./a.jpg --image ./b.jpg --prompt "compare these images"
  clawplay vision analyze --image ./photo.jpg --mode segment --provider gemini --output ./masks.json
EOF
      ;;
    *) echo "[clawplay vision] Unknown subcommand: ${subcmd}. Try 'clawplay vision help'" >&2; exit 1 ;;
  esac
}

_vision_analyze() {
  local prompt=""
  local provider="ark"
  local mode="describe"
  local output=""
  local as_json=false
  local images=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --image|-i)  images+=("$2"); shift 2 ;;
      --prompt|-p) prompt="$2"; shift 2 ;;
      --provider)  provider="$2"; shift 2 ;;
      --mode)      mode="$2"; shift 2 ;;
      --output|-o) output="$2"; shift 2 ;;
      --json)      as_json=true; shift ;;
      --help|-h)   cmd_vision help; return 0 ;;
      *) echo "[clawplay vision] Unknown option: $1" >&2; exit 1 ;;
    esac
  done

  if [[ ${#images[@]} -eq 0 ]]; then
    echo "[clawplay vision] ERROR: at least one --image is required" >&2; exit 1
  fi

  if [[ -z "$prompt" ]]; then
    echo "[clawplay vision] ERROR: --prompt is required" >&2; exit 1
  fi

  if [[ -z "${CLAWPLAY_TOKEN:-}" ]]; then
    echo "[clawplay vision] ERROR: CLAWPLAY_TOKEN is not set." >&2
    echo "[clawplay vision] Get your token at https://clawplay.example.com/dashboard" >&2
    exit 1
  fi

  # detect/segment auto-enable JSON output
  if [[ "$mode" == "detect" || "$mode" == "segment" ]]; then
    as_json=true
  fi

  # Build images JSON array
  local images_json="[]"
  for img in "${images[@]}"; do
    if [[ "$img" == http://* || "$img" == https://* ]]; then
      # URL input
      images_json=$(echo "$images_json" | jq --arg d "$img" '. + [{"type":"url","data":$d}]')
    else
      # Local file → base64
      if [[ ! -f "$img" ]]; then
        echo "[clawplay vision] ERROR: image file not found: $img" >&2; exit 1
      fi
      local mime="image/jpeg"
      case "${img##*.}" in
        png)        mime="image/png"  ;;
        webp)       mime="image/webp" ;;
        heic|heif)  mime="image/heic" ;;
        gif)        mime="image/gif"  ;;
      esac
      local b64
      b64=$(base64 < "$img" | tr -d '\n')
      images_json=$(echo "$images_json" | jq \
        --arg d "$b64" \
        --arg m "$mime" \
        '. + [{"type":"b64","data":$d,"mimeType":$m}]')
    fi
  done

  # Build full request body
  local json
  json=$(jq -n \
    --argjson imgs "$images_json" \
    --arg prompt "$prompt" \
    --arg provider "$provider" \
    --arg mode "$mode" \
    '{images: $imgs, prompt: $prompt, provider: $provider, mode: $mode}')

  # Call relay
  local response
  response=$(curl -s --fail-with-body \
    -X POST "${CLAWPLAY_API_URL}/api/ability/vision/analyze" \
    -H "Authorization: Bearer ${CLAWPLAY_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$json") || {
    echo "[clawplay vision] ERROR: Request to ClawPlay relay failed." >&2
    exit 1
  }

  # Handle errors
  local err
  err=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
  if [[ -n "$err" ]]; then
    local reason
    reason=$(echo "$response" | jq -r '.reason // empty' 2>/dev/null)
    echo "[clawplay vision] ERROR: ${err}${reason:+ — $reason}" >&2
    exit 1
  fi

  local resp_type
  resp_type=$(echo "$response" | jq -r '.type // empty')

  if [[ "$resp_type" == "text" ]]; then
    local text
    text=$(echo "$response" | jq -r '.text')
    if [[ -n "$output" ]]; then
      echo "$text" > "$output"
      echo "$output"
    else
      echo "$text"
    fi
  elif [[ "$resp_type" == "json" ]]; then
    local data
    data=$(echo "$response" | jq '.data')
    if [[ -n "$output" ]]; then
      echo "$data" > "$output"
      # stdout: file path only (keeps AI context clean)
      echo "$output"
    else
      # stdout: JSON data
      echo "$data"
    fi
  else
    echo "[clawplay vision] ERROR: Unexpected response format from relay." >&2
    echo "$response" >&2
    exit 1
  fi
}
