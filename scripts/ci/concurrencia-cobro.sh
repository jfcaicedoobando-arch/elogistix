#!/usr/bin/env bash
# Two genuine RPC sessions, held until B is actually blocked on A's lock.
# Fixture persists only inside the disposable Actions Postgres container.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${ISOLATED_QA_DB:-}" == 1 && "${PGHOST:-}" == localhost && -z "${SUPABASE_DB_URL:-}" ]] || {
  echo 'Refusing: requires the isolated Actions Postgres service.' >&2; exit 1;
}
psql_run() { psql -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }
logs=$(mktemp -d)
cleanup() {
  psql_run -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name IN ('qa_cobro_a','qa_cobro_b'); DROP TABLE IF EXISTS public.qa_cobro_barrera;" >/dev/null 2>&1 || true
  # Financial fixtures are not physically deleted; the service container is destroyed.
}
trap cleanup EXIT
psql_run -f scripts/ci/fixtures/cobro-concurrente.sql
rpc_sql="SELECT public.registrar_pago_factura_atomico('a0100000-0000-4000-8000-000000000004', public.fecha_negocio_mx(), 100, 'MXN', 1, 100, '03', 'QA-CONC-SPEI', '', 0, 'a0100000-0000-4000-8000-000000000006', 'a0100000-0000-4000-8000-000000000007');"
claims="SELECT set_config('request.jwt.claims', '{\"sub\":\"a0100000-0000-4000-8000-000000000002\",\"role\":\"authenticated\"}', true); SET LOCAL ROLE authenticated;"
(psql_run > "$logs/a.log" 2>&1 <<SQL
SET application_name='qa_cobro_a';
BEGIN;
$claims
$rpc_sql
RESET ROLE;
DO \$barrier\$
DECLARE started timestamptz := clock_timestamp();
BEGIN
  LOOP
    EXIT WHEN EXISTS (SELECT 1 FROM public.qa_cobro_barrera WHERE id='go');
    IF clock_timestamp()-started > interval '60 seconds' THEN RAISE EXCEPTION 'QA_BARRIER_TIMEOUT'; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
END \$barrier\$;
COMMIT;
SQL
) &
pid_a=$!
wait_for() {
  local query="$1"
  for _ in $(seq 1 200); do
    [[ "$(psql_run -c "$query")" == t ]] && return 0
    sleep 0.1
  done
  echo 'FAILED: bounded concurrency barrier was not reached.' >&2
  cat "$logs"/*.log
  return 1
}
wait_for "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='qa_cobro_a' AND wait_event='PgSleep');"
(psql_run > "$logs/b.log" 2>&1 <<SQL
SET application_name='qa_cobro_b';
BEGIN;
SET LOCAL statement_timeout='60s';
$claims
$rpc_sql
COMMIT;
SQL
) &
pid_b=$!
wait_for "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='qa_cobro_b' AND wait_event_type='Lock');"
psql_run -c "INSERT INTO public.qa_cobro_barrera VALUES ('go');"
rc_a=0; wait "$pid_a" || rc_a=$?
rc_b=0; wait "$pid_b" || rc_b=$?
cat "$logs/a.log" "$logs/b.log"
[[ "$rc_a" == 0 && "$rc_b" == 0 ]] || exit 1
result=$(psql_run <<'SQL'
SELECT
  (SELECT count(*) FROM public.pagos_factura WHERE client_request_id='a0100000-0000-4000-8000-000000000007' AND deleted_at IS NULL)::text || '|' ||
  (SELECT count(*) FROM public.bbva_movimientos WHERE cuenta_bancaria_id='a0100000-0000-4000-8000-000000000006' AND deleted_at IS NULL)::text || '|' ||
  (SELECT sum(abono) FROM public.bbva_movimientos WHERE cuenta_bancaria_id='a0100000-0000-4000-8000-000000000006' AND deleted_at IS NULL)::text;
SQL
)
[[ "$result" == '1|1|100.00' || "$result" == '1|1|100' ]] || { echo "FAILED: payment|movement|credit=$result" >&2; exit 1; }
echo 'PASS: two contending connections create exactly one collection and one bank credit.'
