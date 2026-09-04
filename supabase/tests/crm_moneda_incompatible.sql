-- =============================================================
-- crm_moneda_incompatible.sql · v13.823.58
--
-- Congela el candado de moneda en `crm_cerrar_oportunidad_desde_cotizacion`:
--   · CASO 1: cotización en moneda distinta a la de la oportunidad →
--     LC_MONEDA_INCOMPATIBLE (no se escribe valor_real cruzado de moneda).
--   · CASO 2: misma moneda → camino feliz, valor_real se actualiza.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/crm_moneda_incompatible.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org uuid := 'dd1dd1dd-0000-4000-8000-00000000000a';
  v_et_ab uuid := 'dd1dd1dd-0000-4000-8000-000000000101';
  v_et_ga uuid := 'dd1dd1dd-0000-4000-8000-000000000102';
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

  -- Oportunidad explícitamente en MXN (p. ej. corregida a mano en el CRM).
  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, lead_id, probabilidad, moneda)
  VALUES (v_op, v_org, 'Op moneda', v_et_ab, v_lead, 30, 'MXN');

  -- CASO 1: cotización en USD contra oportunidad en MXN → rechazada.
  INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, oportunidad_id, moneda)
  VALUES (v_cot, v_org, 'TEST-MON-1', 'Marítimo', 'Importación', v_op, 'USD'::moneda);

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

  -- CASO 2: camino feliz, misma moneda (MXN).
  UPDATE public.cotizaciones SET moneda = 'MXN'::moneda WHERE id = v_cot;
  UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_cot;

  SELECT valor_real INTO v_valor FROM public.crm_oportunidades WHERE id = v_op;
  IF v_valor IS NULL THEN
    RAISE EXCEPTION 'FALLO CASO 2: valor_real no se escribió con monedas coincidentes';
  END IF;

  RAISE NOTICE 'OK crm_moneda_incompatible: 2 casos verificados';
END $$;

ROLLBACK;
