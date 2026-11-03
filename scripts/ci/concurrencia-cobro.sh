#!/usr/bin/env bash
# Real RPC sessions: H14 fail-fast/retry, then the retained unique rescue.
# The second scenario waits in an exclusive QA hook, not production code.
set -euo pipefail
[[ "$(printenv GITHUB_ACTIONS)" == true && "$(printenv ISOLATED_QA_DB)" == 1 && "$(printenv PGHOST)" == localhost && -z "$(printenv SUPABASE_DB_URL)" && -z "$(printenv DATABASE_URL)" ]] || {
  echo 'Refusing: requires the isolated Actions Postgres service.' >&2; exit 1;
}
psql_run() { psql -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }
logs=$(mktemp -d)
objects_identity=''
schema_before=''
schema_sql="SELECT md5(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth') AND p.prokind IN ('f','p')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.oid,t.tgrelid,t.tgfoid,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND NOT t.tgisinternal),
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,n.nspname,c.relname,c.relkind,c.relowner,c.relacl,c.reloptions,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attname,a.atttypid,a.attnotnull,a.attidentity,a.attgenerated,a.attisdropped,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname IN ('public','auth') AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.conrelid,c.convalidated,pg_get_constraintdef(c.oid)) ORDER BY c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','auth')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth'))
)::text);"
identity_sql="SELECT md5(jsonb_build_object(
 'table',(SELECT jsonb_build_array(c.oid,c.relowner,c.relacl) FROM pg_class c WHERE c.oid=to_regclass('public.qa_cobro_barrera')),
 'function',(SELECT jsonb_build_array(p.oid,p.proowner,p.proacl,pg_get_functiondef(p.oid)) FROM pg_proc p WHERE p.oid=to_regprocedure('public.qa_cobro_barrera_fn()')),
 'trigger',(SELECT jsonb_build_array(t.oid,t.tgfoid,t.tgenabled,pg_get_triggerdef(t.oid)) FROM pg_trigger t WHERE t.tgrelid='public.pagos_factura'::regclass AND t.tgname='a000_qa_cobro_barrera')
)::text);"
cleanup() {
  local original_rc=$? cleanup_rc=0 f backend_pid backend_start actual after
  trap - EXIT
  # Immutable identities, not names alone, authorize terminating test sessions.
  for f in "$logs"/*.identity; do
    [[ -f "$f" ]] || continue
    IFS='|' read -r backend_pid backend_start < "$f" || true
    [[ "$backend_pid" =~ ^[0-9]+$ && -n "$backend_start" ]] || { cleanup_rc=1; continue; }
    psql_run -v qa_pid="$backend_pid" -v qa_started="$backend_start" <<'SQL' >/dev/null || cleanup_rc=1
SET statement_timeout='10s';
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE pid=:'qa_pid'::integer AND backend_start=:'qa_started'::timestamptz
 AND application_name IN ('qa_cobro_a','qa_cobro_b') AND usename=current_user;
SQL
  done
  if [[ -n "$objects_identity" ]]; then
    actual=$(psql_run -c "$identity_sql") || cleanup_rc=1
    if [[ "$actual" == "$objects_identity" ]]; then
      psql_run <<'SQL' >/dev/null || cleanup_rc=1
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='10s';
DROP TRIGGER a000_qa_cobro_barrera ON public.pagos_factura;
DROP FUNCTION public.qa_cobro_barrera_fn();
DROP TABLE public.qa_cobro_barrera;
COMMIT;
SQL
    else
      echo 'FAILED: QA identity changed; refusing to drop unknown objects.' >&2
      cleanup_rc=1
    fi
  fi
  if [[ -n "$schema_before" ]]; then
    after=$(psql_run -c "$schema_sql") || cleanup_rc=1
    [[ "$after" == "$schema_before" ]] || { echo 'FAILED: schema fingerprint changed after QA cleanup.' >&2; cleanup_rc=1; }
  fi
  if [[ "$original_rc" != 0 || "$cleanup_rc" != 0 ]]; then
    cat "$logs"/*.log 2>/dev/null || true
    echo 'FAILED: bank concurrency or verified cleanup.' >&2
    exit 1
  fi
  echo 'PASS: QA backends/objects removed; original schema fingerprint unchanged.'
}
trap cleanup EXIT
psql_run <<'SQL'
DO $preflight$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'QA requires the isolated database owner'; END IF;
 IF to_regclass('public.qa_cobro_barrera') IS NOT NULL OR to_regprocedure('public.qa_cobro_barrera_fn()') IS NOT NULL
 OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.pagos_factura'::regclass AND tgname='a000_qa_cobro_barrera')
 OR EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name IN ('qa_cobro_a','qa_cobro_b'))
 THEN RAISE EXCEPTION 'QA names already exist; refusing to replace or terminate them'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.pagos_factura'::regclass AND tgname='a00_h14_guard_escritura' AND tgenabled='O' AND tgfoid='public._h14_guard_escritor_baja()'::regprocedure)
 THEN RAISE EXCEPTION 'QA requires the original enabled H14 payment guard'; END IF;
END $preflight$;
SQL
schema_before=$(psql_run -c "$schema_sql")
objects_identity=$(psql_run <<SQL
BEGIN;
\i scripts/ci/fixtures/cobro-concurrente.sql
CREATE FUNCTION public.qa_cobro_barrera_fn() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS \$qa\$
BEGIN
 IF current_setting('application_name')='qa_cobro_b'
 AND NEW.client_request_id='a0100000-0000-4000-8000-000000000008'::uuid THEN
   PERFORM pg_advisory_xact_lock(72405109874501888::bigint);
 END IF;
 RETURN NEW;
END \$qa\$;
REVOKE ALL ON FUNCTION public.qa_cobro_barrera_fn() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER a000_qa_cobro_barrera BEFORE INSERT ON public.pagos_factura
 FOR EACH ROW EXECUTE FUNCTION public.qa_cobro_barrera_fn();
$identity_sql
COMMIT;
SQL
)
[[ "$objects_identity" =~ ^[a-f0-9]{32}$ ]] || { echo 'FAILED: QA identity was not frozen.' >&2; exit 1; }
claims="SELECT set_config('request.jwt.claims','{\"sub\":\"a0100000-0000-4000-8000-000000000002\",\"role\":\"authenticated\"}',true); SET LOCAL ROLE authenticated;"
rpc_7="public.registrar_pago_factura_atomico('a0100000-0000-4000-8000-000000000004',public.fecha_negocio_mx(),100,'MXN',1,100,'03','QA-CONC-SPEI','',0,'a0100000-0000-4000-8000-000000000006','a0100000-0000-4000-8000-000000000007')"
rpc_8=$(printf '%s' "$rpc_7" | sed 's/000000000007/000000000008/')
rows_sql="SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.pagos_factura p),(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM public.bbva_movimientos m))"
wait_for() {
  local query="$1"
  for _ in $(seq 1 200); do
    [[ "$(psql_run -c "$query")" == t ]] && return 0
    sleep 0.1
  done
  echo 'FAILED: bounded concurrency barrier was not reached.' >&2
  return 1
}
start_a() {
  local rpc="$1" qa_lock="$2"
  (psql_run > "$logs/a.log" 2>&1 <<SQL
\set VERBOSITY verbose
SET application_name='qa_cobro_a';
\o $logs/a.identity
SELECT pg_backend_pid()::text || '|' || backend_start::text FROM pg_stat_activity WHERE pid=pg_backend_pid();
\o
BEGIN;
SET LOCAL statement_timeout='60s';
$qa_lock
$claims
SELECT $rpc;
RESET ROLE;
DO \$barrier\$
DECLARE started timestamptz:=clock_timestamp();
BEGIN
 LOOP
   EXIT WHEN EXISTS (SELECT 1 FROM public.qa_cobro_barrera WHERE id='go');
   IF clock_timestamp()-started>interval '45 seconds' THEN RAISE EXCEPTION 'QA_BARRIER_TIMEOUT'; END IF;
   PERFORM pg_sleep(0.05);
 END LOOP;
END \$barrier\$;
COMMIT;
SQL
  ) &
  pid_a=$!
  wait_for "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='qa_cobro_a' AND wait_event='PgSleep');"
}
assert_counts() {
  local expected="$1" actual
  actual=$(psql_run <<SQL
SELECT count(DISTINCT p.id)=$expected AND count(m.id)=$expected AND COALESCE(sum(m.abono),0)=100*$expected
 FROM public.pagos_factura p LEFT JOIN public.bbva_movimientos m ON m.pago_factura_id=p.id AND m.deleted_at IS NULL
 WHERE p.client_request_id IN ('a0100000-0000-4000-8000-000000000007','a0100000-0000-4000-8000-000000000008') AND p.deleted_at IS NULL;
SQL
)
  [[ "$actual" == t ]] || { echo "FAILED: expected $expected payments/movements and 100 each." >&2; return 1; }
}
# Scenario 1: fail fast while A is uncommitted, then retry in a NEW transaction.
start_a "$rpc_7" ''
psql_run > "$logs/b-fail-fast.log" 2>&1 <<SQL
\set VERBOSITY verbose
SET application_name='qa_cobro_b';
\o $logs/b-1.identity
SELECT pg_backend_pid()::text || '|' || backend_start::text FROM pg_stat_activity WHERE pid=pg_backend_pid();
\o
BEGIN;
SET LOCAL statement_timeout='10s';
$claims
DO \$test\$
DECLARE before_rows jsonb; after_rows jsonb; state text; message text;
BEGIN
 $rows_sql INTO before_rows;
 BEGIN
   PERFORM $rpc_7;
   RAISE EXCEPTION 'QA_EXPECTED_55P03';
 EXCEPTION WHEN lock_not_available THEN
   GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE,message=MESSAGE_TEXT;
   IF state<>'55P03' OR split_part(message,':',1) IS DISTINCT FROM 'LC_EMBARQUE_EN_USO' THEN RAISE; END IF;
 END;
 $rows_sql INTO after_rows;
 IF before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'QA_REJECTED_PAYMENT_CHANGED_ROWS'; END IF;
 RAISE NOTICE 'PASS H14 exact SQLSTATE 55P03 / LC_EMBARQUE_EN_USO; payment/bank rows unchanged';
END \$test\$;
ROLLBACK;
SQL
wait_for "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='qa_cobro_a' AND wait_event='PgSleep');"
assert_counts 0
psql_run -c "INSERT INTO public.qa_cobro_barrera VALUES ('go');"
rc_a=0; wait "$pid_a" || rc_a=$?
[[ "$rc_a" == 0 ]] || exit 1
assert_counts 1
psql_run > "$logs/b-retry.log" 2>&1 <<SQL
\set VERBOSITY verbose
BEGIN;
SET LOCAL statement_timeout='10s';
$claims
DO \$retry\$
DECLARE result jsonb; payment uuid; movement uuid; before_rows jsonb; after_rows jsonb; state text; message text;
BEGIN
 SELECT p.id,m.id INTO STRICT payment,movement FROM public.pagos_factura p JOIN public.bbva_movimientos m ON m.pago_factura_id=p.id
 WHERE p.client_request_id='a0100000-0000-4000-8000-000000000007' AND p.deleted_at IS NULL AND m.deleted_at IS NULL;
 result:=$rpc_7;
 IF result->>'pago_id' IS DISTINCT FROM payment::text OR result->>'movimiento_id' IS DISTINCT FROM movement::text
 OR result->'reintento' IS DISTINCT FROM 'true'::jsonb OR result->>'movimiento_bancario' IS DISTINCT FROM 'creado'
 THEN RAISE EXCEPTION 'QA_RETRY_DID_NOT_RETURN_ORIGINAL_IDS: %',result; END IF;
 $rows_sql INTO before_rows;
 BEGIN
   PERFORM public.registrar_pago_factura_atomico('a0100000-0000-4000-8000-000000000004',public.fecha_negocio_mx(),101,'MXN',1,101,'03','QA-CONC-SPEI','',0,'a0100000-0000-4000-8000-000000000006','a0100000-0000-4000-8000-000000000007');
   RAISE EXCEPTION 'QA_EXPECTED_DISTINCT_PAYLOAD';
 EXCEPTION WHEN raise_exception THEN
   GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE,message=MESSAGE_TEXT;
   IF state<>'P0001' OR split_part(message,':',1) IS DISTINCT FROM 'LC_PAGO_REINTENTO_DISTINTO' THEN RAISE; END IF;
 END;
 $rows_sql INTO after_rows;
 IF before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'QA_DIFFERENT_PAYLOAD_CHANGED_ROWS'; END IF;
 RAISE NOTICE 'PASS fresh transaction retry returned original IDs/reintento=true; changed payload P0001 left rows unchanged';
END \$retry\$;
COMMIT;
SQL
assert_counts 1
# Scenario 2: QA trigger pauses B AFTER its empty lookup. A commits before B
# enters the still-enabled H14 guard, so B reaches/rescues unique_violation.
psql_run -c 'TRUNCATE public.qa_cobro_barrera;'
start_a "$rpc_8" 'SELECT pg_advisory_xact_lock(72405109874501888::bigint);'
(psql_run > "$logs/b-unique-rescue.log" 2>&1 <<SQL
\set VERBOSITY verbose
SET application_name='qa_cobro_b';
\o $logs/b-2.identity
SELECT pg_backend_pid()::text || '|' || backend_start::text FROM pg_stat_activity WHERE pid=pg_backend_pid();
\o
BEGIN;
SET LOCAL statement_timeout='60s';
$claims
DO \$rescue\$
DECLARE result jsonb; payment uuid; movement uuid;
BEGIN
 result:=$rpc_8;
 SELECT p.id,m.id INTO STRICT payment,movement FROM public.pagos_factura p JOIN public.bbva_movimientos m ON m.pago_factura_id=p.id
 WHERE p.client_request_id='a0100000-0000-4000-8000-000000000008' AND p.deleted_at IS NULL AND m.deleted_at IS NULL;
 IF result->>'pago_id' IS DISTINCT FROM payment::text OR result->>'movimiento_id' IS DISTINCT FROM movement::text
 OR result->'reintento' IS DISTINCT FROM 'true'::jsonb OR result->>'movimiento_bancario' IS DISTINCT FROM 'creado'
 THEN RAISE EXCEPTION 'QA_UNIQUE_RESCUE_DID_NOT_RETURN_ORIGINAL_IDS: %',result; END IF;
 RAISE NOTICE 'PASS unique_violation rescue with H14 continuously enabled returned original IDs/reintento=true';
END \$rescue\$;
COMMIT;
SQL
) &
pid_b=$!
wait_for "SELECT EXISTS (SELECT 1 FROM pg_stat_activity b JOIN pg_stat_activity a ON a.pid=ANY(pg_blocking_pids(b.pid)) WHERE b.application_name='qa_cobro_b' AND b.wait_event_type='Lock' AND b.wait_event='advisory' AND a.application_name='qa_cobro_a' AND a.wait_event='PgSleep');"
assert_counts 1
psql_run -c "INSERT INTO public.qa_cobro_barrera VALUES ('go');"
rc_a=0; wait "$pid_a" || rc_a=$?
rc_b=0; wait "$pid_b" || rc_b=$?
[[ "$rc_a" == 0 && "$rc_b" == 0 ]] || exit 1
assert_counts 2
psql_run <<'SQL'
DO $totals$
BEGIN
 IF EXISTS (
 SELECT p.client_request_id FROM public.pagos_factura p LEFT JOIN public.bbva_movimientos m ON m.pago_factura_id=p.id AND m.deleted_at IS NULL
 WHERE p.client_request_id IN ('a0100000-0000-4000-8000-000000000007','a0100000-0000-4000-8000-000000000008') AND p.deleted_at IS NULL
 GROUP BY p.client_request_id HAVING count(DISTINCT p.id)<>1 OR count(m.id)<>1 OR sum(m.abono)<>100
 ) THEN RAISE EXCEPTION 'QA_EACH_REQUEST_MUST_HAVE_ONE_PAYMENT_ONE_MOVEMENT_100'; END IF;
 IF (SELECT count(*) FROM public.bbva_movimientos WHERE cuenta_bancaria_id='a0100000-0000-4000-8000-000000000006' AND deleted_at IS NULL)<>2
 OR (SELECT sum(abono) FROM public.bbva_movimientos WHERE cuenta_bancaria_id='a0100000-0000-4000-8000-000000000006' AND deleted_at IS NULL)<>200
 THEN RAISE EXCEPTION 'QA_BANK_ACCOUNT_MUST_HAVE_TWO_CREDITS_200'; END IF;
END $totals$;
SQL
[[ "$(psql_run -c "$identity_sql")" == "$objects_identity" ]] || { echo 'FAILED: QA object identity changed.' >&2; exit 1; }
cat "$logs/b-fail-fast.log" "$logs/b-retry.log" "$logs/b-unique-rescue.log"
echo 'PASS: H14 conflict/retry and retained unique rescue each create one collection and one bank credit.'
