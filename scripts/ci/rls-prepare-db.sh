#!/usr/bin/env bash
# Prepara la BD efímera de CI para las suites RLS:
#   1) bootstrap de stubs (auth/storage/cron/net/pgmq)
#   2) baseline squash (fuente única hasta el corte)
#   3) replay ORDENADO de todas las migraciones NO incluidas en el squash
#
# Extraído del YAML para no repetir el `sed` de stubbing de extensiones tres
# veces. No cambia el comportamiento: mismos archivos, mismo orden, mismos
# --single-transaction y ON_ERROR_STOP.
#
# Requiere las variables PG* del entorno (PGHOST/PGUSER/…).
set -uo pipefail

PSQL=(psql -v ON_ERROR_STOP=1 -X -q)
CUTOFF_ENV="supabase/schema/squash/cutoff.env"

# Stubbea CREATE EXTENSION de extensiones no disponibles en la imagen de CI.
stub_extensiones() {
  sed -E \
    -e 's/^[[:space:]]+CREATE EXTENSION[[:space:]]+(IF NOT EXISTS[[:space:]]+)?(pg_cron|pg_net|pgmq|supabase_vault)[^;]*;/    PERFORM 1; -- [ci] stubbed \2/I' \
    -e 's/^CREATE EXTENSION[[:space:]]+(IF NOT EXISTS[[:space:]]+)?(pg_cron|pg_net|pgmq|supabase_vault)[^;]*;/SELECT 1; -- [ci] stubbed \2/I' \
    "$1"
}

echo "▶ Bootstrap (stubs auth/storage/cron/net/pgmq)"
"${PSQL[@]}" -f supabase/tests/rls/_ci_bootstrap.sql || exit 1

if [ ! -f "$CUTOFF_ENV" ]; then
  echo "::error::No existe $CUTOFF_ENV (corte del squash)"
  exit 1
fi
# Sólo asignaciones simples del archivo de corte (SQUASH_FILE, SQUASH_INCLUDED…).
set -a
eval "$(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$CUTOFF_ENV")"
set +a

echo "▶ Baseline squash: $SQUASH_FILE"
stub_extensiones "$SQUASH_FILE" | "${PSQL[@]}" --single-transaction || exit 1

echo "▶ Replay de migraciones posteriores al squash"
shopt -s nullglob
aplicadas=0
for f in $(printf '%s\n' supabase/migrations/*.sql | LC_ALL=C sort); do
  base="$(basename "$f")"
  # El corte por timestamp no basta: hay migraciones creadas DESPUÉS del squash
  # con timestamp anterior al corte. La fuente de verdad es el inventario de
  # archivos incluidos en el squash.
  grep -qxF "$base" "$SQUASH_INCLUDED" && continue

  echo "▶ $base"
  if stub_extensiones "$f" | "${PSQL[@]}" --single-transaction; then
    aplicadas=$((aplicadas + 1))
    continue
  fi
  echo "::error file=$f::la migración no aplica sobre el baseline squash"
  exit 1
done

echo "✓ BD preparada · $aplicadas migraciones posteriores al squash aplicadas"
