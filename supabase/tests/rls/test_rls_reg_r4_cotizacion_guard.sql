-- ============================================================================
-- Suite RLS — Regresión R4 P0-1 · guard_estado_cotizacion desde 'Solicitada'
-- ============================================================================
-- Contrato de negocio:
--   - Las cotizaciones originadas en el portal nacen en estado 'Solicitada'.
--   - Desde 'Solicitada' deben permitirse: Borrador, Enviada, Aceptada,
--     Rechazada y Vencida.
--   - 'Solicitada' → 'En operación' sigue prohibido (LC_COT_TRANSICION_INVALIDA).
--   - Al salir de 'Solicitada' hacia 'Enviada'/'Aceptada' se congela una
--     versión en cotizacion_versiones (paridad con 'Borrador').
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_reg_r4_cotizacion_guard.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a   uuid := gen_random_uuid();
  cli_a   uuid := gen_random_uuid();
  cot_id  uuid;
  versiones int;
  bloqueada boolean := false;

BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS R4 Cot Guard');
  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id)
    VALUES (cli_a, 'Cli R4 Cot Guard', 'XAXX010101000', 'r4guard@example.com', org_a);

  -- =========================================================================
  -- TEST 1: Solicitada → Borrador
  -- =========================================================================
  cot_id := gen_random_uuid();
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado)
    VALUES (cot_id, org_a, cli_a, 'Cli R4 Cot Guard', 'COT-R4G-1', 'Marítimo', 'Importación', 'FOB', 'Solicitada');
  UPDATE public.cotizaciones SET estado = 'Borrador' WHERE id = cot_id;
  PERFORM pg_temp.assert(
    (SELECT estado::text FROM public.cotizaciones WHERE id = cot_id) = 'Borrador',
    'Solicitada → Borrador debe permitirse'
  );

  -- =========================================================================
  -- TEST 2: Solicitada → Enviada (+ snapshot de versión)
  -- =========================================================================
  cot_id := gen_random_uuid();
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado, total_venta, total_costo)
    VALUES (cot_id, org_a, cli_a, 'Cli R4 Cot Guard', 'COT-R4G-2', 'Marítimo', 'Importación', 'FOB', 'Solicitada', 1000, 700);
  UPDATE public.cotizaciones SET estado = 'Enviada' WHERE id = cot_id;
  PERFORM pg_temp.assert(
    (SELECT estado::text FROM public.cotizaciones WHERE id = cot_id) = 'Enviada',
    'Solicitada → Enviada debe permitirse'
  );
  SELECT count(*) INTO versiones FROM public.cotizacion_versiones WHERE cotizacion_id = cot_id;
  PERFORM pg_temp.assert(
    versiones >= 1,
    'Solicitada → Enviada debe congelar una versión en cotizacion_versiones (encontradas=' || versiones || ')'
  );

  -- =========================================================================
  -- TEST 3: Solicitada → Aceptada (+ snapshot de versión)
  -- =========================================================================
  cot_id := gen_random_uuid();
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado, total_venta, total_costo)
    VALUES (cot_id, org_a, cli_a, 'Cli R4 Cot Guard', 'COT-R4G-3', 'Marítimo', 'Importación', 'FOB', 'Solicitada', 1000, 700);
  UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = cot_id;
  PERFORM pg_temp.assert(
    (SELECT estado::text FROM public.cotizaciones WHERE id = cot_id) = 'Aceptada',
    'Solicitada → Aceptada debe permitirse'
  );
  SELECT count(*) INTO versiones FROM public.cotizacion_versiones WHERE cotizacion_id = cot_id;
  PERFORM pg_temp.assert(
    versiones >= 1,
    'Solicitada → Aceptada debe congelar una versión en cotizacion_versiones (encontradas=' || versiones || ')'
  );

  -- =========================================================================
  -- TEST 4: Solicitada → Rechazada
  -- =========================================================================
  cot_id := gen_random_uuid();
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado)
    VALUES (cot_id, org_a, cli_a, 'Cli R4 Cot Guard', 'COT-R4G-4', 'Marítimo', 'Importación', 'FOB', 'Solicitada');
  UPDATE public.cotizaciones SET estado = 'Rechazada' WHERE id = cot_id;
  PERFORM pg_temp.assert(
    (SELECT estado::text FROM public.cotizaciones WHERE id = cot_id) = 'Rechazada',
    'Solicitada → Rechazada debe permitirse'
  );

  -- =========================================================================
  -- TEST 5: Solicitada → Vencida
  -- =========================================================================
  cot_id := gen_random_uuid();
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado)
    VALUES (cot_id, org_a, cli_a, 'Cli R4 Cot Guard', 'COT-R4G-5', 'Marítimo', 'Importación', 'FOB', 'Solicitada');
  UPDATE public.cotizaciones SET estado = 'Vencida' WHERE id = cot_id;
  PERFORM pg_temp.assert(
    (SELECT estado::text FROM public.cotizaciones WHERE id = cot_id) = 'Vencida',
    'Solicitada → Vencida debe permitirse'
  );

  -- =========================================================================
  -- TEST 6: Solicitada → En operación sigue PROHIBIDO
  -- =========================================================================
  cot_id := gen_random_uuid();
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado)
    VALUES (cot_id, org_a, cli_a, 'Cli R4 Cot Guard', 'COT-R4G-6', 'Marítimo', 'Importación', 'FOB', 'Solicitada');
  BEGIN
    UPDATE public.cotizaciones SET estado = 'En operación' WHERE id = cot_id;
  EXCEPTION
    WHEN raise_exception OR check_violation THEN
      bloqueada := true;
  END;
  PERFORM pg_temp.assert(
    bloqueada AND (SELECT estado::text FROM public.cotizaciones WHERE id = cot_id) = 'Solicitada',
    'Solicitada → En operación debe seguir rechazándose (LC_COT_TRANSICION_INVALIDA)'
  );

  RAISE NOTICE 'test_rls_reg_r4_cotizacion_guard: OK';
END $$;

ROLLBACK;
