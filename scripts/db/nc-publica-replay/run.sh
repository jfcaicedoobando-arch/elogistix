#!/usr/bin/env bash
# Fresh local PostgreSQL 17.9 only; no inherited database endpoint or credentials.
set -euo pipefail
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$HERE/../../.." && pwd)
AUD_NC_PG_BIN=${PG_BIN:-}
AUD_NC_PG_LIB=${PG_LIB:-}
SOURCE_ROOT=${NC_REPLAY_SOURCE_ROOT:-$REPO_ROOT}
CANDIDATE_ROOT=${NC_REPLAY_CANDIDATE_ROOT:-$REPO_ROOT}
PORT=${NC_REPLAY_PORT:-$((40000 + RANDOM % 20000))}
OUT_REQUEST=${NC_REPLAY_OUT_DIR:-}
NODE_BIN=$(command -v node) || { echo 'Node is required; no dependencies will be installed.' >&2; exit 1; }
for variable in ${!PG@}; do unset "$variable"; done
# No inherited libpq variables survive. Each child additionally receives env -i.
[[ $PORT =~ ^[0-9]+$ && $PORT -ge 1024 && $PORT -le 65535 ]] || { echo 'NC_REPLAY_PORT must be a numeric unprivileged local port.' >&2; exit 1; }
if [[ -z $AUD_NC_PG_BIN ]]; then
  INITDB_ON_PATH=$(command -v initdb) || { echo 'PostgreSQL 17.9 is unavailable; no connection attempted.' >&2; exit 1; }
  AUD_NC_PG_BIN=$(dirname -- "$INITDB_ON_PATH")
fi
AUD_NC_PG_BIN=$(cd -- "$AUD_NC_PG_BIN" && pwd)
BASE_ENV=(env -i "PATH=$AUD_NC_PG_BIN:/usr/bin:/bin" LANG=C LC_ALL=C)
if [[ -n $AUD_NC_PG_LIB ]]; then BASE_ENV+=("LD_LIBRARY_PATH=$AUD_NC_PG_LIB"); fi
VERSIONS=''
for name in initdb pg_ctl postgres psql; do
  binary="$AUD_NC_PG_BIN/$name"
  [[ -x $binary ]] || { echo "Missing PostgreSQL executable: $name; no connection attempted." >&2; exit 1; }
  version=$("${BASE_ENV[@]}" "$binary" --version)
  [[ $version =~ ^[[:alnum:]_]+[[:space:]]+\(PostgreSQL\)[[:space:]]+17\.9([[:space:]]|$) ]] || { echo "Rejected runtime: $version; expected PostgreSQL 17.9, no connection attempted." >&2; exit 1; }
  VERSIONS+="$version"$'\n'
done
if [[ -n $OUT_REQUEST ]]; then
  mkdir -- "$OUT_REQUEST" || { echo 'Evidence directory must not already exist.' >&2; exit 1; }
  OUT_DIR=$(cd -- "$OUT_REQUEST" && pwd)
else
  OUT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/nc-publica-replay-evidence.XXXXXX")
fi
PREPARED=$("${BASE_ENV[@]}" "$NODE_BIN" "$HERE/prepare.mjs" --source-root "$SOURCE_ROOT" --candidate-root "$CANDIDATE_ROOT" --out "$OUT_DIR")
printf '%s\n' "$PREPARED" > "$OUT_DIR/prepare.log"
printf '%s' "$VERSIONS" > "$OUT_DIR/runtime-versions.txt"
: > "$OUT_DIR/empty.pgpass"
: > "$OUT_DIR/empty.pgservice"
chmod 600 "$OUT_DIR/empty.pgpass" "$OUT_DIR/empty.pgservice"
CLUSTER=$(mktemp -d "$OUT_DIR/cluster.XXXXXX")
STARTED=0
cleanup() {
  AUD_NC_EXIT_CODE=$?
  trap - EXIT
  if [[ $STARTED == 1 ]]; then
    if ! "${BASE_ENV[@]}" "$AUD_NC_PG_BIN/pg_ctl" -D "$CLUSTER/data" -m fast -w stop >> "$OUT_DIR/postgres-control.log" 2>&1; then
      printf 'Disposable cluster shutdown was not confirmed: %s. Inspect postgres-control.log.\n' "$CLUSTER/data" >&2
      exit 1
    fi
  fi
  exit "$AUD_NC_EXIT_CODE"
}
trap cleanup EXIT
"${BASE_ENV[@]}" "$AUD_NC_PG_BIN/initdb" -D "$CLUSTER/data" -U postgres --no-locale -E UTF8 --auth=trust > "$OUT_DIR/initdb.log" 2>&1
printf "\nlisten_addresses = '127.0.0.1'\nport = %s\nunix_socket_directories = ''\n" "$PORT" >> "$CLUSTER/data/postgresql.conf"
# Also attempt shutdown if pg_ctl times out after starting its own process.
STARTED=1
"${BASE_ENV[@]}" "$AUD_NC_PG_BIN/pg_ctl" -D "$CLUSTER/data" -l "$OUT_DIR/postgres.log" -w start > "$OUT_DIR/postgres-control.log" 2>&1
# The first connection occurs only after this script's new cluster started.
# A used port causes startup failure; there is no fallback to an existing server.
PG_ENV=("${BASE_ENV[@]}" PGHOST=127.0.0.1 PGHOSTADDR=127.0.0.1 "PGPORT=$PORT" PGUSER=postgres PGDATABASE=postgres PGSSLMODE=disable PGCONNECT_TIMEOUT=5 "PGPASSFILE=$OUT_DIR/empty.pgpass" "PGSERVICEFILE=$OUT_DIR/empty.pgservice" "PGSYSCONFDIR=$OUT_DIR" PGOPTIONS=)
"${PG_ENV[@]}" "$AUD_NC_PG_BIN/psql" -X -w --single-transaction -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v results_path="$OUT_DIR/results.csv" -v metadata_path="$OUT_DIR/metadata.csv" -v summary_path="$OUT_DIR/summary.json" \
  -f "$OUT_DIR/driver.sql" > "$OUT_DIR/matrix.log" 2>&1
grep -q 'NC_PUBLICA_REPLAY_MATRIX_PASS' "$OUT_DIR/matrix.log"
printf 'Local matrix and metadata checks passed. Evidence: %s\n' "$OUT_DIR"
# After confirmed shutdown the cluster is retained under OUT_DIR for inspection. No recursive
# deletion, package install, hosted SQL, Docker, or existing database is used.
