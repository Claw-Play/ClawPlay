#!/usr/bin/env bash
# lib/install.sh — clawplay install <slug> [--version x.y.z] [--dir <path>]
INSTALL_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${INSTALL_LIB_DIR}/api-env.sh"
source "${INSTALL_LIB_DIR}/api.sh"
CLAWPLAY_SKILLS_DIR="${CLAWPLAY_SKILLS_DIR:-${HOME}/.clawplay/skills}"

_install_lang() {
  clawplay_detect_lang
}

_install_msg() {
  local lang
  lang="$(_install_lang)"
  case "$lang:$1" in
    zh:usage) echo "用法: clawplay install <slug> [--version x.y.z] [--dir <path>]" ;;
    en:usage) echo "Usage: clawplay install <slug> [--version x.y.z] [--dir <path>]" ;;
    zh:unknown_option) echo "未知选项: $2" ;;
    en:unknown_option) echo "Unknown option: $2" ;;
    zh:unexpected_argument) echo "意外参数: $2" ;;
    en:unexpected_argument) echo "Unexpected argument: $2" ;;
    zh:invalid_slug) echo "无效的 slug '${2}'，必须匹配 [a-z0-9-]+" ;;
    en:invalid_slug) echo "Invalid slug '${2}'. Must match [a-z0-9-]+." ;;
    zh:missing_dep_curl) echo "缺少依赖: curl，请先安装。" ;;
    en:missing_dep_curl) echo "Missing dependency: curl. Install it first." ;;
    zh:missing_dep_unzip) echo "缺少依赖: unzip，请先安装。" ;;
    en:missing_dep_unzip) echo "Missing dependency: unzip. Install it first." ;;
    zh:fetching) echo "正在获取 ${2}${3:+ v${3}}..." ;;
    en:fetching) echo "Fetching ${2}${3:+ v${3}}..." ;;
    zh:conn_failed) echo "连接失败：curl 退出码 ${2}。请检查网络或 CLAWPLAY_API_URL。" ;;
    en:conn_failed) echo "Connection failed: curl exited with code ${2}. Check network or CLAWPLAY_API_URL." ;;
    zh:server_empty) echo "服务器无响应（HTTP 状态为空）。" ;;
    en:server_empty) echo "Server did not respond (empty HTTP status)." ;;
    zh:not_found) echo "技能 '${2}' 未找到（可能尚未通过审核）。" ;;
    en:not_found) echo "Skill '${2}' not found (or not yet approved)." ;;
    zh:download_failed) echo "下载失败（HTTP ${2}）。" ;;
    en:download_failed) echo "Download failed (HTTP ${2})." ;;
    zh:installed) echo "✅ 已安装 ${2}${3:+ v${3}} → ${4}" ;;
    en:installed) echo "✅ Installed ${2}${3:+ v${3}} → ${4}" ;;
    *) echo "$1" ;;
  esac
}

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
        error "$(_install_msg unknown_option "$1")" ;;
      *)
        if [[ -z "$slug" ]]; then
          slug="$1"; shift
        else
          error "$(_install_msg unexpected_argument "$1")"
        fi ;;
    esac
  done

  if [[ -z "$slug" ]]; then
    echo "$(_install_msg usage)" >&2
    exit 1
  fi

  # Validate slug client-side (防路径遍历)
  if [[ ! "$slug" =~ ^[a-z0-9-]+$ ]]; then
    error "$(_install_msg invalid_slug "$slug")"
  fi

  # Check dependencies
  command -v curl >/dev/null 2>&1 || error "$(_install_msg missing_dep_curl)"
  command -v unzip >/dev/null 2>&1 || error "$(_install_msg missing_dep_unzip)"

  # Build download URL
  local url="${CLAWPLAY_API_URL}/api/skills/${slug}/download"
  [[ -n "$version" ]] && url="${url}?version=${version}"

  local dest_dir="${skills_dir}/${slug}"
  local tmp_zip
  tmp_zip=$(mktemp)

  info "$(_install_msg fetching "$slug" "$version")"

  # Download zip
  local http_code
  http_code=$(curl -sL -w "%{http_code}" -o "$tmp_zip" "$url" 2>&1)
  local curl_err=$?

  if [[ $curl_err -ne 0 ]]; then
    rm -f "$tmp_zip"
    error "$(_install_msg conn_failed "$curl_err")"
  fi

  if [[ -z "$http_code" ]]; then
    rm -f "$tmp_zip"
    error "$(_install_msg server_empty)"
  fi

  if [[ "$http_code" == "404" ]]; then
    rm -f "$tmp_zip"
    error "$(_install_msg not_found "$slug")"
  elif [[ "$http_code" != "200" ]]; then
    rm -f "$tmp_zip"
    error "$(_install_msg download_failed "$http_code")"
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

  # Fire-and-forget: report install to server (non-blocking, no-quota)
  # Even if this fails (no token, network error), the install itself succeeded.
  _report_install "$slug"

  info "$(_install_msg installed "$slug" "$installed_version" "$dest_dir")"
  echo "${dest_dir}"
}

# Report install to server so statsInstalls is incremented.
# Non-blocking — failures are silently ignored.
_report_install() {
  local slug="$1"
  [[ -z "${CLAWPLAY_TOKEN:-}" ]] && return 0

  # Use api_call; ignore errors (install already succeeded)
  api_call POST "/api/skills/${slug}/install" "{}" >/dev/null 2>&1 || true
}
