-- Reejecución aislada de los replays; no usar contra la base de Lovable.
BEGIN;

\ir ../../migrations/20261005230000_replay_pricing_gerencia.sql
\ir ../../migrations/20261005230100_replay_crm_empresa_estado.sql
\ir ../../migrations/20261006000100_replay_pricing_tarifas_folio.sql
\ir ../../migrations/20261006000200_replay_pricing_adjuntos.sql

DO $$
DECLARE v_count int; v_fn text;
BEGIN
  SELECT count(*) INTO v_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'costeo_tarifas'
      AND column_name IN ('solicitud_pricing_id','carta_garantia','unidad_flete');
  IF v_count <> 3 THEN RAISE EXCEPTION 'Faltan columnas del replay de pricing'; END IF;
  IF public._crm_folio_pricing_prefijo('2026-10-01T05:59:59Z') <> 'SEP26'
     OR public._crm_folio_pricing_prefijo('2026-10-01T06:00:00Z') <> 'OCT26' THEN
    RAISE EXCEPTION 'El prefijo mensual debe usar el límite de mes de CDMX';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='crm-pricing-adjuntos'
    AND NOT public AND file_size_limit=10485760) THEN
    RAISE EXCEPTION 'Falta el bucket privado de adjuntos';
  END IF;
  SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname='storage'
    AND tablename='objects' AND policyname IN ('crm_pricing_adjuntos_leer','crm_pricing_adjuntos_subir');
  IF v_count <> 2 THEN RAISE EXCEPTION 'Faltan las políticas de adjuntos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.costeo_tarifas'::regclass
    AND conname='costeo_tarifas_solicitud_pricing_id_fkey' AND confdeltype='r') THEN
    RAISE EXCEPTION 'El vínculo debe conservar ON DELETE RESTRICT';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY[
    'public._costeo_tarifa_solicitud_guard()', 'public._crm_sol_pricing_before_ins()',
    'public._crm_empresa_estado_por_cliente()', 'public._crm_lead_sync_estado_empresa()'
  ] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'ACL de trigger incorrecta: %', v_fn;
    END IF;
  END LOOP;
END $$;

ROLLBACK;
