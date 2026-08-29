#!/usr/bin/env bash
# ============================================================================
# Generador de supabase/tests/rls/_ci_service_role_only.sql
#
# Deriva la lista canónica DIRECTO del esquema real (pg_proc + privilegios
# EXECUTE efectivos): toda función `public` que `service_role` puede ejecutar
# y que `public`/`anon`/`authenticated` no, pertenece a la lista. Es la misma
# consulta de la Dirección B de `_ci_check_service_role_only.sql`, así el
# archivo generado y el candado nunca divergen.
#
# Uso:
#   scripts/db/gen-service-role-only.sh            # reescribe el archivo
#   scripts/db/gen-service-role-only.sh --check    # no escribe; exit 1 si hay drift
#
# Conexión: usa las variables PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE del
# entorno. IMPORTANTE: correrlo contra una base con las migraciones aplicadas
# y ANTES de `_ci_post_migrate.sql` (su GRANT masivo distorsiona el patrón).
# En CI ese punto existe en el job que aplica migraciones; contra la base
# gestionada (Lovable Cloud) el estado ya es el real de producción.
# ============================================================================
set -euo pipefail

OBJETIVO="supabase/tests/rls/_ci_service_role_only.sql"
PSQL=${PSQL:-psql}

filas="$(
  $PSQL -X -q -A -t -F '' <<'SQL'
SELECT '  (''' || n.nspname || '.' || p.proname || '('
    || oidvectortypes(p.proargtypes) || ')''),'
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prokind = 'f'
   AND has_function_privilege('service_role', p.oid, 'EXECUTE')
   AND NOT has_function_privilege('public', p.oid, 'EXECUTE')
   AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
   AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
 ORDER BY 1;
SQL
)"

if [ -z "$filas" ]; then
  echo "error: la consulta no devolvió funciones; ¿la conexión apunta a la base correcta?" >&2
  exit 1
fi
# Quitar la coma de la última fila para dejar SQL válido.
filas="$(printf '%s\n' "$filas" | sed '$ s/,$//')"

contenido="$(cat <<EOF
-- ============================================================================
-- Lista canónica de funciones service_role-only (FIX4 tanda 4 · P3).
--
-- ⚠️  ARCHIVO GENERADO — no editar a mano. Se regenera con:
--       scripts/db/gen-service-role-only.sh
--     a partir del esquema real (pg_proc + privilegios EXECUTE). El CI lo
--     verifica con \`--check\` y falla si la PR no lo regeneró.
--
-- ÚNICA fuente de verdad del patrón "sólo service_role / llamadas internas
-- DEFINER". Se consume con \ir desde:
--   · _ci_post_migrate.sql            → re-cierra todo lo de la lista tras el
--                                       GRANT masivo del Postgres bare de CI.
--   · _ci_check_service_role_only.sql → candado bidireccional que corre ANTES
--                                       del re-cierre (ver su encabezado).
--   · ../fix4_service_role_only_grants.sql → verifica el estado ya re-cerrado.
--
-- Reglas al tocar funciones service_role-only:
--   · Toda función de este patrón DEBE traer su REVOKE en su propia
--     migración (el candado bidireccional falla si no).
--   · Tras la migración, regenera este archivo en la misma PR:
--       PGHOST=... PGUSER=... scripts/db/gen-service-role-only.sh
-- ============================================================================

DROP TABLE IF EXISTS pg_temp._ci_service_role_only;
CREATE TEMP TABLE _ci_service_role_only (fn text);
INSERT INTO _ci_service_role_only (fn) VALUES
$filas;
EOF
)"

if [ "${1:-}" = "--check" ]; then
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' EXIT
  printf '%s\n' "$contenido" > "$tmp"
  if diff -u "$OBJETIVO" "$tmp" > /dev/null; then
    echo "OK: $OBJETIVO está sincronizado con el esquema."
  else
    echo "::error::$OBJETIVO está desincronizado con el esquema real." >&2
    echo "Regenera con: scripts/db/gen-service-role-only.sh" >&2
    diff -u "$OBJETIVO" "$tmp" | head -60 >&2 || true
    exit 1
  fi
else
  printf '%s\n' "$contenido" > "$OBJETIVO"
  n="$(printf '%s\n' "$filas" | grep -c "('public\.")"
  echo "OK: $OBJETIVO regenerado con $n funciones service_role-only."
fi
