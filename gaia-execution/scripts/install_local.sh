#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${GAIA_EXEC_HOME:-$HOME/.local/share/gaia-execution}"
BIN_DIR="${HOME}/.local/bin"

mkdir -p "$TARGET" "$BIN_DIR"
rsync -a --delete --exclude output --exclude __pycache__ "$ROOT/" "$TARGET/"
cat > "$BIN_DIR/gaia-exec" <<WRAPPER
#!/usr/bin/env bash
PYTHONPATH="$TARGET" exec python3 -m gaia_exec "\$@"
WRAPPER
chmod 700 "$BIN_DIR/gaia-exec"

echo "Installed in $TARGET"
echo "Command: $BIN_DIR/gaia-exec"
echo "Add $BIN_DIR to PATH if it is not already present."
