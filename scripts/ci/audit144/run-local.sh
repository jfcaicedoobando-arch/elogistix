#!/usr/bin/env bash
set -euo pipefail
S=$(cd "$(dirname "$0")/../../.." && pwd)
: "${PG_SERVER_BIN:?Set PG_SERVER_BIN to a local PostgreSQL 17.9 bin directory}"
: "${PG_CLIENT_BIN:?Set PG_CLIENT_BIN to a local PostgreSQL 17.9 client bin directory}"
ROOT=$(mktemp -d "${TMPDIR:-/tmp}/audit144-reader.XXXXXX")
E=$ROOT/evidence; F=$S/scripts/ci/audit144; mkdir "$E"
SERVER=$PG_SERVER_BIN; PSQL=$PG_CLIENT_BIN/psql
printf 'evidence=%s\n' "$E"
exec 9>/tmp/elogistix-heavy-validation.lock
printf 'requested=%s\n' "$(date -u +%FT%TZ)" > "$E/sql-lock.log"
flock -w 1200 9
printf 'acquired=%s\n' "$(date -u +%FT%TZ)" >> "$E/sql-lock.log"
DATA=$(mktemp -d "$ROOT/owned-pgdata.XXXXXX");started=0
cleanup(){ status=$?;trap - EXIT;set +e; if [ "$started" = 1 ];then "$SERVER/pg_ctl" -D "$DATA" -m fast -w stop > "$E/shutdown.log" 2>&1 || status=99;fi;echo "$status" > "$E/sql.exit";exit "$status"; };trap cleanup EXIT
"$SERVER/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 > "$E/initdb.log" 2>&1
"$SERVER/pg_ctl" -D "$DATA" -l "$E/postgres.log" -w -o "-p 55644 -c cluster_name=audit144_owned_local -c listen_addresses=127.0.0.1 -c unix_socket_directories='' -c shared_buffers=32MB -c work_mem=4MB -c max_connections=8 -c max_parallel_workers=0 -c max_worker_processes=0 -c fsync=off -c full_page_writes=off" start > "$E/startup.log" 2>&1;started=1
p(){ env -i PATH=/usr/bin:/bin PGHOST=127.0.0.1 PGHOSTADDR=127.0.0.1 PGPORT=55644 PGUSER=postgres PGDATABASE=postgres PGSSLMODE=disable PGCONNECT_TIMEOUT=5 PGOPTIONS='-c statement_timeout=30000 -c lock_timeout=5000' "$PSQL" -X -v ON_ERROR_STOP=1 "$@"; }
p -Atc "SELECT inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=55644 AND current_setting('cluster_name')='audit144_owned_local' AND current_setting('data_directory')='$DATA' AND current_setting('unix_socket_directories')='';" > "$E/identity.log"
[ "$(cat "$E/identity.log")" = t ]
BASE=$E/reader49.sql
python3 - "$S" "$BASE" <<'PY_SOURCE'
from pathlib import Path
import re,sys
s=(Path(sys.argv[1])/'supabase/migrations/20261009010000_audit148_cobertura_documental_exacta.sql').read_text()
m=re.search(r'CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque\([\s\S]*?AS (\$\w*\$)[\s\S]*?\1;',s)
assert m
Path(sys.argv[2]).write_text(m[0]+"\nREVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM PUBLIC, anon;\nGRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated, service_role;\n")
PY_SOURCE
for phase in red green; do
 reader=$BASE;[ "$phase" = green ] && reader=$S/supabase/schema/dashboards/pnl_financiero_embarque.sql
 {
 echo 'BEGIN;';echo "\\i $F/fixture.sql";echo "\\i $BASE"
 echo "CREATE TEMP TABLE original_catalog AS SELECT to_jsonb(p)-'prosrc' AS data FROM pg_proc p WHERE oid='public.pnl_financiero_embarque(uuid)'::regprocedure;"
 if [ "$phase" = green ];then
  echo "\\i $S/supabase/migrations/20261009033000_audit144_pnl_linaje_selectivo.sql"
  echo "\\i $S/supabase/migrations/20261009033000_audit144_pnl_linaje_selectivo.sql"
 else echo "\\i $reader";fi
 echo "SELECT pg_temp.assert((SELECT data FROM original_catalog)=(SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE oid='public.pnl_financiero_embarque(uuid)'::regprocedure),'Only body changed');"
 echo "\\i $F/cases.sql"
 echo "\\copy (SELECT jsonb_agg(to_jsonb(r) ORDER BY label) FROM results144 r) TO '$E/results-$phase.json'"
 if [ "$phase" = green ];then echo 'COMMIT;';else echo 'ROLLBACK;';fi
 } > "$E/$phase.sql"
 set +e;p -f "$E/$phase.sql" > "$E/$phase.log" 2>&1;status=$?;set -e;echo "$status" > "$E/$phase.exit"
 if [ "$phase" = red ];then [ "$status" != 0 ] && grep -q 'selective A only: sale' "$E/red.log";else [ "$status" = 0 ] || { tail -18 "$E/green.log" | cut -c1-800;exit "$status"; };fi
 done
env -i PATH=/usr/bin:/bin PGHOST=127.0.0.1 PGHOSTADDR=127.0.0.1 PGPORT=55644 PGUSER=postgres PGDATABASE=postgres PGSSLMODE=disable "$PG_CLIENT_BIN/pg_dump" --schema-only --schema=public --no-owner --no-comments --no-tablespaces --no-security-labels > "$E/minimal-native-dump.sql"
sed -E -e '/^--/d' -e '/^SET /d' -e '/^SELECT pg_catalog\.set_config/d' -e '/^ALTER .* OWNER TO /d' -e '/^\\(un)?restrict /d' -e '/^[[:space:]]*$/d' "$E/minimal-native-dump.sql" > "$E/minimal-normalized-dump.sql"
# An autocommit invocation must refuse before touching the post-body/catalog.
p -Atc "SELECT to_jsonb(p) FROM pg_proc p WHERE oid='public.pnl_financiero_embarque(uuid)'::regprocedure;" > "$E/autocommit-before.json"
set +e;p -f "$S/supabase/migrations/20261009033000_audit144_pnl_linaje_selectivo.sql" > "$E/autocommit.log" 2>&1;refused=$?;set -e
[ "$refused" != 0 ] && grep -q 'SAVEPOINT can only be used in transaction blocks' "$E/autocommit.log"
p -Atc "SELECT to_jsonb(p) FROM pg_proc p WHERE oid='public.pnl_financiero_embarque(uuid)'::regprocedure;" > "$E/autocommit-after.json"
cmp "$E/autocommit-before.json" "$E/autocommit-after.json"
printf 'PASS144=%s\n' "$(grep -c 'NOTICE:  PASS144:' "$E/green.log")"
