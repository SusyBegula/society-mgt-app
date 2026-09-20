#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=========================================================="
echo "    🚀 Starting Neighbourly Live Demo Environment"
echo "=========================================================="

# Cleanup handler on exit (Ctrl+C)
cleanup() {
  echo ""
  echo "Shutting down backend and tunnel..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start FastAPI Backend
echo "1. Starting FastAPI Backend on port 8000..."
cd "$ROOT_DIR/backend"
"$ROOT_DIR/backend/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 2. Start Cloudflare Tunnel
echo "2. Starting Cloudflare Tunnel (api.susybegula.co.in)..."
cloudflared tunnel run neighbourly &
TUNNEL_PID=$!

# 3. Wait for healthcheck
echo "3. Waiting for https://api.susybegula.co.in/health to be ready..."
READY=false
for i in {1..30}; do
  if curl -sS https://api.susybegula.co.in/health 2>/dev/null | grep -q '"status":"ok"'; then
    READY=true
    break
  fi
  sleep 1
done

if [ "$READY" = true ]; then
  echo ""
  echo "=========================================================="
  echo "  ✅ NEIGHBOURLY DEMO IS LIVE OVER THE INTERNET!"
  echo "  🌐 API URL:     https://api.susybegula.co.in"
  echo "  📱 Demo Phone:   9876543210"
  echo "  🔑 Demo OTP:     123456"
  echo "  🏢 Societies:    Green Heights, Sunrise Residency"
  echo "  💾 Database:     Supabase Cloud (Sydney)"
  echo "=========================================================="
  echo "Logs streaming below (Press Ctrl+C to stop):"
  echo ""
else
  echo "⚠️ Warning: Health check did not return 200 within 30s. Check logs above."
fi

# Keep script running to stream logs
wait
