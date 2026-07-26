#!/usr/bin/env bash
#
# Remove the `emotion` command installed by scripts/install-cli.sh.
#
set -euo pipefail

TARGET="${HOME}/.local/bin/emotion"

if [ -e "${TARGET}" ] || [ -L "${TARGET}" ]; then
  rm -f "${TARGET}"
  echo "Removed: ${TARGET}"
else
  echo "Nothing to remove at ${TARGET}"
fi

if command -v npm >/dev/null 2>&1; then
  NPM_PREFIX="$(npm prefix -g 2>/dev/null || true)"
  if [ -n "${NPM_PREFIX}" ] && [ -e "${NPM_PREFIX}/bin/emotion" ]; then
    rm -f "${NPM_PREFIX}/bin/emotion" 2>/dev/null || true
    echo "Also removed: ${NPM_PREFIX}/bin/emotion"
  fi
fi
