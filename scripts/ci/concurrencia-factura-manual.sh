#!/usr/bin/env bash
# Two genuine RPC sessions, held until B is actually blocked on A's lock.
# Fixture persists only inside the disposable Actions Postgres container.
set -euo pipefail
[[ "${ISOLATED_QA_DB:-}" == 1 && ( "${PGHOST:-}" == localhost || "${PGHOST:-}" == 127.0.0.1 ) && -z "${SUPABASE_DB_URL:-}" && -z "${DATABASE_URL:-}" ]] || {
  echo 'Refusing: requires an explicitly isolated loopback test database.' >&2; exit 1;
}
psql_run() { psql -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }
logs=$(mktemp -d)
cleanup() {
  psql_run -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name IN ('qa_factura_manual_a','qa_factura_manual_b'); DROP TABLE IF EXISTS public.qa_factura_manual_barrera;" >/dev/null 2>&1 || true
  # Financial fixtures are not physically deleted; the service container is destroyed.
}
trap cleanup EXIT
psql_run -f scripts/ci/fixtures/factura-manual-concurrente.sql
rpc_sql="SELECT public.crear_factura_manual_idempotente('a0110000-0000-4000-8000-000000000004', jsonb_build_object('organization_id','a0110000-0000-4000-8000-000000000001','cliente_id','a0110000-0000-4000-8000-000000000003','cliente_nombre','QA concurrente','rfc_cliente','XAXX010101000','numero','BORRADOR-AUD110-CONCURRENT','moneda','MXN','tipo_cambio',1,'subtotal',100,'iva',16,'total',116,'fecha_emision',CURRENT_DATE,'fecha_vencimiento',CURRENT_DATE+30,'metodo_pago','PPD','forma_pago','99','uso_cfdi','G03','serie','A','dias_credito',30), '[{\"descripcion\":\"QA concurrente\",\"cantidad\":1,\"precio_unitario\":100,\"total\":100,\"clave_sat\":\"78101800\",\"tipo_iva\":\"gravado_16\",\"tasa_iva_aplicada\":0.16}]');"
claims="SELECT set_config('request.jwt.claims', '{\"sub\":\"a0110000-0000-4000-8000-000000000002\",\"role\":\"authenticated\"}', true); SET LOCAL ROLE authenticated;"
(psql_run > "$logs/a.log" 2>&1 <<SQL
SET application_name='qa_factura_manual_a';
BEGIN;
$claims
$rpc_sql
RESET ROLE;
DO \$barrier\$
DECLARE started timestamptz := clock_timestamp();
BEGIN
  LOOP
    EXIT WHEN EXISTS (SELECT 1 FROM public.qa_factura_manual_barrera WHERE id='go');
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
wait_for "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='qa_factura_manual_a' AND wait_event='PgSleep');"
(psql_run > "$logs/b.log" 2>&1 <<SQL
SET application_name='qa_factura_manual_b';
BEGIN;
SET LOCAL statement_timeout='60s';
$claims
$rpc_sql
COMMIT;
SQL
) &
pid_b=$!
wait_for "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='qa_factura_manual_b' AND wait_event_type='Lock');"
psql_run -c "INSERT INTO public.qa_factura_manual_barrera VALUES ('go');"
rc_a=0; wait "$pid_a" || rc_a=$?
rc_b=0; wait "$pid_b" || rc_b=$?
cat "$logs/a.log" "$logs/b.log"
[[ "$rc_a" == 0 && "$rc_b" == 0 ]] || exit 1
result=$(psql_run <<'SQL'
SELECT
  (SELECT count(*) FROM public.facturas WHERE numero='BORRADOR-AUD110-CONCURRENT')::text || '|' ||
  (SELECT count(*) FROM public.conceptos_factura c JOIN public.facturas f ON f.id=c.factura_id WHERE f.numero='BORRADOR-AUD110-CONCURRENT')::text || '|' ||
  (SELECT count(*) FROM public.bitacora_actividad b JOIN public.facturas f ON f.id=b.entidad_id WHERE f.numero='BORRADOR-AUD110-CONCURRENT' AND b.accion='Creó factura manual borrador')::text;
SQL
)
[[ "$result" == '1|1|1' ]] || { echo "FAILED: invoice|concept|creation-event=$result" >&2; exit 1; }
echo 'PASS: two contending connections create exactly one invoice, concept and capture event.'
