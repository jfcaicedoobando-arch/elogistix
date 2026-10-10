-- Narrow forward fix: conceptos_venta can change subtotal in a BEFORE trigger.
-- UPDATE OF checks the original SET list, not changes made by BEFORE triggers.
-- No function body, ACL, owner, row, or historical amount is rewritten.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.cotizaciones IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
DECLARE
  v_trigger_before jsonb;
  v_trigger_after jsonb;
  v_functions_before jsonb;
  v_functions_after jsonb;
  v_table_before jsonb;
  v_table_after jsonb;
  v_comment_before text;
  v_columns text[];
  v_definition text;
  v_expected_before constant text := 'CREATE TRIGGER trg_crm_sync_oportunidad_desde_cotizacion AFTER INSERT OR UPDATE OF subtotal, moneda, cliente_id, oportunidad_id ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION _crm_sync_oportunidad_desde_cotizacion()';
  v_expected_after constant text := 'CREATE TRIGGER trg_crm_sync_oportunidad_desde_cotizacion AFTER INSERT OR UPDATE OF subtotal, moneda, cliente_id, oportunidad_id, conceptos_venta ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION _crm_sync_oportunidad_desde_cotizacion()';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'public.cotizaciones'::regclass AND relkind = 'r' AND NOT relispartition
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_inherits
    WHERE inhparent = 'public.cotizaciones'::regclass OR inhrelid = 'public.cotizaciones'::regclass
  ) THEN
    RAISE EXCEPTION 'LC_CRM_CONCEPT_SYNC_DRIFT: ordinary non-inherited quotation table required';
  END IF;

  SELECT to_jsonb(t), pg_catalog.pg_get_triggerdef(t.oid, false),
         pg_catalog.obj_description(t.oid, 'pg_trigger')
    INTO v_trigger_before, v_definition, v_comment_before
    FROM pg_catalog.pg_trigger t
   WHERE t.tgrelid = 'public.cotizaciones'::regclass
     AND t.tgname = 'trg_crm_sync_oportunidad_desde_cotizacion';
  IF v_trigger_before IS NULL OR v_definition IS DISTINCT FROM v_expected_before
     OR v_trigger_before->>'tgenabled' IS DISTINCT FROM 'O'
     OR (v_trigger_before->>'tgisinternal')::boolean
     OR (v_trigger_before->>'tgparentid')::oid <> 0 THEN
    RAISE EXCEPTION 'LC_CRM_CONCEPT_SYNC_DRIFT: reviewed enabled CRM trigger required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = 'public._crm_sync_oportunidad_desde_cotizacion()'::regprocedure
      AND md5(p.prosrc) = 'af74ad66a16484e4549fae3f111a8203'
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      AND p.prosecdef AND p.proconfig = ARRAY['search_path=public']::text[]
  ) THEN
    RAISE EXCEPTION 'LC_CRM_CONCEPT_SYNC_DRIFT: reviewed CRM function body and security mode required';
  END IF;

  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) INTO v_functions_before
    FROM pg_catalog.pg_proc p
   WHERE p.oid IN ('public._crm_sync_oportunidad_desde_cotizacion()'::regprocedure,
                   'public.trg_cotizacion_subtotal_server()'::regprocedure);
  SELECT jsonb_build_object('owner', c.relowner, 'acl', c.relacl,
                           'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity)
    INTO v_table_before FROM pg_catalog.pg_class c
   WHERE c.oid = 'public.cotizaciones'::regclass;

  CREATE OR REPLACE TRIGGER trg_crm_sync_oportunidad_desde_cotizacion
    AFTER INSERT OR UPDATE OF subtotal, moneda, cliente_id, oportunidad_id, conceptos_venta
    ON public.cotizaciones FOR EACH ROW
    EXECUTE FUNCTION public._crm_sync_oportunidad_desde_cotizacion();

  SELECT to_jsonb(t), pg_catalog.pg_get_triggerdef(t.oid, false),
         ARRAY(SELECT a.attname::text
               FROM unnest(t.tgattr) WITH ORDINALITY x(attnum, position)
               JOIN pg_catalog.pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = x.attnum
               ORDER BY x.position)
    INTO v_trigger_after, v_definition, v_columns
    FROM pg_catalog.pg_trigger t
   WHERE t.tgrelid = 'public.cotizaciones'::regclass
     AND t.tgname = 'trg_crm_sync_oportunidad_desde_cotizacion'
     AND pg_catalog.obj_description(t.oid, 'pg_trigger') IS NOT DISTINCT FROM v_comment_before;
  IF v_trigger_after IS NULL OR v_definition IS DISTINCT FROM v_expected_after
     OR (v_trigger_after - 'tgattr') IS DISTINCT FROM (v_trigger_before - 'tgattr')
     OR v_columns IS DISTINCT FROM ARRAY['subtotal','moneda','cliente_id','oportunidad_id','conceptos_venta']::text[] THEN
    RAISE EXCEPTION 'LC_CRM_CONCEPT_SYNC_POSTCHECK: change exceeded the single watched column';
  END IF;

  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) INTO v_functions_after
    FROM pg_catalog.pg_proc p
   WHERE p.oid IN ('public._crm_sync_oportunidad_desde_cotizacion()'::regprocedure,
                   'public.trg_cotizacion_subtotal_server()'::regprocedure);
  SELECT jsonb_build_object('owner', c.relowner, 'acl', c.relacl,
                           'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity)
    INTO v_table_after FROM pg_catalog.pg_class c
   WHERE c.oid = 'public.cotizaciones'::regclass;
  IF v_functions_after IS DISTINCT FROM v_functions_before
     OR v_table_after IS DISTINCT FROM v_table_before THEN
    RAISE EXCEPTION 'LC_CRM_CONCEPT_SYNC_POSTCHECK: function or table security metadata changed';
  END IF;
END;
$migration$;
COMMIT;
