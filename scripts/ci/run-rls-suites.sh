#!/usr/bin/env bash
# Ejecuta TODAS las suites supabase/tests/rls/test_rls_*.sql descubiertas por
# patrón (sin matriz duplicada que se desincronice).
#
# Cada suite es una transacción BEGIN … ROLLBACK, así que corren en la misma BD
# sin contaminarse. Antes de ejecutarlas se verifica ese aislamiento: una suite
# sin BEGIN o sin ROLLBACK final se reporta como fallo (no se ejecuta a ciegas).
#
# Nunca acepta verde con 0 suites y nunca omite una suite en silencio.
#
# Variables:
#   LOG_DIR   carpeta de logs (default: .rls-logs)
set -uo pipefail
set -uo pipefail

DIR="supabase/tests/rls"
LOG_DIR="${LOG_DIR:-.rls-logs}"
MIN_SUITES="${MIN_SUITES:-30}"
PSQL=(psql -v ON_ERROR_STOP=1 -X -q)

mkdir -p "$LOG_DIR"

mapfile -t SUITES < <(find "$DIR" -maxdepth 1 -name 'test_rls_*.sql' | LC_ALL=C sort)

if [ "${#SUITES[@]}" -lt "$MIN_SUITES" ]; then
  echo "::error::Se descubrieron ${#SUITES[@]} suites RLS (< $MIN_SUITES esperadas). ¿Patrón o carpeta equivocados?"
  exit 1
fi

# Aislamiento: BEGIN al inicio y ROLLBACK al final, sin COMMIT de nivel superior.
mal_aisladas=()
for suite in "${SUITES[@]}"; do
  tiene_begin=$(grep -cE '^BEGIN;' "$suite" || true)
  tiene_rollback=$(grep -cE '^ROLLBACK;' "$suite" || true)
  tiene_commit=$(grep -cE '^COMMIT;' "$suite" || true)
  if [ "$tiene_begin" -eq 0 ] || [ "$tiene_rollback" -eq 0 ] || [ "$tiene_commit" -gt 0 ]; then
    mal_aisladas+=("$(basename "$suite")")
  fi
done
if [ "${#mal_aisladas[@]}" -gt 0 ]; then
  for s in "${mal_aisladas[@]}"; do
    echo "::error::$s no cumple el aislamiento BEGIN…ROLLBACK (o hace COMMIT)."
  done
  exit 1
fi

echo "Ejecutando ${#SUITES[@]} suites RLS…"

fallidas=()
for suite in "${SUITES[@]}"; do
  nombre="$(basename "$suite" .sql)"
  echo "::group::$nombre"
  # Cada suite corre aunque la anterior falle: un PR ve TODOS los fallos.
  if "${PSQL[@]}" -f "$suite" >"$LOG_DIR/$nombre.log" 2>&1; then
    echo "✓ $nombre"
  else
    tail -n 40 "$LOG_DIR/$nombre.log"
    echo "::error::RLS suite fallida: $nombre"
    fallidas+=("$nombre")
  fi
  echo "::endgroup::"
done

echo
echo "Resumen: $(( ${#SUITES[@]} - ${#fallidas[@]} ))/${#SUITES[@]} suites RLS en verde."
{
  echo "### RLS suites"
  echo ""
  if [ "${#fallidas[@]}" -eq 0 ]; then
    echo "✅ ${#SUITES[@]}/${#SUITES[@]} suites en verde."
  else
    echo "❌ Suites fallidas (${#fallidas[@]}/${#SUITES[@]}):"
    for s in "${fallidas[@]}"; do echo "- \`$s\`"; done
  fi
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

[ "${#fallidas[@]}" -eq 0 ]
