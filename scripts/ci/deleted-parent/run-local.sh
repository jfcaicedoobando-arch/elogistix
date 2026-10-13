#!/usr/bin/env bash
# Only a fresh owned cluster. Supply already installed binaries; no installation/download.
set -euo pipefail
# Ignore inherited libpq routing/options; every connection targets this fresh cluster.
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGPASSFILE DATABASE_URL SUPABASE_DB_URL
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
: "${POSTGRES_BIN:?directory containing initdb, pg_ctl and postgres}"
: "${PSQL_BIN:?path to an already installed psql}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/deleted-parent-XXXXXX")"
PORT="${TEST_PG_PORT:-56413}"
cleanup() { "$POSTGRES_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$POSTGRES_BIN/initdb" -D "$WORK/data" -U guard_owner --auth=trust --no-locale --encoding=UTF8 >"$WORK/initdb.log"
"$POSTGRES_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" -o "-h 127.0.0.1 -p $PORT -k ''" -w start
python3 "$HERE/assemble-baseline.py" "$WORK/baseline.sql"
ARGS=(-X -w -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U guard_owner -d postgres)
FILES=(-f "$HERE/fixture.sql" -f "$WORK/baseline.sql")
if [[ -n "${ADMISSION_NEGATIVE:-}" ]]; then
  case "$ADMISSION_NEGATIVE" in
    body)
      python3 "$HERE/assemble-baseline.py" "$WORK/drift.sql" assert_factura_viva_para_rep
      # Body-comment drift, no permission or behavior expansion.
      sed -i 's/DECLARE/DECLARE -- unreviewed body drift/' "$WORK/drift.sql" ;;
    security)
      echo 'ALTER FUNCTION public._nc_validar_linaje_conceptos() SECURITY INVOKER;' > "$WORK/drift.sql" ;;
    search_path)
      echo "ALTER FUNCTION public.assert_factura_viva_para_rep() SET search_path TO pg_catalog;" > "$WORK/drift.sql" ;;
    *) echo "Unknown ADMISSION_NEGATIVE" >&2; exit 2 ;;
  esac
  FILES+=(-f "$WORK/drift.sql")
fi
if [[ "${NEGATIVE_CONTROL:-0}" != 1 ]]; then
  FILES+=(-f "$ROOT/supabase/migrations/20261013141500_factura_eliminada_guard_hijos.sql")
  # Reapplication must preserve OIDs, owner, ACL and security attributes too.
  FILES+=(-f "$ROOT/supabase/migrations/20261013141500_factura_eliminada_guard_hijos.sql")
fi
if [[ -n "${NEGATIVE_SCOPE:-}" ]]; then
  case "$NEGATIVE_SCOPE" in
    nc) FUNCTION=_nc_validar_linaje_conceptos ;;
    rep) FUNCTION=assert_factura_viva_para_rep ;;
    duplicate) FUNCTION=duplicar_factura_para_sustitucion ;;
    *) echo "Unknown NEGATIVE_SCOPE" >&2; exit 2 ;;
  esac
  python3 "$HERE/assemble-baseline.py" "$WORK/unpatched.sql" "$FUNCTION"
  FILES+=(-f "$WORK/unpatched.sql")
fi
"$PSQL_BIN" "${ARGS[@]}" "${FILES[@]}" -f "$HERE/cases.sql" -f "$ROOT/supabase/tests/factura_eliminada_guard_hijos.sql"
echo "Disposable fixture directory: $WORK (server stopped by EXIT trap)"
