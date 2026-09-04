-- =============================================================
-- crm_vincular_moneda_vendedor.sql · v13.823.72
--
-- Congela P1 #6: al crear una oportunidad NUEVA desde
-- `crm_vincular_cotizacion`, ésta debe heredar:
--   · CASO 1: `moneda` de la cotización (no el default 'MXN').
--   · CASO 2: `vendedor_id`/`vendedor_email` del lead (no el usuario actual).
--   · CASO 3: fallback al usuario actual cuando el lead NO tiene vendedor.
--   · CASO 4: rechazo LC_CRM_MONEDA_INCOMPATIBLE si la oportunidad
--     objetivo ya tiene una moneda distinta a la de la cotización.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/crm_vincular_moneda_vendedor.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org uuid := 'ee1ee1ee-0000-4000-8000-00000000000a';
  v_et_ab uuid := 'ee1ee1ee-0000-4000-8000-000000000101';
  v_vendedor uuid := 'ee1ee1ee-0000-4000-8000-000000000201';
  v_actor uuid := 'ee1ee1ee-0000-4000-8000-000000000202';
  v_lead_con_vend uuid := 'ee1ee1ee-0000-4000-8000-000000000301';
  v_lead_sin_vend uuid := 'ee1ee1ee-0000-4000-8000-000000000302';
  v_lead_mon uuid := 'ee1ee1ee-0000-4000-8000-000000000303';
  v_cot1 uuid := 'ee1ee1ee-0000-4000-8000-000000000401';
  v_cot2 uuid := 'ee1ee1ee-0000-4000-8000-000000000402';
  v_cot3 uuid := 'ee1ee1ee-0000-4000-8000-000000000403';
  v_op_mxn uuid := 'ee1ee1ee-0000-4000-8000-000000000501';
  v_res jsonb;
  v_op_id uuid;
  v_op_mon text;
  v_op_vend uuid;
  v_op_vend_email text;
BEGIN
  -- En CI/sandbox el alta en `auth` puede no estar permitida; `vendedor_id`
  -- no tiene FK a auth.users, así que sólo el correo del fallback depende
  -- de esta alta y se valida por `vendedor_id`.
  BEGIN
    INSERT INTO auth.users(id, email) VALUES
      (v_vendedor, 'vend-mon@test.local'),
      (v_actor, 'actor-mon@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN NULL;
  END;

  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'TEST CRM MONEDA VENDEDOR');

  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
    (v_org, v_actor, 'vendedor')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.crm_etapas_pipeline (id, organization_id, nombre, tipo, orden, probabilidad_default) VALUES
    (v_et_ab, v_org, 'TEST Abierta', 'abierta', 91, 30);

  INSERT INTO public.crm_leads (id, organization_id, empresa, estado, vendedor_id, vendedor_email) VALUES
    (v_lead_con_vend, v_org, 'Lead con vendedor', 'Calificado', v_vendedor, 'vend-mon@test.local'),
    (v_lead_sin_vend, v_org, 'Lead sin vendedor', 'Calificado', NULL, NULL),
    (v_lead_mon, v_org, 'Lead moneda', 'Calificado', NULL, NULL);

  INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, es_prospecto, prospecto_empresa, moneda) VALUES
    (v_cot1, v_org, 'TEST-MV-1', 'Marítimo', 'Importación', true, 'Lead con vendedor', 'USD'::moneda),
    (v_cot2, v_org, 'TEST-MV-2', 'Marítimo', 'Importación', true, 'Lead sin vendedor', 'EUR'::moneda),
    (v_cot3, v_org, 'TEST-MV-3', 'Marítimo', 'Importación', true, 'Lead moneda', 'USD'::moneda);

  -- CASO 4 (setup): oportunidad abierta del prospecto ya registrada en MXN.
  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, lead_id, probabilidad, moneda)
  VALUES (v_op_mxn, v_org, 'Op MXN existente', v_et_ab, v_lead_mon, 30, 'MXN');

  -- CASO 1 y 2: oportunidad nueva hereda moneda de la cotización y
  -- vendedor del lead (no el usuario actor).
  PERFORM pg_temp.as_user(v_actor);
  v_res := public.crm_vincular_cotizacion(v_cot1, '{}'::jsonb, v_lead_con_vend, NULL);
  PERFORM pg_temp.as_postgres();
  v_op_id := (v_res->>'oportunidad_id')::uuid;

  SELECT moneda, vendedor_id, vendedor_email
    INTO v_op_mon, v_op_vend, v_op_vend_email
  FROM public.crm_oportunidades WHERE id = v_op_id;

  PERFORM pg_temp.assert(v_op_mon = 'USD',
    format('CASO 1: se esperaba moneda USD heredada de la cotización y llegó %s', v_op_mon));
  PERFORM pg_temp.assert(v_op_vend = v_vendedor,
    'CASO 2: la oportunidad debe heredar el vendedor_id del lead, no el usuario actual');
  PERFORM pg_temp.assert(v_op_vend_email = 'vend-mon@test.local',
    'CASO 2b: la oportunidad debe heredar el vendedor_email del lead');

  -- CASO 3: lead sin vendedor asignado → fallback al usuario actual (actor).
  PERFORM pg_temp.as_user(v_actor);
  v_res := public.crm_vincular_cotizacion(v_cot2, '{}'::jsonb, v_lead_sin_vend, NULL);
  PERFORM pg_temp.as_postgres();
  v_op_id := (v_res->>'oportunidad_id')::uuid;

  SELECT moneda, vendedor_id INTO v_op_mon, v_op_vend
  FROM public.crm_oportunidades WHERE id = v_op_id;

  PERFORM pg_temp.assert(v_op_mon = 'EUR',
    format('CASO 3: se esperaba moneda EUR heredada de la cotización y llegó %s', v_op_mon));
  PERFORM pg_temp.assert(v_op_vend = v_actor,
    'CASO 3: sin vendedor en el lead debe caer al usuario actual como fallback');

  -- CASO 4: la oportunidad objetivo ya existe con una moneda DISTINTA a la
  -- de la cotización → rechazo LC_CRM_MONEDA_INCOMPATIBLE, sin escribir vínculo.
  PERFORM pg_temp.as_user(v_actor);
  BEGIN
    PERFORM public.crm_vincular_cotizacion(v_cot3, '{}'::jsonb, NULL, v_op_mxn);
    PERFORM pg_temp.as_postgres();
    RAISE EXCEPTION 'FALLO CASO 4: se permitió vincular con moneda incompatible';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_CRM_MONEDA_INCOMPATIBLE%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.as_postgres();

  PERFORM pg_temp.assert(
    (SELECT oportunidad_id FROM public.cotizaciones WHERE id = v_cot3) IS NULL,
    'CASO 4: la cotización no debe quedar vinculada tras el rechazo por moneda');

  RAISE NOTICE 'OK crm_vincular_moneda_vendedor: 4 casos verificados';
END $$;

ROLLBACK;
