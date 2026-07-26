#!/usr/bin/env bash
#
# Install the `emotion` command onto PATH (symlink into ~/.local/bin).
# Run from the repository root: npm run install:cli
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLI_ENTRY="${REPO_ROOT}/cli/index.js"
BIN_DIR="${HOME}/.local/bin"
TARGET="${BIN_DIR}/emotion"

if [ ! -f "${CLI_ENTRY}" ]; then
  echo "error: CLI entry not found at ${CLI_ENTRY}" >&2
  exit 1
fi

chmod +x "${CLI_ENTRY}"
mkdir -p "${BIN_DIR}"

if [ -e "${TARGET}" ] || [ -L "${TARGET}" ]; then
  rm -f "${TARGET}"
fi

ln -s "${CLI_ENTRY}" "${TARGET}"

# Drop a stale npm-global link if present (e.g. Cursor agent npm prefix).
if command -v npm >/dev/null 2>&1; then
  NPM_PREFIX="$(npm prefix -g 2>/dev/null || true)"
  if [ -n "${NPM_PREFIX}" ] && [ -e "${NPM_PREFIX}/bin/emotion" ]; then
    rm -f "${NPM_PREFIX}/bin/emotion" 2>/dev/null || true
  fi
fi

echo "Installed: ${TARGET} -> ${CLI_ENTRY}"

case ":${PATH}:" in
  *":${BIN_DIR}:"*) ;;
  *)
    echo ""
    echo "Note: ${BIN_DIR} is not on your PATH."
    echo "Add this to your shell rc (~/.bashrc or ~/.zshrc), then open a new terminal:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac

echo "Try: emotion --help"
