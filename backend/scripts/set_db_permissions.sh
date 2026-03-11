#!/usr/bin/env bash
# Restrict access to the database directory so only the app user can read/write.
# Run from repo root or backend/ after the app has created data/ at least once.
# Linux/macOS only.

set -e
DATA_DIR="${1:-./data}"
if [ ! -d "$DATA_DIR" ]; then
  echo "Usage: $0 [data_dir]" >&2
  echo "Data dir $DATA_DIR not found. Start the app once to create it." >&2
  exit 1
fi
chmod 700 "$DATA_DIR"
for f in "$DATA_DIR"/*.db "$DATA_DIR"/*.db-wal "$DATA_DIR"/*.db-shm 2>/dev/null; do
  [ -e "$f" ] && chmod 600 "$f"
done
echo "Permissions set: $DATA_DIR 700, *.db 600"
