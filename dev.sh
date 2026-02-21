#!/usr/bin/env bash
set -e

# Check setup has been run
if [ ! -f .env.local ]; then
  echo "Missing .env.local — run ./setup.sh first."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Missing node_modules — run ./setup.sh first."
  exit 1
fi

# Kill background worker on exit
cleanup() {
  echo ""
  echo "Stopping worker..."
  kill "$WORKER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting worker on http://localhost:8787..."
(cd worker && npx wrangler dev --port 8787 2>&1 | sed 's/^/[worker] /') &
WORKER_PID=$!

# Give wrangler a moment to start
sleep 2

echo "Starting app on http://localhost:5173..."
echo ""
npm run dev
