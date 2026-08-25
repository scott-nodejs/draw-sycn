#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
"$APP_DIR/stop.sh"
"$APP_DIR/start.sh"
