#!/usr/bin/env bash
# Starts a new local-only database; never consumes a project connection URL.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INITDB="${INITDB_BIN:-initdb}"
PG_CTL="${PG_CTL_BIN:-pg_ctl}"
PSQL="${PSQL_BIN:-psql}"
PORT="${TEST_PG_PORT:-55465}"
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65535 )) || exit 2
unset PGHOST PGHOSTADDR PGPORT PGDATABASE PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE PGOPTIONS
WORK="$(mktemp -d "${TMPDIR:-/tmp}/cot-special-pg.XXXXXX")"
cleanup() {
  if [[ -f "$WORK/data/postmaster.pid" ]]; then "$PG_CTL" -D "$WORK/data" -m immediate -w stop; fi
}
trap cleanup EXIT
"$INITDB" -D "$WORK/data" -A trust -U postgres > "$WORK/init.log"
"$PG_CTL" -D "$WORK/data" -l "$WORK/server.log" -o "-k '' -p $PORT -c listen_addresses='127.0.0.1'" -w start
"$PSQL" -X -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$ROOT/scripts/tests/fixtures/cotizacion-special-permissions.sql" | tee "$WORK/results.log"
printf 'Evidence: %s\n' "$WORK/results.log"
