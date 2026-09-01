#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

JAVA_BIN="${JAVA_BIN:-java}"
APP_JAR="${APP_JAR:-$SCRIPT_DIR/target/whiteboard-server-0.1.0.jar}"
PID_FILE="${PID_FILE:-$SCRIPT_DIR/.whiteboard-server.pid}"
LOG_DIR="${LOG_DIR:-$SCRIPT_DIR/logs}"
LOG_FILE="${LOG_FILE:-$LOG_DIR/whiteboard-server.log}"
JAVA_OPTS="${JAVA_OPTS:--Xms256m -Xmx1024m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=$LOG_DIR -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Shanghai}"

if [[ ! -f "$APP_JAR" ]]; then
  echo "JAR not found: $APP_JAR"
  echo "Run: mvn clean package -DskipTests"
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/.env.local" ]]; then
  echo "Configuration missing: $SCRIPT_DIR/.env.local"
  echo "Run: cp .env.production.example .env.local, then fill in the secrets."
  exit 1
fi

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Whiteboard server is already running (PID $OLD_PID)."
    exit 0
  fi
  rm -f "$PID_FILE"
fi

mkdir -p "$LOG_DIR"
nohup "$JAVA_BIN" $JAVA_OPTS -jar "$APP_JAR" >>"$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"

sleep 2
if kill -0 "$PID" 2>/dev/null; then
  echo "Whiteboard server started (PID $PID, port ${SERVER_PORT:-8788})."
  echo "Log: $LOG_FILE"
else
  echo "Whiteboard server failed to start. Check: $LOG_FILE"
  rm -f "$PID_FILE"
  exit 1
fi

