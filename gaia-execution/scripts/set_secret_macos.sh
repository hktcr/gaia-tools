#!/usr/bin/env bash
set -euo pipefail

NAME="${1:-}"
if [[ ! "$NAME" =~ ^[A-Z][A-Z0-9_]{2,127}$ ]]; then
  echo "Usage: $0 SECRET_NAME" >&2
  exit 2
fi
read -r -s -p "Secret value for $NAME: " VALUE
printf '\n'
security add-generic-password -U -a gaia -s "gaia:$NAME" -w "$VALUE" >/dev/null
unset VALUE
echo "Stored $NAME in macOS Keychain."
