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

TOPMOST="${ATHENA_WIDGET_TOPMOST:-true}"
WIN_CLASS="AthenaUsageTrackerWidget"

google-chrome \
  --user-data-dir="$PROFILE_DIR" \
  --app="$URL" \
  --class="$WIN_CLASS" \
  --disable-application-cache \
  --disk-cache-size=1 &
chrome_pid="$!"

case "$TOPMOST" in
  true|1|yes|on)
    if command -v wmctrl >/dev/null 2>&1; then
      # Chrome's --class sets WM_CLASS res_class; res_name is the lowercased
      # form. Poll briefly because wmctrl can't see the window until the X
      # server has mapped it.
      pinned=0
      for _ in $(seq 1 50); do
        if wmctrl -lx 2>/dev/null | awk '{print $3}' | grep -qi "\\.${WIN_CLASS}\$"; then
          wmctrl -x -r "$WIN_CLASS" -b add,above >/dev/null 2>&1 && pinned=1
          break
        fi
        sleep 0.1
      done
      if [ "$pinned" -eq 0 ]; then
        echo "Widget window did not appear within 5s; always-on-top was not applied." >&2
      fi
    else
      echo "wmctrl not found; install it (e.g. apt install wmctrl) for always-on-top behavior." >&2
    fi
    ;;
esac

wait "$chrome_pid"
