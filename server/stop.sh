#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PID_FILE:-$SCRIPT_DIR/.whiteboard-server.pid}"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Whiteboard server is not running (PID file not found)."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Stale PID file removed (PID $PID is not running)."
  rm -f "$PID_FILE"
  exit 0
fi

echo "Stopping Whiteboard server (PID $PID)..."
kill -TERM "$PID"

for _ in $(seq 1 30); do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Whiteboard server stopped."
    exit 0
  fi
  sleep 1
done

echo "Graceful shutdown timed out; forcing PID $PID to stop."
kill -KILL "$PID"
rm -f "$PID_FILE"
echo "Whiteboard server stopped forcibly."

