#!/usr/bin/env bash
# ci:fast — corre lint, typecheck y vitest (perfil rápido) en paralelo.
# Cada tarea escribe su salida en /tmp/ci-fast-*.log y sólo se imprime al final
# para que los logs no se entrelacen. Sale con código != 0 si alguna falla.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG_DIR="$(mktemp -d -t ci-fast.XXXXXX)"
declare -A PIDS
declare -A NAMES

start() {
  local name="$1"; shift
  local log="$LOG_DIR/$name.log"
  ( "$@" ) >"$log" 2>&1 &
  local pid=$!
  PIDS[$name]=$pid
  NAMES[$pid]=$name
  echo "▶ $name (pid=$pid) → $log"
}

start lint       bun run lint -- --max-warnings 0
start typecheck  bun run typecheck
start migrations bun run audit:migrations
start vitest     bun run test:fast --reporter=dot --bail=1

fail=0
for name in "${!PIDS[@]}"; do
  pid=${PIDS[$name]}
  if wait "$pid"; then
    echo "✅ $name"
  else
    code=$?
    echo "❌ $name (exit=$code) — log:"
    tail -n 60 "$LOG_DIR/$name.log" | sed 's/^/    /'
    fail=1
  fi
done

echo ""
echo "Logs completos: $LOG_DIR"
exit $fail
