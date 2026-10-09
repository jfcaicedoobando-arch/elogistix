-- AUD147: append-only day-6 metadata remains reachable through both RPCs.
-- Financial row fixtures are covered by scripts/db/audit147-comparador/matrix.sql.
BEGIN;
DO $test$
DECLARE
  v_oid oid := 'public.costeo_tarifas_vigentes_v'::regclass;
  v_last text[];
  v_body text := pg_get_viewdef(v_oid,true);
BEGIN
  SELECT array_agg(attname::text ORDER BY attnum) INTO v_last
  FROM (SELECT attname,attnum FROM pg_attribute WHERE attrelid=v_oid
        AND attnum>0 AND NOT attisdropped ORDER BY attnum DESC LIMIT 3) c;
  IF v_last IS DISTINCT FROM ARRAY['naviera_demora_moneda','naviera_demora_desde_dia','naviera_demora_hasta_dia'] THEN
    RAISE EXCEPTION 'AUD147: day-6 metadata must be appended';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=v_oid AND 'security_invoker=on'=ANY(reloptions)) THEN
    RAISE EXCEPTION 'AUD147: view security_invoker must be preserved';
  END IF;
  IF position('LEFT JOIN LATERAL' in v_body)=0
      OR position('demora.monto_por_dia AS naviera_demora_dia_6' in v_body)=0
      OR position('demora.moneda AS naviera_demora_moneda' in v_body)=0
      OR position('dt.desde_dia <= 6' in v_body)=0 THEN
    RAISE EXCEPTION 'AUD147: native amount and metadata must come from the same day-6 row';
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE oid IN (
      'public.get_top_tarifas(uuid,uuid,uuid,date,uuid)'::regprocedure,
      'public.get_top_tarifas_por_codigo(text,text,text,date,uuid)'::regprocedure)
      AND proretset AND prorettype=(SELECT reltype FROM pg_class WHERE oid=v_oid))<>2 THEN
    RAISE EXCEPTION 'AUD147: existing RPC rowtype contract changed';
  END IF;
  IF has_function_privilege('anon','public.get_top_tarifas(uuid,uuid,uuid,date,uuid)','EXECUTE')
      OR has_function_privilege('anon','public.get_top_tarifas_por_codigo(text,text,text,date,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'AUD147: comparator RPC exposed to anon';
  END IF;
END $test$;
ROLLBACK;
