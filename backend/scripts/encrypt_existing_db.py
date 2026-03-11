"""
One-off script to encrypt an existing plain SQLite database with SQLCipher.
Key must come from env only: set EXPENSE_TRACKER_DATABASE_PASSPHRASE before running.

Usage:
  1. Back up: cp backend/data/expense_tracker.db backend/data/expense_tracker.db.bak
  2. cd backend && set EXPENSE_TRACKER_DATABASE_PASSPHRASE=your-secret-key && python -m scripts.encrypt_existing_db
  3. Replace the original file with the encrypted one (script prints the path)
  4. Set EXPENSE_TRACKER_DATABASE_PASSPHRASE in your env and restart the app
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Run from backend/ so app is importable
BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

def main() -> None:
    passphrase = os.environ.get("EXPENSE_TRACKER_DATABASE_PASSPHRASE")
    if not passphrase:
        print("Set EXPENSE_TRACKER_DATABASE_PASSPHRASE in the environment.", file=sys.stderr)
        sys.exit(1)

    try:
        import sqlcipher3
    except ImportError:
        print("Install sqlcipher3: pip install sqlcipher3", file=sys.stderr)
        sys.exit(1)

    data_dir = BACKEND / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    plain_path = data_dir / "expense_tracker.db"
    encrypted_path = data_dir / "expense_tracker_encrypted.db"

    if not plain_path.exists():
        print(f"Plain database not found: {plain_path}", file=sys.stderr)
        sys.exit(1)

    key_escaped = passphrase.replace("'", "''")
    path_escaped = str(encrypted_path).replace("'", "''")
    conn = sqlcipher3.connect(str(plain_path))
    try:
        conn.execute(f"ATTACH DATABASE '{path_escaped}' AS encrypted KEY '{key_escaped}'")
        conn.execute("SELECT sqlcipher_export('encrypted')")
        conn.commit()
        conn.execute("DETACH DATABASE encrypted")
    finally:
        conn.close()

    print(f"Encrypted database written to: {encrypted_path}")
    print("Next steps:")
    print(f"  1. Back up the original, then: mv {encrypted_path} {plain_path}")
    print("  2. Set EXPENSE_TRACKER_DATABASE_PASSPHRASE in your environment and restart the app.")


if __name__ == "__main__":
    main()
