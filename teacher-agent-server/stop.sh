#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PID_FILE:-$SCRIPT_DIR/.teacher-agent-server.pid}"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Teacher Agent server is not running (PID file not found)."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Teacher Agent server is not running (stale PID $PID)."
  rm -f "$PID_FILE"
  exit 0
fi

kill "$PID"
for _ in {1..20}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Teacher Agent server stopped."
    exit 0
  fi
  sleep 1
done

echo "Graceful shutdown timed out; sending SIGKILL to PID $PID."
kill -9 "$PID"
rm -f "$PID_FILE"
echo "Teacher Agent server stopped."
