-- Reejecución aislada de los replays; no usar contra la base de Lovable.
BEGIN;

\ir ../../migrations/20261005230000_replay_pricing_gerencia.sql
\ir ../../migrations/20261005230100_replay_crm_empresa_estado.sql
\ir ../../migrations/20261006000100_replay_pricing_tarifas_folio.sql
\ir ../../migrations/20261006000200_replay_pricing_adjuntos.sql
\ir ../../migrations/20261006004000_replay_crm_oportunidad_empresa.sql
\ir ../../migrations/20261006012000_replay_pricing_unidad_medida.sql
-- Una segunda ejecución debe conservar el esquema y los permisos.
\ir ../../migrations/20261006004000_replay_crm_oportunidad_empresa.sql
\ir ../../migrations/20261006012000_replay_pricing_unidad_medida.sql

CREATE TEMP TABLE _pricing_unidades_probe (unidad_medida text);

DO $$
DECLARE v_count int; v_fn text; v_constraint text;
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_solicitudes_pricing'
      AND column_name='unidad_medida' AND data_type='text'
      AND is_nullable='YES' AND column_default IS NULL) THEN
    RAISE EXCEPTION 'La unidad de peso debe seguir siendo opcional y sin default';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_constraint FROM pg_constraint
    WHERE conrelid='public.crm_solicitudes_pricing'::regclass
      AND conname='crm_solicitudes_pricing_unidad_medida_check' AND convalidated;
  IF v_constraint IS NULL THEN RAISE EXCEPTION 'Falta el CHECK validado de unidades'; END IF;
  -- Probar el CHECK real sin crear ni actualizar solicitudes de negocio.
  EXECUTE format('ALTER TABLE _pricing_unidades_probe ADD CONSTRAINT unidad_check %s', v_constraint);
  INSERT INTO _pricing_unidades_probe VALUES (NULL), ('kg'), ('lb'), ('t'), ('g');
  BEGIN
    INSERT INTO _pricing_unidades_probe VALUES ('oz');
    RAISE EXCEPTION 'El CHECK permitió una unidad fuera del catálogo';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM pg_proc
    WHERE oid='public.crm_crear_oportunidad_con_empresa(uuid,jsonb)'::regprocedure
      AND NOT prosecdef)
    OR has_function_privilege('anon', 'public.crm_crear_oportunidad_con_empresa(uuid,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.crm_crear_oportunidad_con_empresa(uuid,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.crm_crear_oportunidad_con_empresa(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'El alta con empresa debe conservar SECURITY INVOKER y su ACL';
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
