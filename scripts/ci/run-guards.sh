#!/usr/bin/env bash
# Ejecuta en paralelo las suites listadas en supabase/tests/_guards_manifest.txt.
#
# Antes: ~50 pasos secuenciales en el job `rls-guards` (mantenimiento manual del
# YAML + tiempo de CI lineal). Ahora: un manifiesto + este runner.
#
# Cada suite corre en su propia sesión psql con ON_ERROR_STOP, su log queda en
# $LOG_DIR/<suite>.log y al final se imprime el resumen. Sale con código 1 si
# alguna falló, listando sólo las fallidas con las últimas líneas de su log.
#
# Variables:
#   MANIFEST  ruta del manifiesto (default: supabase/tests/_guards_manifest.txt)
#   JOBS      concurrencia (default: 4)
#   LOG_DIR   carpeta de logs (default: /tmp/guards-logs)
set -uo pipefail

MANIFEST="${MANIFEST:-supabase/tests/_guards_manifest.txt}"
JOBS="${JOBS:-4}"
LOG_DIR="${LOG_DIR:-/tmp/guards-logs}"

if [ ! -f "$MANIFEST" ]; then
  echo "::error::No existe el manifiesto $MANIFEST"
  exit 1
fi

mkdir -p "$LOG_DIR"
rm -f "$LOG_DIR"/*.log "$LOG_DIR"/*.status 2>/dev/null || true

mapfile -t SUITES < <(grep -vE '^\s*(#|$)' "$MANIFEST")

if [ "${#SUITES[@]}" -eq 0 ]; then
  echo "::error::El manifiesto $MANIFEST no lista ninguna suite"
  exit 1
fi

faltantes=0
for suite in "${SUITES[@]}"; do
  if [ ! -f "$suite" ]; then
    echo "::error::Suite listada en el manifiesto pero inexistente: $suite"
    faltantes=$((faltantes + 1))
  fi
done
[ "$faltantes" -gt 0 ] && exit 1

echo "Ejecutando ${#SUITES[@]} guards con concurrencia $JOBS…"

corre_una() {
  local suite="$1"
  local nombre
  nombre="$(basename "$suite" .sql)"
  local log="$LOG_DIR/$nombre.log"
  if psql -v ON_ERROR_STOP=1 -X -q -f "$suite" >"$log" 2>&1; then
    echo "ok" >"$LOG_DIR/$nombre.status"
    echo "  ✓ $nombre"
  else
    echo "fail" >"$LOG_DIR/$nombre.status"
    echo "  ✗ $nombre"
  fi
}
export -f corre_una
export LOG_DIR

printf '%s\n' "${SUITES[@]}" \
  | xargs -P "$JOBS" -I{} bash -c 'corre_una "$@"' _ {}

fallidas=()
for suite in "${SUITES[@]}"; do
  nombre="$(basename "$suite" .sql)"
  estado="$(cat "$LOG_DIR/$nombre.status" 2>/dev/null || echo 'fail')"
  [ "$estado" = "ok" ] || fallidas+=("$nombre")
done

echo
echo "Resumen: $(( ${#SUITES[@]} - ${#fallidas[@]} ))/${#SUITES[@]} guards en verde."

if [ "${#fallidas[@]}" -gt 0 ]; then
  for nombre in "${fallidas[@]}"; do
    echo "::group::❌ $nombre"
    tail -n 40 "$LOG_DIR/$nombre.log" 2>/dev/null || echo '(sin log)'
    echo "::endgroup::"
    echo "::error::Guard fallido: $nombre (log completo en el artifact rls-guards-logs)"
  done
  exit 1
fi
