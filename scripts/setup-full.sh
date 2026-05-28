#!/usr/bin/env bash
#
# Full setup script for Deepiri Emotion Desktop.
# Installs dependencies, builds the app, and produces installers for the current OS.
# Run from the repository root: ./scripts/setup-full.sh
#
# Options:
#   --install-only    Only run npm install (no build).
#   --no-env          Do not create .env from .env.example.
#   --skip-check      Do not run npm run check before build (faster, less safe).
#
set -eo pipefail
SETUP_LOG="${TMPDIR:-/tmp}/deepiri-setup-$$.log"

# Colors (disable if NO_COLOR or not a TTY)
if [ -n "$NO_COLOR" ] || [ ! -t 1 ]; then
  R=""; G=""; Y=""; B=""; M=""; CY=""; W=""; D=""; BOLD=""; RESET=""
else
  R="\033[31m"; G="\033[32m"; Y="\033[33m"; B="\033[34m"; M="\033[35m"
  CY="\033[36m"; W="\033[37m"; D="\033[2m"; BOLD="\033[1m"; RESET="\033[0m"
fi

trap 'ec=$?; echo -e "\n${R}${BOLD}  ✗ Setup failed${RESET} at line ${LINENO} (exit ${ec})." >&2; echo -e "  ${D}Failed command: ${BASH_COMMAND}${RESET}" >&2; echo -e "  ${D}Full output log: ${SETUP_LOG}${RESET}" >&2' ERR

print_banner() {
  echo ""
  echo -e "${CY}  ╔═══════════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${CY}  ║${RESET}                                                               ${CY}║${RESET}"
  echo -e "${CY}  ║${RESET}   ${BOLD}${M}  •••  D E E P I R I  •••${RESET}                                ${CY}║${RESET}"
  echo -e "${CY}  ║${RESET}                                                               ${CY}║${RESET}"
  echo -e "${CY}  ║${RESET}        ${BOLD}${W}   I D E   S E T U P${RESET}                             ${CY}║${RESET}"
  echo -e "${CY}  ║${RESET}                                                               ${CY}║${RESET}"
  echo -e "${CY}  ╚═══════════════════════════════════════════════════════════════╝${RESET}"
  echo ""
}

section() { echo -e "\n${B}▌${RESET} ${BOLD}$1${RESET}\n${D}────────────────────────────────────────────────────────────────${RESET}"; }
ok()    { echo -e "${G}  ✓${RESET} $1"; }
warn()  { echo -e "${Y}  ⚠${RESET} $1"; }
err()   { echo -e "${R}  ✗${RESET} $1" >&2; }
info()  { echo -e "  ${CY}→${RESET} $1"; }

REPO_ROOT=""
INSTALL_ONLY=false
CREATE_ENV=true
SKIP_CHECK=false

# Parse options
for arg in "$@"; do
  case "$arg" in
    --install-only) INSTALL_ONLY=true ;;
    --no-env)       CREATE_ENV=false ;;
    --skip-check)   SKIP_CHECK=true ;;
    -h|--help)
      echo -e "${BOLD}Usage:${RESET} $0 [--install-only] [--no-env] [--skip-check]"
      echo "  --install-only  Only npm install, do not build."
      echo "  --no-env        Do not create .env from .env.example."
      echo "  --skip-check    Skip lint + test before build."
      exit 0
      ;;
  esac
done

# Find repo root (directory containing package.json with deepiri-emotion-desktop)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR="${SCRIPT_DIR}/.."
if [ -f "${DIR}/package.json" ] && grep -q '"name".*"deepiri-emotion-desktop"' "${DIR}/package.json" 2>/dev/null; then
  REPO_ROOT="${DIR}"
else
  # Try current working directory
  if [ -f "package.json" ] && grep -q '"name".*"deepiri-emotion-desktop"' "package.json" 2>/dev/null; then
    REPO_ROOT="$(pwd)"
  else
    err "Run this script from the repository root or from scripts/."
    echo -e "  ${D}cd /path/to/deepiri-emotion-desktop && ./scripts/setup-full.sh${RESET}" >&2
    exit 1
  fi
fi

cd "$REPO_ROOT"
REPO_ROOT="$(pwd)"
print_banner

section "Repository"
info "Root: $REPO_ROOT"

section "Node.js"
REQUIRED_MAJOR=18
if ! command -v node >/dev/null 2>&1; then
  err "Node.js is not installed or not in PATH."
  echo -e "  ${D}Install Node.js ${REQUIRED_MAJOR}+ from https://nodejs.org/ or use nvm.${RESET}" >&2
  exit 1
fi

NODE_VER="$(node -v)"
NODE_MAJOR="${NODE_VER#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt "$REQUIRED_MAJOR" ] 2>/dev/null; then
  err "Node.js ${REQUIRED_MAJOR}+ required. Current: $NODE_VER"
  if command -v nvm >/dev/null 2>&1; then
    echo -e "  ${D}Try: nvm install (or nvm use)${RESET}" >&2
  fi
  exit 1
fi
ok "Node $(node -v)  npm $(npm -v)"

if [ -f ".nvmrc" ] && command -v nvm >/dev/null 2>&1; then
  info "Using .nvmrc with nvm..."
  nvm use || true
fi

section "Dependencies"
info "Running npm install... (log: ${SETUP_LOG})"
npm install 2>&1 | tee -a "$SETUP_LOG"
ok "Dependencies installed"

if [ "$INSTALL_ONLY" = true ]; then
  echo ""
  echo -e "${G}${BOLD}  Done (--install-only)${RESET}"
  info "Next: npm run build"
  echo -e "  ${D}Or run in dev: Terminal 1: npm run dev:renderer  Terminal 2: npm run dev${RESET}"
  exit 0
fi

if [ "$CREATE_ENV" = true ] && [ ! -f ".env" ] && [ -f ".env.example" ]; then
  section "Configuration"
  info "Creating .env from .env.example..."
  cp .env.example .env
  ok ".env created (edit API_URL, AI_SERVICE_URL, etc. if needed)"
fi

section "Check (lint + tests)"
if [ "$SKIP_CHECK" != true ]; then
  info "Running npm run check..."
  if npm run check; then
    ok "Lint and tests passed"
  else
    err "Check failed. Run with --skip-check to build anyway (not recommended)."
    exit 1
  fi
else
  warn "Skipping check (--skip-check)"
fi

section "Build"
info "Building application (icons + renderer + installer for this OS)..."
npm run build
ok "Build complete"

DIST="${REPO_ROOT}/dist"
echo ""
echo -e "${CY}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${CY}║${RESET}  ${G}${BOLD}✓ Build complete${RESET}                                          ${CY}║${RESET}"
echo -e "${CY}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""
info "Installers: ${BOLD}$DIST${RESET}"
echo ""

section "Install / run the desktop app"
case "$(uname -s)" in
  Linux)
    if [ -d "${DIST}/linux-unpacked" ]; then
      info "Run without installing:"
      echo -e "    ${W}${DIST}/linux-unpacked/deepiri-emotion-desktop${RESET}"
    fi
    for f in "${DIST}"/*.deb; do
      [ -e "$f" ] && echo -e "  ${G}.deb${RESET}     $f" && echo -e "    ${D}sudo dpkg -i \"$f\"   (then sudo apt -f install if needed)${RESET}"
    done
    for f in "${DIST}"/*.AppImage; do
      [ -e "$f" ] && echo -e "  ${G}AppImage${RESET} $f" && echo -e "    ${D}chmod +x \"$f\" && ./\"$f\"${RESET}"
    done
    ;;
  Darwin)
    if [ -d "${DIST}/mac" ]; then
      info "Run without installing:"
      echo -e "    ${W}open \"${DIST}/mac/Deepiri Emotion.app\"${RESET}"
    fi
    for f in "${DIST}"/*.dmg; do [ -e "$f" ] && echo -e "  ${G}.dmg${RESET} $f" && echo -e "    ${D}Open and drag the app to Applications.${RESET}"; done
    for f in "${DIST}"/*.pkg; do [ -e "$f" ] && echo -e "  ${G}.pkg${RESET} $f" && echo -e "    ${D}Double-click to run the installer.${RESET}"; done
    ;;
  MINGW*|MSYS*|CYGWIN*)
    if [ -d "${DIST}/win-unpacked" ]; then
      info "Run without installing:"
      echo -e "    ${W}${DIST}\\win-unpacked\\\"Deepiri Emotion.exe\"${RESET}"
    fi
    for f in "${DIST}"/*.exe; do
      [ -e "$f" ] && echo -e "  ${G}Installer${RESET} $f" && echo -e "    ${D}Double-click to install, then launch from Start or Desktop.${RESET}"
    done
    ;;
  *)
    info "Output: $DIST"
    ls -la "$DIST" 2>/dev/null || true
    ;;
esac

echo ""
echo -e "${D}To run in development next time:${RESET}"
echo -e "  ${CY}Terminal 1:${RESET} npm run dev:renderer"
echo -e "  ${CY}Terminal 2:${RESET} npm run dev"
echo ""
