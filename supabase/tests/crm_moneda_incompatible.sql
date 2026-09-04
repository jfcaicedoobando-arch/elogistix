-- =============================================================
-- crm_moneda_incompatible.sql · v13.823.72
--
-- Congela el candado de moneda en `crm_cerrar_oportunidad_desde_cotizacion`:
--   · CASO 1: cotización en moneda distinta a la de la oportunidad →
--     LC_MONEDA_INCOMPATIBLE (no se escribe valor_real cruzado de moneda).
--   · CASO 2: misma moneda → camino feliz, valor_real se actualiza.
--
-- Nota de armado: `trg_crm_sync_oportunidad_desde_cotizacion` es AFTER y
-- alinea la moneda de la oportunidad ABIERTA con la de la cotización. Para
-- llegar al candado (BEFORE) hay que reproducir el escenario real en el que
-- la oportunidad quedó con otra moneda (corrección manual en el CRM), así que
-- la moneda de la oportunidad se restablece a MXN después de crear la
-- cotización en USD.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/crm_moneda_incompatible.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org uuid := 'dd1dd1dd-0000-4000-8000-00000000000a';
  v_et_ab uuid := 'dd1dd1dd-0000-4000-8000-000000000101';
  v_et_ga uuid := 'dd1dd1dd-0000-4000-8000-000000000102';
  v_cli uuid := 'dd1dd1dd-0000-4000-8000-000000000151';
  v_lead uuid := 'dd1dd1dd-0000-4000-8000-000000000201';
  v_op uuid := 'dd1dd1dd-0000-4000-8000-000000000301';
  v_cot uuid := 'dd1dd1dd-0000-4000-8000-000000000401';
  v_valor numeric;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'TEST CRM MONEDA');

  INSERT INTO public.crm_etapas_pipeline (id, organization_id, nombre, tipo, orden, probabilidad_default) VALUES
    (v_et_ab, v_org, 'TEST Abierta', 'abierta', 91, 30),
    (v_et_ga, v_org, 'TEST Ganada', 'ganada', 92, 100);

  INSERT INTO public.crm_leads (id, organization_id, empresa, estado) VALUES
    (v_lead, v_org, 'Lead moneda', 'Calificado');

  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
    (v_cli, v_org, 'TEST Cliente moneda', 'cli-moneda@test.local');

  -- Oportunidad explícitamente en MXN.
  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, lead_id, cliente_id, probabilidad, moneda)
  VALUES (v_op, v_org, 'Op moneda', v_et_ab, v_lead, v_cli, 30, 'MXN');

  -- CASO 1: cotización en USD contra oportunidad en MXN → rechazada.
  INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, cliente_id, oportunidad_id, estado, subtotal, version, moneda)
  VALUES (v_cot, v_org, 'TEST-MON-1', 'Marítimo', 'Importación', v_cli, v_op, 'Enviada', 1000, 1, 'USD'::moneda);

  -- La sincronización AFTER alineó la moneda de la oportunidad: la volvemos a
  -- MXN para reproducir la corrección manual del vendedor.
  UPDATE public.crm_oportunidades SET moneda = 'MXN' WHERE id = v_op;

  BEGIN
    UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_cot;
    RAISE EXCEPTION 'FALLO CASO 1: se permitió cerrar con moneda incompatible';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_MONEDA_INCOMPATIBLE%' THEN RAISE; END IF;
  END;

  SELECT valor_real INTO v_valor FROM public.crm_oportunidades WHERE id = v_op;
  IF v_valor IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO CASO 1b: valor_real quedó escrito pese al rechazo (%)', v_valor;
  END IF;

  -- CASO 2: camino feliz, misma moneda (MXN en cotización y oportunidad).
  UPDATE public.cotizaciones SET moneda = 'MXN'::moneda WHERE id = v_cot;
  UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_cot;

  SELECT valor_real INTO v_valor FROM public.crm_oportunidades WHERE id = v_op;
  IF v_valor IS DISTINCT FROM 1000 THEN
    RAISE EXCEPTION 'FALLO CASO 2: valor_real esperado 1000 y llegó %', COALESCE(v_valor::text, 'NULL');
  END IF;

  RAISE NOTICE 'OK crm_moneda_incompatible: 2 casos verificados';
END $$;

ROLLBACK;
