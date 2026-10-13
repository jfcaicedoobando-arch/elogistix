#!/usr/bin/env bash
# Fresh owned PostgreSQL only; use existing binaries. No download/install/security changes.
set -euo pipefail
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGPASSFILE DATABASE_URL SUPABASE_DB_URL
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
: "${POSTGRES_BIN:?directory containing already installed PostgreSQL binaries}"
: "${PSQL_BIN:?path to already installed psql}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/remaining-parent-XXXXXX")"
export TEST_PG_PORT="${TEST_PG_PORT:-56427}"
cleanup() { "$POSTGRES_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$POSTGRES_BIN/initdb" -D "$WORK/data" -U guard_owner --auth=trust --no-locale --encoding=UTF8 >"$WORK/initdb.log"
"$POSTGRES_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" -o "-h 127.0.0.1 -p $TEST_PG_PORT -k ''" -w start
ARGS=(-X -w -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$TEST_PG_PORT" -U guard_owner -d postgres)
python3 "$HERE/assemble-baseline.py" "$WORK/baseline.sql"
"$PSQL_BIN" "${ARGS[@]}" -f "$HERE/fixture.sql" -f "$WORK/baseline.sql"
if [[ -n "${ADMISSION_NEGATIVE:-}" ]]; then
 case "$ADMISSION_NEGATIVE" in
 body) echo "CREATE OR REPLACE FUNCTION public.recalc_factura_totales(p_factura_id uuid) RETURNS void LANGUAGE plpgsql SET search_path TO public AS \$\$ BEGIN RETURN; END; \$\$;" > "$WORK/drift.sql" ;;
 *) echo 'Unknown ADMISSION_NEGATIVE' >&2; exit 2 ;;
 esac
 "$PSQL_BIN" "${ARGS[@]}" -f "$WORK/drift.sql"
fi
if [[ "${NEGATIVE_CONTROL:-0}" != 1 ]]; then
 "$PSQL_BIN" "${ARGS[@]}" -f "$ROOT/supabase/migrations/20261013151000_padres_activos_recalculo_tc.sql"
 "$PSQL_BIN" "${ARGS[@]}" -f "$ROOT/supabase/migrations/20261013151000_padres_activos_recalculo_tc.sql"
fi
if [[ -n "${NEGATIVE_SCOPE:-}" ]]; then
 python3 "$HERE/assemble-baseline.py" "$WORK/unpatched.sql" "$NEGATIVE_SCOPE"
 "$PSQL_BIN" "${ARGS[@]}" -f "$WORK/unpatched.sql"
fi
if [[ "${NEGATIVE_CONTROL:-0}" == 1 ]]; then
 "$PSQL_BIN" "${ARGS[@]}" -c "INSERT INTO test_dof VALUES ('2026-10-13',19.25,21.5);"
else
 "$PSQL_BIN" "${ARGS[@]}" -f "$HERE/cases.sql" -f "$ROOT/supabase/tests/padres_activos_recalculo_tc.sql"
fi
python3 "$HERE/concurrency.py"
echo "Disposable directory: $WORK; server stopped by EXIT trap. No full replay/RLS certification."
