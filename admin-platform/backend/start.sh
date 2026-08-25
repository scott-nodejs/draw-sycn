#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$APP_DIR/.env"
JAR_FILE="$APP_DIR/ruoyi-admin/target/ruoyi-admin.jar"
PID_FILE="$APP_DIR/admin-platform.pid"
LOG_FILE="$APP_DIR/admin-platform.log"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ ! -f "$JAR_FILE" ]]; then
  echo "Missing $JAR_FILE; run: mvn -pl ruoyi-admin -am package -DskipTests"
  exit 1
fi

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Admin backend is already running (PID $(cat "$PID_FILE"))."
  exit 0
fi

nohup java -Xms256m -Xmx768m -Dfile.encoding=UTF-8 \
  -jar "$JAR_FILE" >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
echo "Admin backend started (PID $(cat "$PID_FILE"))."
