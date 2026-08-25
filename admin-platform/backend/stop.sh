#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/admin-platform.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Admin backend is not running."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  for _ in {1..30}; do
    kill -0 "$PID" 2>/dev/null || break
    sleep 1
  done
fi

rm -f "$PID_FILE"
echo "Admin backend stopped."
