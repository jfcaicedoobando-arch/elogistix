#!/usr/bin/env bash
# No host execution or external connection options. Invoked only by run-ci.sh.
set -euo pipefail
umask 077
[[ $# == 1 && "${PRICING_AUTH_ISOLATED_CONTAINER:-}" == 1 ]] || exit 64
ARM=$1
[[ "$ARM" == baseline || "$ARM" == candidate ]] || exit 64
PLAN=/candidate
NATIVE=/usr/lib/postgresql/17
PSQL="$NATIVE/bin/psql"
EVIDENCE=/tmp/replay-evidence
mkdir "$EVIDENCE"
RUN=$(mktemp -d /tmp/pricing-crm.XXXXXXXX)
TOKEN=$(basename -- "$RUN")
printf '%s\n' "$TOKEN" > "$RUN/.owned-by-this-replay"
PGDATA="$RUN/data"
clean() { env -i PATH=/usr/bin:/bin HOME="$RUN" LANG=C LC_ALL=C "$@"; }
cleanup() {
  code=$?
  trap - EXIT INT TERM
  stopped=true
  disposed=false
  if [[ -f "$PGDATA/postmaster.pid" ]]; then
    clean "$NATIVE/bin/pg_ctl" -D "$PGDATA" -m fast -w -t 30 stop >>"$RUN/server.log" 2>&1 || stopped=false
  fi
  for f in initdb.log server.log load.log migration.log assertions.log final-acl.log; do
    if [[ -f "$RUN/$f" ]]; then cp -- "$RUN/$f" "$EVIDENCE/$f" || code=70; fi
  done
  if [[ "$stopped" == true && "$RUN" == /tmp/pricing-crm.* && ! -L "$RUN" && -f "$RUN/.owned-by-this-replay" && "$(cat "$RUN/.owned-by-this-replay")" == "$TOKEN" ]]; then
    if rm -rf --one-file-system -- "$RUN" && [[ ! -e "$RUN" ]]; then disposed=true; else code=70; fi
  else
    code=70
  fi
  printf 'exit_code=%s\ncluster_disposed=%s\n' "$code" "$disposed" > "$EVIDENCE/status.txt"
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
(cd /bundle && sha256sum --strict --check "$PLAN/frozen-SHA256SUMS") > "$EVIDENCE/frozen-hashes.log" 2>&1
(cd "$PLAN" && sha256sum --strict --check SHA256SUMS) > "$EVIDENCE/candidate-hashes.log" 2>&1
(cd /overlay && sha256sum --strict --check SHA256SUMS) > "$EVIDENCE/overlay-hashes.log" 2>&1
clean "$PSQL" --version > "$EVIDENCE/postgres-version.txt"
grep -Eq '^psql \(PostgreSQL\) 17\.' "$EVIDENCE/postgres-version.txt"
mkdir "$RUN/socket"
clean "$NATIVE/bin/initdb" -D "$PGDATA" -U replay_bootstrap --no-locale -E UTF8 --auth-local=trust --auth-host=reject > "$RUN/initdb.log" 2>&1
clean "$NATIVE/bin/pg_ctl" -D "$PGDATA" -o "-c listen_addresses='' -c unix_socket_directories='$RUN/socket' -c unix_socket_permissions=0700" -l "$RUN/server.log" -w -t 30 start
clean "$PSQL" -X --no-password -h "$RUN/socket" -p 5432 -U replay_bootstrap -d postgres -v ON_ERROR_STOP=1 -At -c "SELECT current_setting('server_version_num'); SELECT version();" > "$EVIDENCE/postgres-server-version.txt" 2> "$EVIDENCE/server-version.log"
grep -Eq '^17[0-9]{4}$' "$EVIDENCE/postgres-server-version.txt"
sql() { clean "$PSQL" -X --no-password -h "$RUN/socket" -p 5432 -U replay_bootstrap -d postgres -v ON_ERROR_STOP=1 -f "$1"; }
# Each psql call is a fresh session. A baseline abort is never reused.
sql "$PLAN/load.sql" > "$RUN/load.log" 2>&1
printf '0\n' > "$EVIDENCE/load-exit.txt"
if [[ "$ARM" == candidate ]]; then
  # The hash-bound fixture owns BEGIN/COMMIT; it runs before assertion fixture DML.
  set +e
  sql "$PLAN/candidate-migration.sql" > "$RUN/migration.log" 2>&1
  migration_code=$?
  set -e
  printf '%s\n' "$migration_code" > "$EVIDENCE/migration-exit.txt"
  [[ "$migration_code" == 0 ]] || exit "$migration_code"
fi
set +e
sql "/overlay/$ARM-assertions.sql" > "$RUN/assertions.log" 2>&1
assertion_code=$?
set -e
printf '%s\n' "$assertion_code" > "$EVIDENCE/assertion-exit.txt"
if [[ "$ARM" == baseline || "$assertion_code" != 0 ]]; then exit "$assertion_code"; fi
# Literal extraction of the original final ACL checks, in a new session.
sql "$PLAN/final-acl.sql" > "$RUN/final-acl.log" 2>&1
printf '0\n' > "$EVIDENCE/final-acl-exit.txt"
