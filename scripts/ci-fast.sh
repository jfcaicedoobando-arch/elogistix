#!/usr/bin/env bash
# ci:fast — corre en paralelo el mismo set de checks que CI, con logs
# separados y resumen ordenado al final.
#
# Uso:
#   bun run ci:fast                       # set rápido (default)
#   bun run ci:fast -- --parity           # paridad completa con .github/workflows/ci.yml
#   bun run ci:fast -- --only lint,vitest # sólo esas tareas
#   bun run ci:fast -- --skip vitest      # todas menos ésa
#   bun run ci:fast -- --no-fail-fast     # espera a que terminen todas aunque una falle
#   bun run ci:fast -- --with-build       # además corre `bun run build`
#
# Salida:
#   - Logs por tarea en .ci-fast-logs/<timestamp>/<task>.log
#   - Si todo pasa, se limpia el directorio de logs.
#   - Si algo falla, se conserva y se imprime la ruta.
#
# v13.320.10 — reescrito: paridad con CI, fail-fast, trap, orden estable,
# duración por tarea, selección --only/--skip.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ---------- Preflight ----------
if ! command -v bun >/dev/null 2>&1; then
  echo "❌ bun no está en PATH. Instalá bun antes de correr ci:fast." >&2
  exit 127
fi
if [ ! -d node_modules ]; then
  echo "❌ node_modules/ no existe. Corré 'bun install' primero." >&2
  exit 127
fi

# ---------- Flags ----------
FAIL_FAST=1
PARITY=0
WITH_BUILD=0
ONLY=""
SKIP=""

while [ $# -gt 0 ]; do
  case "$1" in
    --parity)       PARITY=1 ;;
    --with-build)   WITH_BUILD=1 ;;
    --no-fail-fast) FAIL_FAST=0 ;;
    --fail-fast)    FAIL_FAST=1 ;;
    --only)         ONLY="${2:-}"; shift ;;
    --only=*)       ONLY="${1#--only=}" ;;
    --skip)         SKIP="${2:-}"; shift ;;
    --skip=*)       SKIP="${1#--skip=}" ;;
    -h|--help)
      sed -n '2,20p' "$0"; exit 0 ;;
    *)
      echo "⚠️  flag desconocido: $1" >&2; exit 2 ;;
  esac
  shift
done

# ---------- Definición de tareas (arreglo ordenado) ----------
# Formato: "name|comando..."
TASKS=(
  "lint|bun run lint --max-warnings 0"
  "typecheck|bun run typecheck"
  "migrations|bun run audit:migrations"
  "vitest|bun run test:fast --reporter=dot --bail=1"
)

if [ "$PARITY" = "1" ]; then
  TASKS+=(
    "knip|bun run lint:unused:strict"
    "arch|bun run audit:arch"
    "casts|bun run audit:casts"
    "tests-aud|bun run audit:tests"
    "schema|bun run audit:schema"
    "arch-gate|bunx vitest run src/lib/__tests__/architecture.test.ts src/lib/__tests__/architecture-baseline.test.ts src/__tests__/audit-report.test.ts src/__tests__/audit-casts-classifier.test.ts"
  )
fi

if [ "$WITH_BUILD" = "1" ]; then
  TASKS+=("build|bun run build")
fi

# Aplicar --only / --skip
filter_tasks() {
  local -a out=()
  local entry name
  for entry in "${TASKS[@]}"; do
    name="${entry%%|*}"
    if [ -n "$ONLY" ] && ! [[ ",${ONLY}," == *",${name},"* ]]; then continue; fi
    if [ -n "$SKIP" ] &&   [[ ",${SKIP}," == *",${name},"* ]]; then continue; fi
    out+=("$entry")
  done
  TASKS=("${out[@]}")
}
filter_tasks

if [ "${#TASKS[@]}" -eq 0 ]; then
  echo "⚠️  Sin tareas después de aplicar --only/--skip." >&2
  exit 2
fi

# ---------- Setup logs ----------
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ROOT/.ci-fast-logs/$STAMP"
mkdir -p "$LOG_DIR"

# ---------- Trap: mata hijos si cancelan / fallan ----------
CHILD_PIDS=()
cleanup() {
  local pid
  for pid in "${CHILD_PIDS[@]:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      # SIGTERM al grupo, luego SIGKILL si sigue vivo.
      kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  sleep 0.3 2>/dev/null || true
  for pid in "${CHILD_PIDS[@]:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup INT TERM

# Habilita job control para que cada hijo tenga su propio grupo (kill -TERM -PID mata al grupo).
set -m

# ---------- Lanzar tareas en paralelo ----------
declare -a T_NAMES T_PIDS T_STARTS
declare -A T_INDEX_BY_PID

start_task() {
  local name="$1" cmd="$2"
  local log="$LOG_DIR/$name.log"
  # shellcheck disable=SC2086
  ( eval "$cmd" ) >"$log" 2>&1 &
  local pid=$!
  T_NAMES+=("$name")
  T_PIDS+=("$pid")
  T_STARTS+=("$SECONDS")
  T_INDEX_BY_PID[$pid]=$((${#T_NAMES[@]} - 1))
  CHILD_PIDS+=("$pid")
  echo "▶ $name (pid=$pid) → $log"
}

TOTAL_START=$SECONDS
for entry in "${TASKS[@]}"; do
  start_task "${entry%%|*}" "${entry#*|}"
done

# ---------- Esperar (con o sin fail-fast) ----------
declare -a T_EXITS T_DURS
for _ in "${TASKS[@]}"; do T_EXITS+=("-1"); T_DURS+=("0"); done

remaining=${#T_PIDS[@]}
first_fail=""

BASH_MAJOR="${BASH_VERSION%%.*}"
have_wait_n=0
if [ "$BASH_MAJOR" -ge 5 ]; then have_wait_n=1; fi

reap_pid() {
  local pid="$1" code="$2"
  local idx="${T_INDEX_BY_PID[$pid]}"
  local start="${T_STARTS[$idx]}"
  T_EXITS[$idx]=$code
  T_DURS[$idx]=$((SECONDS - start))
  remaining=$((remaining - 1))
  if [ "$code" != "0" ] && [ -z "$first_fail" ]; then
    first_fail="${T_NAMES[$idx]}"
  fi
}

if [ "$have_wait_n" = "1" ]; then
  while [ "$remaining" -gt 0 ]; do
    # wait -n -p PID (bash 5.1+) captura el PID que terminó. Fallback: buscar por kill -0.
    finished_pid=""
    if wait -n -p finished_pid "${T_PIDS[@]}"; then
      code=0
    else
      code=$?
    fi
    if [ -z "$finished_pid" ]; then
      # bash 5.0: sin -p. Buscar cuál murió.
      for pid in "${T_PIDS[@]}"; do
        idx="${T_INDEX_BY_PID[$pid]}"
        [ "${T_EXITS[$idx]}" = "-1" ] || continue
        if ! kill -0 "$pid" 2>/dev/null; then finished_pid=$pid; break; fi
      done
    fi
    [ -n "$finished_pid" ] || break
    reap_pid "$finished_pid" "$code"
    if [ "$FAIL_FAST" = "1" ] && [ -n "$first_fail" ] && [ "$remaining" -gt 0 ]; then
      echo "⛔ fail-fast: '$first_fail' falló → cancelando tareas restantes"
      cleanup
      break
    fi
  done
else
  # Fallback bash < 5: espera secuencial en orden de lanzamiento.
  for i in "${!T_PIDS[@]}"; do
    pid="${T_PIDS[$i]}"
    if wait "$pid"; then code=0; else code=$?; fi
    reap_pid "$pid" "$code"
    if [ "$FAIL_FAST" = "1" ] && [ "$code" != "0" ]; then
      echo "⛔ fail-fast: '${T_NAMES[$i]}' falló → cancelando tareas restantes"
      cleanup
      break
    fi
  done
fi

# Drenar los que quedaron pendientes (cancelados) para no dejar zombies.
for i in "${!T_PIDS[@]}"; do
  [ "${T_EXITS[$i]}" = "-1" ] || continue
  wait "${T_PIDS[$i]}" 2>/dev/null || true
  T_EXITS[$i]=130
  T_DURS[$i]=$((SECONDS - T_STARTS[i]))
done

# ---------- Resumen ordenado ----------
TOTAL_DUR=$((SECONDS - TOTAL_START))
fail=0
echo ""
echo "── Resumen ─────────────────────────────────"
for i in "${!T_NAMES[@]}"; do
  name="${T_NAMES[$i]}"
  code="${T_EXITS[$i]}"
  dur="${T_DURS[$i]}"
  if [ "$code" = "0" ]; then
    printf "✅ %-12s %3ss\n" "$name" "$dur"
  elif [ "$code" = "130" ]; then
    printf "⏹  %-12s %3ss  (cancelado por fail-fast)\n" "$name" "$dur"
    fail=1
  else
    printf "❌ %-12s %3ss  (exit=%s)\n" "$name" "$dur" "$code"
    echo "   ── últimas 60 líneas de $LOG_DIR/$name.log ──"
    tail -n 60 "$LOG_DIR/$name.log" | sed 's/^/     /'
    fail=1
  fi
done
echo "────────────────────────────────────────────"
printf "⏱  total: %ss\n" "$TOTAL_DUR"

if [ "$fail" = "0" ]; then
  # Limpieza en verde: no dejamos basura.
  rm -rf "$LOG_DIR"
else
  echo "📂 Logs conservados en: $LOG_DIR"
fi

exit $fail
