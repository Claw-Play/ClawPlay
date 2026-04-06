#!/usr/bin/env bash
# lib/install.sh — clawplay install <slug> [--version x.y.z] [--dir <path>]

CLAWPLAY_API_URL="${CLAWPLAY_API_URL:-https://api.clawplay.example.com}"
CLAWPLAY_SKILLS_DIR="${CLAWPLAY_SKILLS_DIR:-${HOME}/.clawplay/skills}"

cmd_install() {
  local slug=""
  local version=""
  local skills_dir="$CLAWPLAY_SKILLS_DIR"

  # Parse args
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --version|-v)
        version="$2"; shift 2 ;;
      --dir|-d)
        skills_dir="$2"; shift 2 ;;
      -*)
        error "Unknown option: $1" ;;
      *)
        if [[ -z "$slug" ]]; then
          slug="$1"; shift
        else
          error "Unexpected argument: $1"
        fi ;;
    esac
  done

  if [[ -z "$slug" ]]; then
    echo "Usage: clawplay install <slug> [--version x.y.z] [--dir <path>]" >&2
    exit 1
  fi

  # Validate slug client-side (防路径遍历)
  if [[ ! "$slug" =~ ^[a-z0-9-]+$ ]]; then
    error "Invalid slug '${slug}'. Must match [a-z0-9-]+."
  fi

  # Check dependencies
  command -v curl >/dev/null 2>&1 || error "Missing dependency: curl"
  command -v unzip >/dev/null 2>&1 || error "Missing dependency: unzip"

  # Build download URL
  local url="${CLAWPLAY_API_URL}/api/skills/${slug}/download"
  [[ -n "$version" ]] && url="${url}?version=${version}"

  local dest_dir="${skills_dir}/${slug}"
  local tmp_zip
  tmp_zip=$(mktemp)

  info "Fetching ${slug}${version:+ v${version}}..."

  # Download zip
  local http_code
  http_code=$(curl -sL -w "%{http_code}" -o "$tmp_zip" "$url")

  if [[ "$http_code" == "404" ]]; then
    rm -f "$tmp_zip"
    error "Skill '${slug}' not found (or not yet approved)."
  elif [[ "$http_code" != "200" ]]; then
    rm -f "$tmp_zip"
    error "Download failed (HTTP ${http_code})."
  fi

  # Install into dest
  mkdir -p "$dest_dir"
  unzip -o -q "$tmp_zip" -d "$dest_dir"
  rm -f "$tmp_zip"

  # Read installed version from origin.json
  local installed_version=""
  if [[ -f "${dest_dir}/origin.json" ]]; then
    installed_version=$(python3 -c "import json,sys; d=json.load(open('${dest_dir}/origin.json')); print(d.get('version',''))" 2>/dev/null || true)
  fi

  info "✅ Installed ${slug}${installed_version:+ v${installed_version}} → ${dest_dir}"
  echo "${dest_dir}"
}
