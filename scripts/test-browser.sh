#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL="postgresql+psycopg://neighbourly_test:local-test-only@127.0.0.1:55439/neighbourly_test"
export APP_ENV=development PAYMENT_PROVIDER=development JWT_SECRET=test-only-neighbourly-operations-secret
export STORAGE_BACKEND=local STORAGE_PATH=/tmp/neighbourly-browser-uploads CORS_ORIGINS='["http://127.0.0.1:8020"]'
export EXPO_PUBLIC_API_URL=http://127.0.0.1:8019
(
  cd backend
  .venv/bin/alembic upgrade head
  exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8019
) >/tmp/neighbourly-browser-api.log 2>&1 &
society_api_pid=$!
node mobile/tests/serve.cjs >/tmp/neighbourly-browser-web.log 2>&1 &
society_web_pid=$!
trap 'kill "$society_api_pid" "$society_web_pid" 2>/dev/null || true' EXIT
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:8019/health >/dev/null; then break; fi
  sleep 1
done
cd mobile
npx expo export --platform web --output-dir /tmp/neighbourly-web >/tmp/neighbourly-browser-build.log 2>&1
npx playwright test
