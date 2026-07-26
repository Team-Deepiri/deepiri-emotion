#!/usr/bin/env bash
#
# Install Deepiri Emotion CLI: deps (if needed) + `emotion` on PATH.
#
#   ./install.sh
#   curl -fsSL … | bash   # when run from a clone, prefer ./install.sh
#
set -euo pipefail

REQUIRED_NODE_MAJOR=18

if [ -n "${NO_COLOR:-}" ] || [ ! -t 1 ]; then
  G=""; Y=""; B=""; D=""; BOLD=""; RESET=""
else
  G="\033[32m"; Y="\033[33m"; B="\033[34m"; D="\033[2m"; BOLD="\033[1m"; RESET="\033[0m"
fi

ok()   { echo -e "${G}✓${RESET} $1"; }
warn() { echo -e "${Y}⚠${RESET} $1"; }
info() { echo -e "${B}→${RESET} $1"; }
err()  { echo -e "✗ $1" >&2; }

# Resolve repo root (script may live at repo root or under scripts/)
SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_PATH}")" && pwd)"
if [ -f "${SCRIPT_DIR}/package.json" ] && [ -f "${SCRIPT_DIR}/cli/index.js" ]; then
  REPO_ROOT="${SCRIPT_DIR}"
elif [ -f "${SCRIPT_DIR}/../package.json" ] && [ -f "${SCRIPT_DIR}/../cli/index.js" ]; then
  REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  err "Could not find the deepiri-emotion repo root."
  echo "  Run from a clone:  cd /path/to/deepiri-emotion && ./install.sh" >&2
  exit 1
fi

cd "${REPO_ROOT}"

echo ""
echo -e "${BOLD}Deepiri Emotion CLI install${RESET}"
echo -e "${D}${REPO_ROOT}${RESET}"
echo ""

# --- Node.js ---
if ! command -v node >/dev/null 2>&1; then
  err "Node.js ${REQUIRED_NODE_MAJOR}+ is required but not installed."
  echo "  Install from https://nodejs.org/ or use nvm, then re-run ./install.sh" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  err "npm is required but not installed."
  exit 1
fi

NODE_VER="$(node -v)"
NODE_MAJOR="${NODE_VER#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
if [ -z "${NODE_MAJOR}" ] || [ "${NODE_MAJOR}" -lt "${REQUIRED_NODE_MAJOR}" ] 2>/dev/null; then
  err "Node.js ${REQUIRED_NODE_MAJOR}+ required (found ${NODE_VER})."
  exit 1
fi
ok "Node ${NODE_VER} · npm $(npm -v)"

# --- Dependencies (skip if already present) ---
need_install=false
if [ ! -d node_modules ]; then
  need_install=true
elif [ ! -f node_modules/.package-lock.json ] && [ ! -d node_modules/ink ]; then
  # Incomplete install (e.g. interrupted npm install)
  need_install=true
elif [ -f package-lock.json ] && [ package-lock.json -nt node_modules ]; then
  # Lockfile newer than node_modules — deps likely stale
  need_install=true
fi

if [ "${need_install}" = true ]; then
  info "Installing npm dependencies…"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  ok "Dependencies installed"
else
  ok "Dependencies already installed (skipping npm install)"
fi

# --- emotion on PATH ---
info "Installing emotion command…"
bash "${REPO_ROOT}/scripts/install-cli.sh"

# Confirm
if command -v emotion >/dev/null 2>&1; then
  ok "Ready — run: emotion"
  echo ""
  emotion --version 2>/dev/null || true
else
  warn "emotion is installed to ~/.local/bin but not on PATH yet."
  echo "  Add to ~/.bashrc or ~/.zshrc:"
  echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo "  Then open a new terminal and run: emotion"
fi

echo ""
