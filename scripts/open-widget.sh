#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"
URL="http://127.0.0.1:${PORT}/widget.html?v=$(date +%Y%m%d%H%M%S)"
PROFILE_DIR="${CODEX_LIMIT_WIDGET_PROFILE:-/tmp/codex-limit-tracker-widget-profile}"
LOG_FILE="${CODEX_LIMIT_WIDGET_LOG:-/tmp/codex-limit-tracker-widget.log}"

cd "$ROOT"

if ! curl -fsS "http://127.0.0.1:${PORT}/widget.html" >/dev/null 2>&1; then
  PORT="$PORT" npm start >"$LOG_FILE" 2>&1 &
  server_pid="$!"
  for _ in $(seq 1 50); do
    if curl -fsS "http://127.0.0.1:${PORT}/widget.html" >/dev/null 2>&1; then
      break
    fi
    if ! kill -0 "$server_pid" 2>/dev/null; then
      echo "Tracker server exited early. Log: $LOG_FILE" >&2
      exit 1
    fi
    sleep 0.1
  done
fi

if ! curl -fsS "http://127.0.0.1:${PORT}/widget.html" >/dev/null 2>&1; then
  echo "Tracker server did not become ready on port ${PORT}. Log: $LOG_FILE" >&2
  exit 1
fi

mkdir -p "$PROFILE_DIR"

exec google-chrome \
  --user-data-dir="$PROFILE_DIR" \
  --app="$URL" \
  --class=CodexLimitTrackerWidget \
  --disable-application-cache \
  --disk-cache-size=1
