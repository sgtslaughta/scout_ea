"""CLI: python -m ea.init_db <db_path>  — create/upgrade a seeded EA_DB."""
from __future__ import annotations
import sqlite3
import sys
from . import db


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print("usage: python -m ea.init_db <db_path>", file=sys.stderr)
        return 2
    try:
        db.init_db(argv[0], seed_path=db.DEFAULT_SEED)
    except (OSError, sqlite3.Error) as e:
        print(f"error initializing {argv[0]}: {e}", file=sys.stderr)
        return 1
    print(f"initialized {argv[0]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
