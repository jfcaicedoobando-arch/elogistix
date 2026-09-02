-- =============================================================
-- crm_candados_multiempresa.sql · v13.823.51
--
-- Congela los candados multiempresa del CRM:
--   · CASO 1: cotización → oportunidad de OTRA organización → LC_OPORTUNIDAD_AJENA.
--   · CASO 2: cotización → oportunidad viva de la MISMA organización (camino feliz).
--   · CASO 3: actividad → oportunidad de otra organización → LC_ENTIDAD_AJENA.
--   · CASO 4: actividad → entidad inexistente → LC_ENTIDAD_AJENA.
--   · CASO 5: actividad → lead vivo de la misma organización (camino feliz).
--   · CASO 6: invariante de probabilidad terminal (ganada=100, perdida=0) en
--     cualquier UPDATE, no sólo el del Kanban.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/crm_candados_multiempresa.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org_a uuid := 'cc1cc1cc-0000-4000-8000-00000000000a';
  v_org_b uuid := 'cc1cc1cc-0000-4000-8000-00000000000b';
  v_et_a_ab uuid := 'cc1cc1cc-0000-4000-8000-000000000101';
  v_et_a_ga uuid := 'cc1cc1cc-0000-4000-8000-000000000102';
  v_et_a_pe uuid := 'cc1cc1cc-0000-4000-8000-000000000103';
  v_et_b_ab uuid := 'cc1cc1cc-0000-4000-8000-000000000111';
  v_lead_a uuid := 'cc1cc1cc-0000-4000-8000-000000000201';
  v_op_a uuid := 'cc1cc1cc-0000-4000-8000-000000000301';
  v_op_b uuid := 'cc1cc1cc-0000-4000-8000-000000000311';
  v_cot uuid := 'cc1cc1cc-0000-4000-8000-000000000401';
  v_prob numeric;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org_a, 'TEST CRM CANDADOS A'), (v_org_b, 'TEST CRM CANDADOS B');

  INSERT INTO public.crm_etapas_pipeline (id, organization_id, nombre, tipo, orden, probabilidad_default) VALUES
    (v_et_a_ab, v_org_a, 'Abierta', 'abierta', 1, 30),
    (v_et_a_ga, v_org_a, 'Ganada', 'ganada', 2, 100),
    (v_et_a_pe, v_org_a, 'Perdida', 'perdida', 3, 0),
    (v_et_b_ab, v_org_b, 'Abierta', 'abierta', 1, 30);

  INSERT INTO public.crm_leads (id, organization_id, empresa, estado) VALUES
    (v_lead_a, v_org_a, 'Lead A', 'Calificado');

  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, lead_id, probabilidad) VALUES
    (v_op_a, v_org_a, 'Op A', v_et_a_ab, v_lead_a, 30);
  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, probabilidad) VALUES
    (v_op_b, v_org_b, 'Op B', v_et_b_ab, 30);

  -- CASO 1: vínculo cross-org rechazado.
  BEGIN
    INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, oportunidad_id)
    VALUES (v_cot, v_org_a, 'TEST-CAND-1', 'Marítimo', 'importacion', v_op_b);
    RAISE EXCEPTION 'FALLO CASO 1: se permitió vincular una oportunidad de otra organización';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_OPORTUNIDAD_AJENA%' THEN RAISE; END IF;
  END;

  -- CASO 2: vínculo same-org permitido.
  INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, oportunidad_id)
  VALUES (v_cot, v_org_a, 'TEST-CAND-2', 'Marítimo', 'importacion', v_op_a);

  -- CASO 3: actividad ligada a oportunidad de otra organización.
  BEGIN
    INSERT INTO public.crm_actividades (organization_id, tipo, asunto, entidad_tipo, entidad_id)
    VALUES (v_org_a, 'tarea', 'Cross-org', 'oportunidad', v_op_b);
    RAISE EXCEPTION 'FALLO CASO 3: se permitió una actividad cross-org';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_ENTIDAD_AJENA%' THEN RAISE; END IF;
  END;

  -- CASO 4: actividad huérfana.
  BEGIN
    INSERT INTO public.crm_actividades (organization_id, tipo, asunto, entidad_tipo, entidad_id)
    VALUES (v_org_a, 'tarea', 'Huérfana', 'oportunidad', gen_random_uuid());
    RAISE EXCEPTION 'FALLO CASO 4: se permitió una actividad sin entidad viva';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_ENTIDAD_AJENA%' THEN RAISE; END IF;
  END;

  -- CASO 5: camino feliz same-org (lead).
  INSERT INTO public.crm_actividades (organization_id, tipo, asunto, entidad_tipo, entidad_id)
  VALUES (v_org_a, 'tarea', 'Same-org', 'lead', v_lead_a);

  -- CASO 6: probabilidad terminal forzada en cualquier ruta.
  UPDATE public.crm_oportunidades SET etapa_id = v_et_a_ga, probabilidad = 70 WHERE id = v_op_a;
  SELECT probabilidad INTO v_prob FROM public.crm_oportunidades WHERE id = v_op_a;
  IF v_prob <> 100 THEN
    RAISE EXCEPTION 'FALLO CASO 6a: etapa ganada dejó probabilidad %', v_prob;
  END IF;
  UPDATE public.crm_oportunidades SET etapa_id = v_et_a_pe, probabilidad = 55 WHERE id = v_op_a;
  SELECT probabilidad INTO v_prob FROM public.crm_oportunidades WHERE id = v_op_a;
  IF v_prob <> 0 THEN
    RAISE EXCEPTION 'FALLO CASO 6b: etapa perdida dejó probabilidad %', v_prob;
  END IF;

  RAISE NOTICE 'OK crm_candados_multiempresa: 6 casos verificados';
END $$;

ROLLBACK;
