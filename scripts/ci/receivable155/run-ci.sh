#!/usr/bin/env bash
set -euo pipefail
# Only the disposable Actions PostgreSQL service, before schema bootstrap.
[[ ${CI:-} == true && ${GITHUB_ACTIONS:-} == true && ${ISOLATED_QA_DB:-} == 1 ]]
[[ ${PGHOST:-} == localhost || ${PGHOST:-} == 127.0.0.1 ]]
[[ ${PGPORT:-5432} == 5432 && ${PGUSER:-} == postgres && ${PGDATABASE:-} == postgres ]]
for key in DATABASE_URL SUPABASE_DB_URL PGHOSTADDR PGSERVICE PGSERVICEFILE;do
  [[ -z ${!key:-} ]] || { echo "Refusing connection override: $key" >&2;exit 1; }
done
export PGCONNECT_TIMEOUT=5
S=$(cd "$(dirname "$0")/../../.." && pwd); F=$S/scripts/ci/receivable155
E=$S/.receivable155-logs; mkdir -p "$E"
DB=pnl_receivable155_ci_$$; created=0
cleanup(){ status=$?;trap - EXIT;set +e;if [[ $created == 1 ]];then PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -c "DROP DATABASE $DB" > "$E/cleanup.log" 2>&1 || status=99;fi;exit "$status"; };trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB" > "$E/create.log";created=1
export PGDATABASE=$DB PGAPPNAME=receivable155_disposable_ci
python3 - "$S" "$E" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]);e=Path(sys.argv[2]);src=(s/'supabase/migrations/20261009033000_audit144_pnl_linaje_selectivo.sql').read_text()
m=re.search(r'CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque\([\s\S]*?AS (\$\w*\$)[\s\S]*?\1;',src);assert m
reader=m[0]
(e/'reader144.sql').write_text(reader+'\nREVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM PUBLIC, anon;\nGRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated, service_role;\n')
(e/'reader-before.sql').write_text(reader.replace('CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque','CREATE OR REPLACE FUNCTION pg_temp.reader_before155'))
PY
for phase in red green;do
 { echo 'BEGIN;';echo "\\i $F/fixture.sql";echo "\\i $E/reader144.sql";echo "\\i $E/reader-before.sql"
 if [[ $phase == green ]];then
  echo "\\i $S/supabase/migrations/20261009152000_pnl_pendiente_linaje_fiscal.sql"
  echo "\\i $S/supabase/migrations/20261009152000_pnl_pendiente_linaje_fiscal.sql"
 fi
 echo "\\i $F/cases.sql";echo "\\copy (SELECT jsonb_agg(to_jsonb(r) ORDER BY label,shipment) FROM results155 r) TO '$E/results-$phase.json'";echo 'ROLLBACK;'
 } > "$E/$phase.sql"
 set +e;psql -X -v ON_ERROR_STOP=1 -f "$E/$phase.sql" > "$E/$phase.log" 2>&1;code=$?;set -e
 if [[ $phase == red ]];then [[ $code != 0 ]] && grep -q 'GUI A100 B300 NC100 selective A: pending expected 0 got 75' "$E/red.log"
 else [[ $code == 0 ]] || { tail -30 "$E/green.log";exit "$code"; };fi
 done
printf 'PASS155=%s\n' "$(grep -c 'NOTICE:  PASS155:' "$E/green.log")"
