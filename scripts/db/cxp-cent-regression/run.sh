#!/usr/bin/env bash
set -euo pipefail
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=${REPO_ROOT:-$(cd "$HERE/../../.." && pwd)}
PG_BIN=${PG_BIN:-$(dirname "$(command -v pg_ctl || command -v initdb || printf '/usr/lib/postgresql/17/bin/pg_ctl')")}
PSQL_BIN=${PSQL_BIN:-$(command -v psql || printf '%s/psql' "$PG_BIN")}
if [[ -n ${PG_LIB:-} ]]; then export LD_LIBRARY_PATH="$PG_LIB${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"; fi
PORT=${PGPORT:-55458}
# Do not let inherited libpq service/hostaddr/options redirect a localhost test.
unset PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGDATABASE PGUSER PGPASSWORD PGPASSFILE PGOPTIONS PGSSLMODE PGSSLROOTCERT PGSSLCERT PGSSLKEY PGTARGETSESSIONATTRS PGLOADBALANCEHOSTS PGCHANNELBINDING
export PGHOSTADDR=127.0.0.1 PGCONNECT_TIMEOUT=5 PGSSLMODE=disable
[[ $PORT =~ ^[0-9]+$ ]] || { echo 'PGPORT must be a numeric local port' >&2; exit 1; }
for binary in "$PG_BIN/initdb" "$PG_BIN/pg_ctl" "$PSQL_BIN"; do
 [[ -x $binary ]] || { echo "Missing executable: $binary" >&2; exit 1; }
done
OUT_DIR=${OUT_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/cxp-cent-results.XXXXXX")}
mkdir -p "$OUT_DIR"; OUT_DIR=$(cd "$OUT_DIR" && pwd)
CLUSTER=$(mktemp -d "${TMPDIR:-/tmp}/cxp-cent-postgres.XXXXXX")
STARTED=0
cleanup() {
 if [[ $STARTED == 1 ]]; then "$PG_BIN/pg_ctl" -D "$CLUSTER/data" -m fast -w stop >> "$OUT_DIR/postgres-control.log" 2>&1 || true; fi
 rm -rf -- "$CLUSTER"
}
trap cleanup EXIT
"$PG_BIN/initdb" -D "$CLUSTER/data" -U postgres --no-locale -E UTF8 --auth=trust > "$OUT_DIR/initdb.log" 2>&1
"$PG_BIN/pg_ctl" -D "$CLUSTER/data" -o "-p $PORT -h 127.0.0.1 -k ''" -l "$OUT_DIR/postgres.log" -w start > "$OUT_DIR/postgres-control.log" 2>&1
STARTED=1
psql_args=(-X -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1)
"$PSQL_BIN" "${psql_args[@]}" \
 -v candidate_recalc="$REPO_ROOT/supabase/schema/cxp/_recalc_estado_proveedor_factura.sql" \
 -v candidate_cierre="$REPO_ROOT/supabase/schema/embarques/validar_cierre_embarque.sql" \
 -v results_path="$OUT_DIR/results.csv" \
 -f "$HERE/load.sql" -f "$HERE/compare.sql" > "$OUT_DIR/regression.log" 2>&1
"$PSQL_BIN" "${psql_args[@]}" \
 -v candidate_migration="$REPO_ROOT/supabase/migrations/20261009174000_cxp_centavo_sin_cobertura.sql" \
 -v metadata_path="$OUT_DIR/migration-metadata.csv" \
 -f "$HERE/migration-check.sql" > "$OUT_DIR/migration-check.log" 2>&1
# These expected failures are intentional rollback tests; absence is a failure.
grep -q 'ERROR:  CXPCENT_PRECONDITION:' "$OUT_DIR/migration-check.log"
grep -q 'ERROR:  CXPCENT_METADATA:' "$OUT_DIR/migration-check.log"
grep -q 'MIGRATION_INSTALL_NO_DML_METADATA_PASS; REAPPLY_SOURCE_DRIFT_ROLLBACK_PASS; ACL_DRIFT_ROLLBACK_PASS' "$OUT_DIR/migration-check.log"
grep -q 'SQUASH_INSTALL_NO_DML_METADATA_PASS; UNKNOWN_SOURCE_ROLLBACK_PASS' "$OUT_DIR/migration-check.log"
printf 'CxP matrix and migration transaction checks passed. Results: %s\n' "$OUT_DIR"
