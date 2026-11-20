#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

NODE_BIN="${NODE_BIN:-}"
if [ -z "$NODE_BIN" ] && [ -x "./runtime/node" ]; then NODE_BIN="./runtime/node"; fi
if [ -z "$NODE_BIN" ]; then NODE_BIN="$(command -v node || true)"; fi
if [ -z "$NODE_BIN" ]; then echo "Node.js 22+ is required."; exit 1; fi

if [ ! -f "projects/auto-car/server.js" ]; then
  echo "[*] Preparing demo copies..."
  "$NODE_BIN" setup-demo.mjs
fi

export DEMO_DIRECT_PORTS="${DEMO_DIRECT_PORTS:-1}"
echo "Demo portal → http://localhost:${DEMO_PORT:-8000}/"
exec "$NODE_BIN" demo-server.mjs
