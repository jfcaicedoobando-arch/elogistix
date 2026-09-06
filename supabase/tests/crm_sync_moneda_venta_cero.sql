-- =============================================================
-- crm_sync_moneda_venta_cero.sql · A1/A7
--
-- Congela el candado de `_crm_sync_oportunidad_desde_cotizacion`:
--   · CASO 1: oportunidad MXN con monto previo 125000 + cotización vinculada
--     en USD con subtotal 0 → NO se redenomina (monto y moneda intactos).
--   · CASO 2 (inverso): oportunidad USD con monto previo + cotización MXN con
--     subtotal 0 → tampoco cambia.
--   · CASO 3: con subtotal real sí se alinean monto y moneda.
--
-- Ejecución (solo GitHub Actions):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/crm_sync_moneda_venta_cero.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org uuid := 'dd2dd2dd-0000-4000-8000-00000000000a';
  v_et uuid := 'dd2dd2dd-0000-4000-8000-000000000101';
  v_cli uuid := 'dd2dd2dd-0000-4000-8000-000000000151';
  v_op1 uuid := 'dd2dd2dd-0000-4000-8000-000000000301';
  v_op2 uuid := 'dd2dd2dd-0000-4000-8000-000000000302';
  v_cot1 uuid := 'dd2dd2dd-0000-4000-8000-000000000401';
  v_cot2 uuid := 'dd2dd2dd-0000-4000-8000-000000000402';
  v_moneda text;
  v_monto numeric;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'TEST SYNC MONEDA');

  INSERT INTO public.crm_etapas_pipeline (id, organization_id, nombre, tipo, orden, probabilidad_default)
  VALUES (v_et, v_org, 'TEST Abierta', 'abierta', 93, 30);

  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'TEST Cliente sync', 'cli-sync@test.local');

  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, cliente_id, probabilidad, moneda, monto_estimado)
  VALUES (v_op1, v_org, 'Op MXN', v_et, v_cli, 30, 'MXN', 125000),
         (v_op2, v_org, 'Op USD', v_et, v_cli, 30, 'USD', 8000);

  -- CASO 1: cotización USD con subtotal 0 contra oportunidad MXN.
  INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, cliente_id, oportunidad_id, estado, subtotal, version, moneda)
  VALUES (v_cot1, v_org, 'TEST-SYNC-1', 'Marítimo', 'Importación', v_cli, v_op1, 'Borrador', 0, 1, 'USD'::moneda);

  SELECT moneda, monto_estimado INTO v_moneda, v_monto FROM public.crm_oportunidades WHERE id = v_op1;
  IF v_moneda <> 'MXN' OR v_monto IS DISTINCT FROM 125000 THEN
    RAISE EXCEPTION 'FALLO CASO 1: oportunidad quedó % / %', v_moneda, v_monto;
  END IF;

  -- CASO 2 (inverso): cotización MXN con subtotal 0 contra oportunidad USD.
  INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, cliente_id, oportunidad_id, estado, subtotal, version, moneda)
  VALUES (v_cot2, v_org, 'TEST-SYNC-2', 'Marítimo', 'Importación', v_cli, v_op2, 'Borrador', 0, 1, 'MXN'::moneda);

  SELECT moneda, monto_estimado INTO v_moneda, v_monto FROM public.crm_oportunidades WHERE id = v_op2;
  IF v_moneda <> 'USD' OR v_monto IS DISTINCT FROM 8000 THEN
    RAISE EXCEPTION 'FALLO CASO 2: oportunidad quedó % / %', v_moneda, v_monto;
  END IF;

  -- CASO 3: con importe real sí se alinea monto y moneda.
  UPDATE public.cotizaciones SET subtotal = 4000 WHERE id = v_cot1;

  SELECT moneda, monto_estimado INTO v_moneda, v_monto FROM public.crm_oportunidades WHERE id = v_op1;
  IF v_moneda <> 'USD' OR v_monto IS DISTINCT FROM 4000 THEN
    RAISE EXCEPTION 'FALLO CASO 3: esperaba USD/4000 y llegó % / %', v_moneda, v_monto;
  END IF;

  RAISE NOTICE 'OK crm_sync_moneda_venta_cero: 3 casos verificados';
END $$;

ROLLBACK;
