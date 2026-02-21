#!/usr/bin/env bash
set -e

echo "=== ПНД.doc setup ==="

echo ""
echo "[1/3] Installing app dependencies..."
npm install

echo ""
echo "[2/3] Installing worker dependencies..."
(cd worker && npm install)

echo ""
echo "[3/3] Creating .env.local..."
if [ -f .env.local ]; then
  echo "  .env.local already exists, skipping."
else
  echo "VITE_WORKER_URL=http://localhost:8787" > .env.local
  echo "  Created .env.local with VITE_WORKER_URL=http://localhost:8787"
fi

echo ""
echo "=== Done! Run ./dev.sh to start. ==="
