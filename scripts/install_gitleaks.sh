#!/usr/bin/env bash
# Install the gitleaks binary (Linux x86_64) into ~/.local/bin.
# The engine picks it up automatically when it is on PATH.
set -euo pipefail

VERSION="${GITLEAKS_VERSION:-v8.30.1}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) TARGET="linux_x64" ;;
  aarch64) TARGET="linux_arm64" ;;
  *) echo "unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

DEST="${GITLEAKS_DEST:-$HOME/.local/bin}"
URL="https://github.com/gitleaks/gitleaks/releases/download/${VERSION}/gitleaks_${VERSION#v}_${TARGET}.tar.gz"

echo "[codesentinel] installing gitleaks $VERSION ($TARGET) to $DEST"
mkdir -p "$DEST"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$URL" -o "$TMP/gitleaks.tar.gz"
tar -xzf "$TMP/gitleaks.tar.gz" -C "$TMP"
install -m 0755 "$TMP/gitleaks" "$DEST/gitleaks"
"$DEST/gitleaks" version