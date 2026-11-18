#!/usr/bin/env bash
# Start RumiStack on Linux. The Node server always binds to 127.0.0.1.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${RUMISTACK_PORT:-47821}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install Node.js, then run this script again." >&2
  exit 1
fi
NODE_VERSION="$(node -p 'process.versions.node')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 20+ is required (found v${NODE_VERSION})." >&2
  exit 1
fi
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1024 || PORT > 65535 )); then
  echo "RUMISTACK_PORT must be a number between 1024 and 65535." >&2
  exit 1
fi

mkdir -p "$ROOT"/{sources,projects,logs,backups,state,config}
cd "$ROOT"
export RUMISTACK_PORT="$PORT"

echo "RumiStack Linux server"
echo "Dashboard: http://127.0.0.1:$PORT"
echo "Private remote access: from your laptop run:"
echo "  ssh -N -L $PORT:127.0.0.1:$PORT <your-user>@<server-address>"
echo "Then open http://127.0.0.1:$PORT in your laptop browser."
echo "Keep this process running. Press Ctrl+C to stop."
exec node server/index.js
