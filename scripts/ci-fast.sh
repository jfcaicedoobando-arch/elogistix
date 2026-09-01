#!/usr/bin/env bash
# ci:fast — checks rápidos en paralelo antes de pushear.
# NO es el suite completo de CI: para eso está `.github/workflows/ci.yml`.
# Objetivo: dar señal en < 2 min sobre lo que rompe más seguido.
#
# Uso:
#   bun run ci:fast                       # set rápido (default)
#   bun run ci:fast -- --only lint,vitest # sólo esas tareas
#   bun run ci:fast -- --skip vitest      # todas menos ésa
#   bun run ci:fast -- --no-fail-fast     # espera aunque una falle
#
# Salida:
#   - Logs por tarea en .ci-fast-logs/<timestamp>/<task>.log
#   - En verde se auto-limpian; en rojo se conservan y se imprime la ruta.
#
# v13.320.11 — mejoras: fail-fast, trap para matar hijos, orden estable,
# duración por tarea, selección --only/--skip. Se mantiene mínimo a propósito.

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
ONLY=""
SKIP=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-fail-fast) FAIL_FAST=0 ;;
    --fail-fast)    FAIL_FAST=1 ;;
    --only)         ONLY="${2:-}"; shift ;;
    --only=*)       ONLY="${1#--only=}" ;;
    --skip)         SKIP="${2:-}"; shift ;;
    --skip=*)       SKIP="${1#--skip=}" ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *)
      echo "⚠️  flag desconocido: $1" >&2; exit 2 ;;
  esac
  shift
done

# ---------- Definición de tareas (arreglo ordenado) ----------
# Formato: "name|comando..."
# NOTA: mantener este set MÍNIMO. Para el suite completo usar CI real.
#
# v13.821.2 (optimización):
#   - `vitest` va primera: es la tarea más larga, así arranca sin esperar slot.
#   - `audit:migrations` + `audit:sonner` se fusionan en `audits`: ambas duran
#     ~1-3s y cada una pagaba su propio arranque de bun/tsx.
#   - se limita el pool de workers de vitest para que no compita con
#     eslint/tsc por los mismos núcleos (antes se peleaban por todos).
CORES="$( (nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null) || echo 4 )"
VITEST_WORKERS=$(( CORES > 4 ? CORES - 2 : 2 ))

TASKS=(
  "vitest|bun run test:fast --reporter=dot --bail=1 --maxWorkers=$VITEST_WORKERS"
  "lint|bun run lint --max-warnings 0"
  "typecheck|bun run typecheck"
  "audits|bun run audit:migrations && bun run audit:sonner"
)

ALL_NAMES=""
for entry in "${TASKS[@]}"; do ALL_NAMES="$ALL_NAMES,${entry%%|*}"; done
ALL_NAMES="$ALL_NAMES,"

# Un nombre mal escrito en --only/--skip antes se ignoraba en silencio y el
# script terminaba en verde sin haber corrido lo que pedías.
validar_nombres() {
  local lista="$1" flag="$2" name
  [ -n "$lista" ] || return 0
  IFS=',' read -r -a _pedidos <<< "$lista"
  for name in "${_pedidos[@]}"; do
    [ -n "$name" ] || continue
    if [[ "$ALL_NAMES" != *",${name},"* ]]; then
      echo "❌ $flag: tarea desconocida '$name'. Disponibles:${ALL_NAMES%,}" >&2
      exit 2
    fi
  done
}
validar_nombres "$ONLY" "--only"
validar_nombres "$SKIP" "--skip"

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
# Sólo se conservan los logs de corridas en rojo; podamos los más viejos para
# que el directorio no crezca sin límite (se quedan las 5 corridas recientes).
ls -1dt "$ROOT/.ci-fast-logs"/*/ 2>/dev/null | tail -n +6 | while read -r vieja; do
  rm -rf "$vieja"
done


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
    # Sólo esperamos PIDs pendientes: pasar uno ya cosechado hace que
    # `wait -n` falle con 127 y aborte el loop (bug hasta v13.594.7).
    pending_pids=()
    for pid in "${T_PIDS[@]}"; do
      idx="${T_INDEX_BY_PID[$pid]}"
      [ "${T_EXITS[$idx]}" = "-1" ] && pending_pids+=("$pid")
    done
    [ "${#pending_pids[@]}" -gt 0 ] || break
    # wait -n -p PID (bash 5.1+) captura el PID que terminó. Fallback: buscar por kill -0.
    finished_pid=""
    if wait -n -p finished_pid "${pending_pids[@]}"; then
      code=0
    else
      code=$?
    fi
    if [ -z "$finished_pid" ]; then
      # bash 5.0: sin -p. Buscar cuál murió.
      for pid in "${pending_pids[@]}"; do
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
