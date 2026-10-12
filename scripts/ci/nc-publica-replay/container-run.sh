#!/usr/bin/env bash
# Invoked only by the host orchestrator in its newly created --network=none image.
set -euo pipefail
MODE=${1:-}
[[ $# == 1 && ( $MODE == minimal || $MODE == full ) ]] || exit 2
[[ $(id -un) == postgres && -d /repo && -d /evidence && ! -L /evidence ]] || { echo 'Wrong container boundary' >&2; exit 1; }
NC_CONTAINER_UID=$(id -u)
PG_BIN=/usr/lib/postgresql/17/bin
PORT=5432
WORK=$(mktemp -d /tmp/nc-publica-review.XXXXXX)
DATA=''
WORK_REPO=''
make_evidence_readable() {
  # The host requires a fresh evidence directory for this exact container.
  # Only this UID's new regular artifacts gain read/traverse bits. Never follow
  # symlinks, cross mounts, chmod the bind root or touch runner-owned files.
  NC_PERMISSIONS_STATUS=0
  if ! find -P /evidence -xdev -mindepth 1 -uid "$NC_CONTAINER_UID" -type d \
    -exec chmod a+rx -- {} +; then
    NC_PERMISSIONS_STATUS=1
  fi
  if ! find -P /evidence -xdev -mindepth 1 -uid "$NC_CONTAINER_UID" -type f \
    -exec chmod a+r -- {} +; then
    NC_PERMISSIONS_STATUS=1
  fi
  if [[ $NC_PERMISSIONS_STATUS != 0 ]]; then
    echo 'Container evidence readability was not confirmed' >&2
  fi
  return "$NC_PERMISSIONS_STATUS"
}
cleanup() {
  NC_EXIT_CODE=$?
  trap - EXIT
  if [[ -n $DATA && -f $DATA/postmaster.pid ]]; then
    if ! "$PG_BIN/pg_ctl" -D "$DATA" -m fast -w stop >> /evidence/postgres-control.log 2>&1; then
      echo 'Disposable PostgreSQL shutdown was not confirmed' >&2
      if [[ $NC_EXIT_CODE == 0 ]]; then NC_EXIT_CODE=1; fi
    fi
  fi
  if [[ -n $WORK_REPO ]]; then
    if mkdir -p /evidence/local-verify-logs; then
      shopt -s nullglob
      for log in "$WORK_REPO"/.db-verify-logs/[0-9]*-*; do
        if [[ -d $log && ! -L $log ]]; then
          if ! cp -R -- "$log" /evidence/local-verify-logs/; then
            echo 'Disposable replay log copy was not confirmed' >&2
            if [[ $NC_EXIT_CODE == 0 ]]; then NC_EXIT_CODE=1; fi
          fi
        fi
      done
    else
      echo 'Disposable replay log directory was not created' >&2
      if [[ $NC_EXIT_CODE == 0 ]]; then NC_EXIT_CODE=1; fi
    fi
  fi
  # Run after shutdown and log copy on every EXIT, including SQL/copy errors.
  # Preserve the failing status; readability failure also prevents a green run.
  if ! make_evidence_readable && [[ $NC_EXIT_CODE == 0 ]]; then NC_EXIT_CODE=1; fi
  exit "$NC_EXIT_CODE"
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

: > /evidence/runtime-versions.txt
for name in initdb pg_ctl postgres psql pg_dump; do
  version=$("$PG_BIN/$name" --version)
  [[ $version =~ ^[[:alnum:]_]+[[:space:]]+\(PostgreSQL\)[[:space:]]+17\.9([[:space:]]|$) ]] || { echo "Wrong runtime: $version" >&2; exit 1; }
  printf '%s\n' "$version" >> /evidence/runtime-versions.txt
done
: > "$WORK/empty.pgpass"
chmod 600 "$WORK/empty.pgpass"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres PGSSLMODE=disable PGCONNECT_TIMEOUT=5 PGPASSFILE="$WORK/empty.pgpass" PGSYSCONFDIR="$WORK"
# No image entrypoint/server was run, inherited credentials were stripped by env -i,
# no external network/ports exist, and the data directory is unique to this container.
if [[ $MODE == minimal ]]; then
  [[ -r /prepared/driver.sql && -r /prepared/source-hashes.json ]] || exit 1
  DATA="$WORK/pgdata"
  "$PG_BIN/initdb" -D "$DATA" -U postgres --no-locale -E UTF8 --auth=trust > /evidence/initdb.log 2>&1
  printf "\nlisten_addresses = '127.0.0.1'\nport = %s\nunix_socket_directories = ''\n" "$PORT" >> "$DATA/postgresql.conf"
  "$PG_BIN/pg_ctl" -D "$DATA" -l /evidence/postgres.log -w start > /evidence/postgres-control.log 2>&1
  "$PG_BIN/psql" -X -w --single-transaction -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v results_path=/evidence/results.csv -v metadata_path=/evidence/metadata.csv -v summary_path=/evidence/summary.json \
    -f /prepared/driver.sql > /evidence/matrix.log 2>&1
  grep -q 'NC_PUBLICA_REPLAY_MATRIX_PASS' /evidence/matrix.log
  printf '%s\n' 'Minimal real-SQL before/after matrix and metadata passed.'
else
  # Writable synthetic copy for the official flow's logs/data directory only.
  # The reviewed checkout mount remains read-only; no host baseline is modified.
  WORK_REPO="$WORK/repo"
  mkdir "$WORK_REPO"
  cp -R /repo/. "$WORK_REPO/"
  cd "$WORK_REPO"
  DATA="$WORK_REPO/.db-verify-logs/pgdata-$PORT"
  # Official source of bootstrap + squash inventory + ordered replay + ACL check,
  # post-migrate, RLS coverage, integrity and normalized golden snapshot.
  # --only-schema guarantees no behavioral/RLS fixtures before the snapshot.
  bash scripts/db/local-verify.sh --backend local --only-schema --keep --port "$PORT" \
    --snapshot-pre /evidence/schema.pre-ci-post-migrate.sql \
    --snapshot /evidence/baseline.generated.sql > /evidence/full-replay.log 2>&1
  [[ -s /evidence/baseline.generated.sql ]] || { echo 'Official dump missing' >&2; exit 1; }
  "$PG_BIN/psql" -X -w -A -t -v ON_ERROR_STOP=1 -c "SELECT current_setting('server_version_num')='170009' AND inet_server_addr()='127.0.0.1'::inet" | grep -qx t
  "$PG_BIN/psql" -X -w -v ON_ERROR_STOP=1 -c "COPY (SELECT p.proname, p.oid, pg_get_userbyid(p.proowner) AS owner, p.proacl::text AS acl, p.proconfig::text AS config, p.provolatile, p.prosecdef, encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS definition_sha256 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('_nc_aplicadas_moneda_factura','nc_aplicadas_en_moneda_factura','_saldo_factura_calc') ORDER BY p.proname) TO '/evidence/catalog.after-ci-post-migrate.csv' WITH(FORMAT csv,HEADER)"
  BASELINE_STATUS=0
  diff -u supabase/schema/baseline.sql /evidence/baseline.generated.sql > /evidence/baseline.diff || BASELINE_STATUS=$?
  [[ $BASELINE_STATUS -le 1 ]] || { echo 'Baseline comparison failed' >&2; exit 1; }
  # The generated snapshot already exists. Continue collecting real guard/RLS
  # evidence even on expected baseline drift, but never return green for drift.
  GUARD_STATUS=0
  RLS_STATUS=0
  JOBS=1 LOG_DIR=/evidence/guards bash scripts/ci/run-guards.sh > /evidence/guards.log 2>&1 || GUARD_STATUS=$?
  LOG_DIR=/evidence/rls bash scripts/ci/run-rls-suites.sh > /evidence/rls.log 2>&1 || RLS_STATUS=$?
  printf '{"baselineDiffExit":%s,"guardsExit":%s,"rlsExit":%s,"snapshotBeforeFixtures":true,"baselineWrittenToRepository":false}\n' \
    "$BASELINE_STATUS" "$GUARD_STATUS" "$RLS_STATUS" > /evidence/full-summary.json
  [[ $BASELINE_STATUS == 0 && $GUARD_STATUS == 0 && $RLS_STATUS == 0 ]] || { echo 'Full review failed; inspect generated baseline/diff/guard/RLS evidence' >&2; exit 1; }
  printf '%s\n' 'Official full replay, generated baseline parity, guards and RLS passed.'
fi
