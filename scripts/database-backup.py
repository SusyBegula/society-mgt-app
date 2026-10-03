"""Back up a PostgreSQL Docker container, or verify a dump in a NEW database.

Credentials stay inside the container. Restore never drops or overwrites a database.
Use object-storage backups/versioning as well; a database dump excludes file bytes.
"""
import argparse
import os
from pathlib import Path
import re
import subprocess
from datetime import datetime, timezone


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("backup", "verify-restore"))
    parser.add_argument("--container", required=True, help="PostgreSQL container with POSTGRES_USER and POSTGRES_DB configured")
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--restore-database", help="New database name; must start with restore_check_")
    args = parser.parse_args()
    if args.action == "backup":
        # Exclusive creation refuses to overwrite an earlier backup.
        descriptor = os.open(args.file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(descriptor, "wb") as output:
                subprocess.run(["docker", "exec", args.container, "sh", "-c",
                    'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom'], stdout=output, check=True)
        except Exception:
            args.file.unlink(missing_ok=True)
            raise
        print(f"Backup created: {args.file}")
    else:
        database = args.restore_database or "restore_check_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        if not re.fullmatch(r"restore_check_[a-z0-9_]{1,40}", database):
            parser.error("Restore target must be a new restore_check_ database using lowercase letters, digits and underscores.")
        with args.file.open("rb") as source:
            subprocess.run(["docker", "exec", args.container, "sh", "-c",
                'exec psql --username="$POSTGRES_USER" --dbname=postgres -v ON_ERROR_STOP=1 -c "$1"',
                "restore-check", f'CREATE DATABASE "{database}"'], check=True)
            subprocess.run(["docker", "exec", "-i", args.container, "sh", "-c",
                'exec pg_restore --username="$POSTGRES_USER" --dbname="$1" --no-owner --no-privileges --exit-on-error',
                "restore-check", database], stdin=source, check=True)
        print(f"Restore verified in new database: {database}. Existing databases were not changed.")


if __name__ == "__main__":
    main()
