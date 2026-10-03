#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../backend"
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql+psycopg://neighbourly_test:local-test-only@127.0.0.1:55439/neighbourly_test}"
if [[ "$TEST_DATABASE_URL" != */neighbourly_test ]]; then
  echo "Refusing to run against a database not named neighbourly_test." >&2
  exit 1
fi
export DATABASE_URL="$TEST_DATABASE_URL"
export APP_ENV=development PAYMENT_PROVIDER=development JWT_SECRET=test-only-neighbourly-operations-secret
.venv/bin/alembic upgrade head
.venv/bin/python -m unittest discover -s tests -v
if [[ "${CHECK_MIGRATIONS:-0}" == "1" ]]; then
  .venv/bin/python tests/check_migrations.py
fi
