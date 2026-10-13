#!/usr/bin/env bash
# Owns a brand-new disposable cluster. Never accepts an existing database URL.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
if [[ -n "${DATABASE_URL:-}${SUPABASE_DB_URL:-}${PGHOSTADDR:-}${PGSERVICE:-}${PGSERVICEFILE:-}" ]]; then
  echo 'Refusing inherited remote/service connection configuration' >&2
  exit 1
fi
if [[ -n "${PG_BIN:-}" ]]; then export PATH="$PG_BIN:$PATH"; fi
for executable in initdb pg_ctl psql pg_dump python3; do command -v "$executable" >/dev/null; done
REPORTS="${GLOBAL_CATALOG_REPORTS:-$ROOT/reports/global-catalog-permissions}"
mkdir -p "$REPORTS"
DATA="$(mktemp -d)"
export PGHOST=127.0.0.1 PGPORT="${GLOBAL_CATALOG_TEST_PORT:-55875}" PGUSER=postgres PGDATABASE=postgres
unset PGOPTIONS PGPASSWORD
export GLOBAL_CATALOG_OWNED_CLUSTER=1
initdb -D "$DATA" -U postgres -A trust --no-locale --encoding=UTF8 > "$REPORTS/initdb.log"
cleanup() { pg_ctl -D "$DATA" -m fast -w stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
pg_ctl -D "$DATA" -l "$REPORTS/postgres.log" -o "-h 127.0.0.1 -p $PGPORT -k ''" -w start
cd "$ROOT"
psql -X -qAt -c 'SELECT version()' > "$REPORTS/server-version.txt"
bash scripts/ci/rls-prepare-db.sh > "$REPORTS/replay.log" 2>&1
psql -v ON_ERROR_STOP=1 -X -q -f supabase/tests/rls/_ci_check_service_role_only.sql > "$REPORTS/service-role-only.log" 2>&1
psql -v ON_ERROR_STOP=1 -X -q -f supabase/tests/rls/_ci_post_migrate.sql > "$REPORTS/post-migrate.log" 2>&1
bash scripts/db/schema-snapshot.sh "$REPORTS/schema.actual.sql"
diff -u supabase/schema/baseline.sql "$REPORTS/schema.actual.sql" > "$REPORTS/baseline.diff"
python3 scripts/db/global-catalog-permissions/test-negative.py > "$REPORTS/negative-results.json"
LOG_DIR="$REPORTS/guards" bash scripts/ci/run-guards.sh > "$REPORTS/guards.log" 2>&1
LOG_DIR="$REPORTS/rls" bash scripts/ci/run-rls-suites.sh > "$REPORTS/rls.log" 2>&1
printf 'PASS: ordered replay, baseline, mutation controls, all guards and RLS suites.\n'
