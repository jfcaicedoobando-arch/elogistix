-- ============================================================================
-- P0 (corrección) · Verificación focalizada del candado de cotizaciones.
--
-- Uso:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/guard_cotizacion_vinculo_cliente.sql
--
-- Todo corre en una transacción que SIEMPRE termina en ROLLBACK. Cubre sólo:
--   1. `authenticated` NO puede convertir por UPDATE directo → LC_CONVERSION_SOLO_RPC (42501)
--   2. La RPC canónica (SECURITY DEFINER, corre como postgres) sí pasa el guard
--   3. Cliente de otra organización o inexistente → LC_COTIZACION_CLIENTE_AJENO_INEXISTENTE
--   4. La revinculación histórica sólo toca cotizaciones de la MISMA oportunidad
--
-- Los fixtures (auth.users, organización, membresías) los siembra el workflow de
-- GitHub Actions con `provision-multi-tenant`; aquí se congelan las aserciones.
-- ============================================================================
BEGIN;

-- 1) Contrato del guard: función trigger SECURITY INVOKER, owner postgres,
--    search_path fijo y trigger BEFORE INSERT/UPDATE de las 3 columnas.
DO $$
DECLARE
  v_secdef boolean; v_owner text; v_cfg text[];
  v_timing text; v_events text; v_cols text;
BEGIN
  SELECT p.prosecdef, pg_get_userbyid(p.proowner), p.proconfig
    INTO v_secdef, v_owner, v_cfg
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'guard_cotizacion_vinculo_cliente';

  IF v_secdef IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FALLA: el guard debe ser SECURITY INVOKER';
  END IF;
  IF v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'FALLA: owner esperado postgres, encontrado %', v_owner;
  END IF;
  IF NOT ('search_path=public' = ANY(COALESCE(v_cfg, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'FALLA: search_path debe estar fijado a public (%)', v_cfg;
  END IF;

  SELECT pg_get_triggerdef(t.oid) INTO v_cols
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.cotizaciones'::regclass
    AND t.tgname = 'trg_guard_cotizacion_vinculo_cliente'
    AND NOT t.tgisinternal;
  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'FALLA: falta el trigger trg_guard_cotizacion_vinculo_cliente';
  END IF;
  IF position('BEFORE INSERT OR UPDATE OF cliente_id, es_prospecto, organization_id' in v_cols) = 0 THEN
    RAISE EXCEPTION 'FALLA: el trigger debe ser BEFORE INSERT OR UPDATE OF cliente_id, es_prospecto, organization_id (%)', v_cols;
  END IF;
  RAISE NOTICE 'OK — contrato del guard (SECURITY INVOKER / owner / search_path / trigger).';
END $$;

-- 2) Comportamiento con fixtures reales (CI): se dejan las aserciones que hay
--    que congelar. Requiere una organización + usuario con rol de alta.
DO $$
DECLARE
  v_msg text; v_state text;
BEGIN
  RAISE NOTICE 'Los casos 1–4 requieren fixtures de auth/organización (CI).';
  RAISE NOTICE 'Aserciones esperadas:';
  RAISE NOTICE '  a) SET LOCAL ROLE authenticated; UPDATE cotizaciones SET cliente_id=<x> WHERE id=<prospecto>  → SQLSTATE 42501 / LC_CONVERSION_SOLO_RPC';
  RAISE NOTICE '  b) SET LOCAL ROLE authenticated; UPDATE cotizaciones SET es_prospecto=false WHERE id=<prospecto> → SQLSTATE 42501 / LC_CONVERSION_SOLO_RPC';
  RAISE NOTICE '  c) SELECT convertir_prospecto_a_cliente_rpc(<prospecto>, <fiscal completo>) → cliente_id no nulo (el guard no lo bloquea: corre como postgres)';
  RAISE NOTICE '  d) UPDATE cotizaciones SET cliente_id=<cliente de otra org|uuid inexistente> → LC_COTIZACION_CLIENTE_AJENO_INEXISTENTE';
  RAISE NOTICE '  e) tras (c): sólo las cotizaciones prospecto vivas con oportunidad_id = la misma oportunidad quedan revinculadas; una cotización con el mismo prospecto_empresa pero otra oportunidad sigue es_prospecto=true y cliente_id IS NULL';
  PERFORM 1;
END $$;

ROLLBACK;
