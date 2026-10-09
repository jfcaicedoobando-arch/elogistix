#!/usr/bin/env bash
# Disposable PostgreSQL 17 contract harness. Never accepts DATABASE_URL.
set -euo pipefail
# Ignore inherited libpq routing and credentials; this harness owns its endpoint.
AUD147_PG_BIN=${PG_BIN:-}
for var in ${!PG@}; do unset "$var"; done
export PGHOSTADDR=127.0.0.1
SOURCE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$SOURCE/../../.." && pwd)
PG_BIN=${AUD147_PG_BIN:-}
client() { if [[ -n "$PG_BIN" ]]; then printf '%s/%s' "$PG_BIN" "$1"; else command -v "$1"; fi; }
INITDB=$(client initdb); PG_CTL=$(client pg_ctl); PSQL=$(client psql)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/audit147-comparator.XXXXXX")
PORT=${AUD147_PG_PORT:-36747}
cleanup() { "$PG_CTL" -D "$WORK/pgdata" -m fast -w stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
cp "$SOURCE/"*.sql "$WORK/"
mkdir -p "$WORK/supabase/migrations"
cp "$ROOT/supabase/migrations/20261009192000_audit147_comparador_moneda_tramo.sql" "$WORK/supabase/migrations/"
"$INITDB" -D "$WORK/pgdata" --no-locale -E UTF8 --auth=trust > "$WORK/initdb.log" 2>&1
"$PG_CTL" -D "$WORK/pgdata" -o "-p $PORT -h 127.0.0.1 -k ''" -l "$WORK/postgres.log" -w start
cd "$WORK"
"$PSQL" -X -h 127.0.0.1 -p "$PORT" -d postgres -v ON_ERROR_STOP=1 -f setup.sql -f setup-code.sql -f matrix.sql
printf 'Disposable evidence retained at %s\n' "$WORK"
