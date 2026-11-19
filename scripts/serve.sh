#!/usr/bin/env bash
# serve.sh — keep `hugo server` alive on a fixed port, restarting on failure.
#
# Usage:
#   ./scripts/serve.sh              # foreground, Ctrl-C to stop
#   ./scripts/serve.sh --daemon     # background (PID in .hugo_cache/serve.pid, log in .hugo_cache/serve.log)
#   ./scripts/serve.sh --stop       # stop a --daemon instance
#   ./scripts/serve.sh --status     # check if serving
#   ./scripts/serve.sh --help
#
# Env overrides:
#   PORT=1313  BIND=127.0.0.1  HEALTH_INTERVAL=5  HEALTH_RETRIES=3
#   Extra hugo flags after -- :  ./scripts/serve.sh -- --disableFastRender --gc
#
# Behaviour:
#   - Fixed port (default 1313), auto-increments to next free port if busy.
#   - Restarts on crash (non-zero exit) with exponential backoff (1s→10s).
#   - Detects hung server via HTTP health probe; kills & restarts after N
#     consecutive failures.
#   - Detects stale .hugo_build.lock and removes it.
#   - Auto-enables hugo.work workspace when hugo.work exists.
#   - Health check URL derived from hugo.yaml baseURL path, so the
#     /CAI-Field-Manual-MaaS/ prefix is probed correctly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-1313}"
BIND="${BIND:-127.0.0.1}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
HEALTH_RETRIES="${HEALTH_RETRIES:-3}"
PIDFILE="${PIDFILE:-$ROOT/.hugo_cache/serve.pid}"
PORTFILE="${PORTFILE:-$ROOT/.hugo_cache/serve.port}"
LOGFILE="${LOGFILE:-$ROOT/.hugo_cache/serve.log}"
HUGO_BIN="${HUGO_BIN:-hugo}"
# Export so the daemon re-exec (nohup bash "$0" ...) inherits caller's
export PORT BIND HEALTH_INTERVAL HEALTH_RETRIES PIDFILE PORTFILE LOGFILE HUGO_BIN

# ── helpers ──────────────────────────────────────────────────────────
info()  { printf '\033[0;32m[serve]\033[0m %s\n' "$*"; }
warn()  { printf '\033[0;33m[serve]\033[0m %s\n' "$*" >&2; }
die()   { printf '\033[0;31m[serve]\033[0m %s\n' "$*" >&2; exit "${2:-1}"; }

health_path() {
  local base
  base="$(grep -E '^baseURL:' hugo.yaml 2>/dev/null | sed -E "s/.*baseURL:[[:space:]]*['\"]?([^'\"]+)['\"]?.*/\1/" || true)"
  local path
  path="$(printf '%s' "$base" | sed -E 's|https?://[^/]+||' || true)"
  if [ -z "$path" ] || [ "$path" = "/" ]; then
    printf '/'
  else
    case "$path" in /*) printf '%s' "$path" ;; *) printf '/%s' "$path" ;; esac
  fi
}

have_cmd() { command -v "$1" >/dev/null 2>&1; }

is_port_in_use() {
  local port="$1"
  if have_cmd lsof; then
    lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
  else
    (exec 3<>/dev/tcp/"$BIND"/"$port") 2>/dev/null && exec 3>&- && exec 3<&-
  fi
}

# Effective port: if supervisor is running (pidfile alive), use persisted
# port from PORTFILE so --status/--stop probe the actual port, not the
# default 1313. Falls back to $PORT otherwise.
effective_port() {
  if [ -f "$PIDFILE" ] && [ -f "$PORTFILE" ]; then
    local pid pf_port
    pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    pf_port="$(cat "$PORTFILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && [ -n "$pf_port" ]; then
      printf '%s' "$pf_port"
      return 0
    fi
  fi
  printf '%s' "$PORT"
}

is_alive_url() {
  local url="http://${BIND}:${PORT}${HEALTH_PATH}"
  if have_cmd curl; then
    curl -sf --max-time 2 --connect-timeout 2 "$url" >/dev/null 2>&1
  elif have_cmd wget; then
    wget -q --timeout=2 --tries=1 -O /dev/null "$url" 2>/dev/null
  else
    (exec 3<>/dev/tcp/"$BIND"/"$PORT") 2>/dev/null && exec 3>&- && exec 3<&-
  fi
}

kill_tree() {
  local pid="$1"
  if have_cmd pkill; then pkill -P "$pid" 2>/dev/null || true; fi
  kill "$pid" 2>/dev/null || true
  sleep 0.3
  kill -9 "$pid" 2>/dev/null || true
  if have_cmd pkill; then pkill -9 -P "$pid" 2>/dev/null || true; fi
}

# ── arg parsing ──────────────────────────────────────────────────────
DAEMON=false
DO_STOP=false
DO_STATUS=false
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --daemon|-d)  DAEMON=true; shift ;;
    --stop)       DO_STOP=true; shift ;;
    --status)     DO_STATUS=true; shift ;;
    --help|-h)
      sed -n '2,22p' "$0" | sed 's/^# \?//'
      echo ""
      echo "Current: PORT=$PORT BIND=$BIND PIDFILE=$PIDFILE LOGFILE=$LOGFILE"
      exit 0
      ;;
    --) shift; while [ $# -gt 0 ]; do EXTRA_ARGS+=("$1"); shift; done; break ;;
    --port) PORT="$2"; shift 2 ;;
    --bind) BIND="$2"; shift 2 ;;
    -*) die "unknown flag: $1 (try --help)" ;;
    *) EXTRA_ARGS+=("$1"); shift ;;
  esac
done

HEALTH_PATH="$(health_path)"

# ── --status / --stop ────────────────────────────────────────────────
if $DO_STATUS; then
  if [ -f "$PIDFILE" ]; then
    pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      STATUS_PORT="$(effective_port)"
      info "running  pid=$pid  http://${BIND}:${STATUS_PORT}${HEALTH_PATH}  log=$LOGFILE"
      # is_alive_url uses $PORT; temporarily override for health probe
      PORT="$STATUS_PORT" is_alive_url && info "health  OK (HTTP 200)" || warn "health  FAIL (not responding)"
      exit 0
    else
      warn "stale pidfile $PIDFILE (pid $pid not running)"
      exit 1
    fi
  else
    if have_cmd lsof && lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
      info "port $PORT is bound (no pidfile — possibly manual 'hugo server')"
      exit 0
    fi
    info "not running (no $PIDFILE)"
    exit 1
  fi
fi

if $DO_STOP; then
  if [ -f "$PIDFILE" ]; then
    pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      info "stopping pid $pid …"
      # Read PORTFILE before killing — supervisor's cleanup deletes it on exit.
      if [ -f "$PORTFILE" ]; then STOP_PORT="$(cat "$PORTFILE" 2>/dev/null || echo "$PORT")"; else STOP_PORT="$PORT"; fi
      if have_cmd pkill; then pkill -P "$pid" 2>/dev/null || true; fi
      kill "$pid" 2>/dev/null || true
      for _ in 1 2 3 4 5 6 7 8 9 10; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.3
      done
      if kill -0 "$pid" 2>/dev/null; then
        warn "supervisor $pid still alive — SIGKILL"
        kill -9 "$pid" 2>/dev/null || true
        if have_cmd pkill; then pkill -9 -P "$pid" 2>/dev/null || true; fi
      fi
      rm -f "$PIDFILE" "$PORTFILE"
      if have_cmd lsof && lsof -iTCP:"$STOP_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
        warn "port $STOP_PORT still bound after stop — inspect: lsof -iTCP:$STOP_PORT -sTCP:LISTEN"
      else
        info "stopped (port $STOP_PORT free)"
      fi
      exit 0
    else
      warn "no live process for pidfile $PIDFILE — removing stale file"
      rm -f "$PIDFILE" "$PORTFILE"
      exit 1
    fi
  else
    die "no pidfile $PIDFILE — nothing to stop"
  fi
fi

# ── preflight ────────────────────────────────────────────────────────
have_cmd "$HUGO_BIN" || die "hugo not found (HUGO_BIN=$HUGO_BIN). Install Hugo Extended >= 0.168."
if [ -f "$ROOT/hugo.work" ] && [ -z "${HUGO_MODULE_WORKSPACE:-}" ]; then
  export HUGO_MODULE_WORKSPACE="hugo.work"
  info "using workspace $HUGO_MODULE_WORKSPACE (hugo.work present; HUGO_MODULE_WORKSPACE=off to disable)"
fi

mkdir -p "$(dirname "$PIDFILE")" "$(dirname "$LOGFILE")"

# Already running? Refuse unconditionally — not just on busy port or --daemon.
# Otherwise a freed port lets a foreground start clobber the daemon's pidfile
# (line 275) and orphan the original daemon on its bumped port.
if [ -f "$PIDFILE" ]; then
  _run_pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "$_run_pid" ] && kill -0 "$_run_pid" 2>/dev/null; then
    _run_port="$(cat "$PORTFILE" 2>/dev/null || echo "$PORT")"
    die "already running pid=$_run_pid on port $_run_port — use --stop first (or --status)"
  else
    warn "removing stale pidfile"
    rm -f "$PIDFILE" "$PORTFILE"
  fi
fi

if is_port_in_use "$PORT"; then
  orig_port="$PORT"
  tried="$PORT"
  for _ in $(seq 1 20); do
    tried=$((tried + 1))
    if ! is_port_in_use "$tried"; then
      info "port $orig_port in use — trying $tried"
      PORT="$tried"
      export PORT
      break
    fi
  done
  if [ "$PORT" = "$orig_port" ]; then
    owner="$(have_cmd lsof && lsof -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | tail -n +2 | head -n 3 || true)"
    warn "port $PORT already in use — will try anyway (hugo may fail to bind):"
    [ -n "$owner" ] && warn "$owner"
  fi
fi
printf '%s' "$PORT" > "$PORTFILE"
# ── build hugo command ───────────────────────────────────────────────
# --renderToMemory keeps dev serving in RAM so `public/` (the production
# build that check-contracts.sh validates) is not overwritten with a dev
# build on localhost canonicals. Never add --cleanDestinationDir here.
HUGO_ARGS=(server --renderToMemory --port "$PORT" --bind "$BIND" --printPathWarnings)
if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
  HUGO_ARGS+=("${EXTRA_ARGS[@]}")
fi

# ── daemon detach ────────────────────────────────────────────────────
if $DAEMON; then
  info "starting daemon  http://${BIND}:${PORT}${HEALTH_PATH}  log=$LOGFILE"
  DAEMON_ARGS=(--port "$PORT" --bind "$BIND")
  if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
    DAEMON_ARGS+=(-- "${EXTRA_ARGS[@]}")
  fi
  # Exported vars above (PORT, HEALTH_*, PIDFILE/LOGFILE/HUGO_BIN) are
  # inherited; also mark the child so it avoids double-logging (nohup
  # already redirects stdout→LOGFILE, so tee/log_to_file must not append
  # a second time or every line appears twice).
  SERVE_DAEMONIZED=1 nohup bash "$ROOT/scripts/serve.sh" "${DAEMON_ARGS[@]}" >>"$LOGFILE" 2>&1 &
  disown 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -f "$PIDFILE" ] && break
    sleep 0.2
  done
  if [ -f "$PIDFILE" ]; then
    info "daemon pid $(cat "$PIDFILE")  log: tail -f $LOGFILE"
  else
    warn "daemon launched but no pidfile yet — check $LOGFILE"
  fi
  exit 0
fi

# ── supervisor loop (foreground) ─────────────────────────────────────
: >>"$LOGFILE"

echo $$ > "$PIDFILE"
info "supervisor pid=$$  hugo: ${HUGO_BIN} ${HUGO_ARGS[*]}"
info "health: http://${BIND}:${PORT}${HEALTH_PATH}  every ${HEALTH_INTERVAL}s  retries=${HEALTH_RETRIES}"
info "log:    $LOGFILE  (tail -f $LOGFILE)"
info "stop:   ./scripts/serve.sh --stop   or  Ctrl-C"

# Only INT/TERM should tear down — EXIT would fire on every `wait` failure
# and kill the supervisor when we actually want to restart.
cleanup() {
  info "shutting down …"
  rm -f "$PIDFILE" "$PORTFILE"
  if [ -n "${HUGO_PID:-}" ] && kill -0 "$HUGO_PID" 2>/dev/null; then
    kill_tree "$HUGO_PID"
  fi
  exit 0
}
trap cleanup INT TERM

BACKOFF=1
MAX_BACKOFF=10
FAIL_STREAK=0
RESTARTS=0
LAST_OK="$(date +%s)"

log_to_file() {
  # Daemonized child's stdout already goes to LOGFILE via nohup; writing
  # to both LOGFILE and stderr would duplicate every line.
  if [ "${SERVE_DAEMONIZED:-}" = "1" ]; then
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2 || true
  else
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOGFILE" 2>/dev/null || true
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2 || true
  fi
}

launch_hugo() {
  if [ "${SERVE_DAEMONIZED:-}" = "1" ]; then
    "${HUGO_BIN}" "${HUGO_ARGS[@]}" 2>&1 &
  else
    "${HUGO_BIN}" "${HUGO_ARGS[@]}" > >(tee -a "$LOGFILE") 2>&1 &
  fi
}

while true; do
  # stale .hugo_build.lock from a prior crash can block restart
  if [ -f "$ROOT/.hugo_build.lock" ]; then
    # treat as stale if port is free (no hugo listening) and lock is not brand-new
    PORT_FREE=true
    if have_cmd lsof && lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
      PORT_FREE=false
    fi
    if $PORT_FREE; then
      # use seconds-resolution mtime check (portable: stat fallback)
      LOCK_AGE=999
      if stat -f %m "$ROOT/.hugo_build.lock" >/dev/null 2>&1; then
        LOCK_MTIME="$(stat -f %m "$ROOT/.hugo_build.lock" 2>/dev/null || echo 0)"
        NOW_SECS="$(date +%s)"
        LOCK_AGE=$((NOW_SECS - LOCK_MTIME))
      fi
      if [ "$LOCK_AGE" -gt 3 ] || [ ! -s "$ROOT/.hugo_build.lock" ]; then
        warn "removing stale .hugo_build.lock (age ${LOCK_AGE}s, port free)"
        rm -f "$ROOT/.hugo_build.lock"
      fi
    fi
  fi

  info "starting hugo (attempt $((RESTARTS+1)), backoff ${BACKOFF}s) …"
  log_to_file "starting: ${HUGO_BIN} ${HUGO_ARGS[*]}"

  set +e
  # Process substitution: $! is hugo, not tee. With `hugo | tee` $! would
  # be tee; kill_tree would kill only tee and leave hugo orphaned on $PORT.
  launch_hugo
  HUGO_PID=$!
  set -e

  # Poll for crash vs healthy
  CRASHED=false
  HUGO_EXIT=""
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16; do
    sleep 0.5
    if ! kill -0 "$HUGO_PID" 2>/dev/null; then
      wait "$HUGO_PID" 2>/dev/null || HUGO_EXIT=$?
      HUGO_EXIT="${HUGO_EXIT:-1}"
      warn "hugo exited immediately with $HUGO_EXIT"
      log_to_file "hugo exited immediately code=$HUGO_EXIT"
      CRASHED=true
      break
    fi
    if is_alive_url; then
      info "healthy  http://${BIND}:${PORT}${HEALTH_PATH}"
      log_to_file "healthy http://${BIND}:${PORT}${HEALTH_PATH}"
      BACKOFF=1
      FAIL_STREAK=0
      LAST_OK="$(date +%s)"
      break
    fi
  done

  if $CRASHED; then
    FAIL_STREAK=$((FAIL_STREAK + 1))
    RESTARTS=$((RESTARTS + 1))
    if [ "$FAIL_STREAK" -ge 5 ]; then
      warn "5 consecutive immediate crashes — cooling down ${MAX_BACKOFF}s (check $LOGFILE)"
      log_to_file "5 crashes in a row, cooling down ${MAX_BACKOFF}s"
      sleep "$MAX_BACKOFF"
      FAIL_STREAK=0
      BACKOFF=1
    else
      sleep "$BACKOFF"
      BACKOFF=$((BACKOFF * 2))
      [ "$BACKOFF" -gt "$MAX_BACKOFF" ] && BACKOFF=$MAX_BACKOFF
    fi
    continue
  fi

  # ── steady-state: watch hugo liveness + HTTP health ─────────────────
  # NOTE: do NOT use a background subshell `( wait "$HUGO_PID" ) &` to detect
  # exit. A subshell is not the parent of hugo, so `wait` fails immediately
  # with 127 and leaves the real hugo orphaned on $PORT — the health probe
  # then still sees 200 from the orphan while restarts accumulate and fail
  # to bind. Poll `kill -0` in the main shell and `wait` here to reap.
  HEALTH_FAILS=0
  SHOULD_RESTART=false
  HUGO_EXIT=""

  while true; do
    # Sleep in background so trapped SIGTERM can interrupt it immediately;
    # plain `sleep 5` in foreground defers the trap for up to 5s.
    sleep "$HEALTH_INTERVAL" &
    SLEEP_PID=$!
    set +e
    wait "$SLEEP_PID" 2>/dev/null || true
    set -e

    # has hugo exited on its own? (kill -0 is the only portable non-blocking test;
    # `wait` in a subshell cannot see the parent's children and returns 127)
    if ! kill -0 "$HUGO_PID" 2>/dev/null; then
      set +e
      wait "$HUGO_PID" 2>/dev/null
      HUGO_EXIT=$?
      set -e
      # wait returns 127 if pid was already reaped; treat as generic failure
      HUGO_EXIT="${HUGO_EXIT:-1}"
      if [ "$HUGO_EXIT" = "0" ]; then
        info "hugo exited cleanly (code 0) — restarting"
        log_to_file "hugo exited code 0"
      else
        warn "hugo crashed  exit=$HUGO_EXIT — restarting in ${BACKOFF}s"
        log_to_file "hugo crashed exit=$HUGO_EXIT"
      fi
      SHOULD_RESTART=true
      break
    fi

    if is_alive_url; then
      HEALTH_FAILS=0
      LAST_OK="$(date +%s)"
    else
      HEALTH_FAILS=$((HEALTH_FAILS + 1))
      warn "health check failed ($HEALTH_FAILS/$HEALTH_RETRIES)  http://${BIND}:${PORT}${HEALTH_PATH}"
      log_to_file "health fail $HEALTH_FAILS/$HEALTH_RETRIES http://${BIND}:${PORT}${HEALTH_PATH}"
      if [ "$HEALTH_FAILS" -ge "$HEALTH_RETRIES" ]; then
        warn "health failed ${HEALTH_RETRIES}× — killing hung hugo pid $HUGO_PID and restarting"
        log_to_file "health exceeded retries, killing $HUGO_PID"
        kill_tree "$HUGO_PID"
        # reap the killed process so the pid can be reused and .hugo_build.lock
        # does not stay stale; wait may return non-zero — that's the point
        set +e
        wait "$HUGO_PID" 2>/dev/null || true
        set -e
        SHOULD_RESTART=true
        break
      fi
    fi

    NOW="$(date +%s)"
    if [ "$FAIL_STREAK" -gt 0 ] && [ $((NOW - LAST_OK)) -gt 60 ]; then
      FAIL_STREAK=0
      BACKOFF=1
    fi
  done

  if $SHOULD_RESTART; then
    FAIL_STREAK=$((FAIL_STREAK + 1))
    RESTARTS=$((RESTARTS + 1))
    if [ "$FAIL_STREAK" -ge 5 ]; then
      warn "5 consecutive failures — cooling down ${MAX_BACKOFF}s"
      sleep "$MAX_BACKOFF"
      FAIL_STREAK=0
      BACKOFF=1
    else
      sleep "$BACKOFF"
      BACKOFF=$((BACKOFF * 2))
      [ "$BACKOFF" -gt "$MAX_BACKOFF" ] && BACKOFF=$MAX_BACKOFF
    fi
  fi
done
