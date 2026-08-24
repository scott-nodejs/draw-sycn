#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

JAVA_BIN="${JAVA_BIN:-java}"
APP_JAR="${APP_JAR:-$SCRIPT_DIR/target/teacher-agent-server-0.1.0.jar}"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.local}"
PID_FILE="${PID_FILE:-$SCRIPT_DIR/.teacher-agent-server.pid}"
LOG_DIR="${LOG_DIR:-$SCRIPT_DIR/logs}"
LOG_FILE="${LOG_FILE:-$LOG_DIR/teacher-agent-server.log}"
JAVA_OPTS="${JAVA_OPTS:--Xms256m -Xmx768m -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Shanghai}"

if [[ ! -f "$APP_JAR" ]]; then
  echo "JAR not found: $APP_JAR"
  echo "Run: mvn clean package -DskipTests"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Configuration missing: $ENV_FILE"
  echo "Run: cp .env.example .env.local, then fill in DEEPSEEK_API_KEY."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DEEPSEEK_API_KEY:-}" || "$DEEPSEEK_API_KEY" == "replace-me" ]]; then
  echo "DEEPSEEK_API_KEY is not configured in $ENV_FILE"
  exit 1
fi

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Teacher Agent server is already running (PID $OLD_PID)."
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
  echo "Teacher Agent server started (PID $PID, port ${TEACHER_AGENT_PORT:-8791})."
  echo "Log: $LOG_FILE"
else
  echo "Teacher Agent server failed to start. Check: $LOG_FILE"
  rm -f "$PID_FILE"
  exit 1
fi
