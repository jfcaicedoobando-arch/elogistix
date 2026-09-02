-- =============================================================
-- crm_cross_org_convertir_lead.sql · v13.823.54
--
-- Congela el lote DB/seguridad YAGNI:
--   A) public.convertir_lead_rpc autoriza por sesión + membresía + ROL EFECTIVO
--      por organización (vendedor sólo su propio lead).
--   B) crm_oportunidades: lead_id/cliente_id vivos y de la misma organización,
--      incluido el cambio de organization_id.
--   C) crm_etapa_criterios / crm_oportunidad_criterios: sólo entidades de su
--      propia organización, vivas/activas cuando esas columnas existen.
--   D) crm_comentarios_oportunidad: sólo oportunidades vivas de su organización.
--
-- Cada caso negativo comprueba el código LC_* esperado (no cualquier error de
-- fixture).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/crm_cross_org_convertir_lead.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- Espera un error cuyo mensaje contenga `_codigo`; cualquier otro error o un
-- éxito abortan la suite.
CREATE OR REPLACE FUNCTION pg_temp.espera_lc(_sql text, _codigo text, _caso text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_msg text;
BEGIN
  BEGIN
    EXECUTE _sql;
    RAISE EXCEPTION 'FALLO %: se esperaba % y la operación fue permitida', _caso, _codigo;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF position(_codigo in v_msg) = 0 THEN
      RAISE EXCEPTION 'FALLO %: se esperaba % y llegó «%»', _caso, _codigo, v_msg;
    END IF;
  END;
END;
$$;

DO $$
DECLARE
  v_org_a uuid := 'aa11aa11-0000-4000-8000-00000000000a';
  v_org_b uuid := 'aa11aa11-0000-4000-8000-00000000000b';
  v_et_a uuid := 'aa11aa11-0000-4000-8000-000000000101';
  v_et_b uuid := 'aa11aa11-0000-4000-8000-000000000111';
  v_vend_a uuid := 'aa11aa11-0000-4000-8000-000000000201';
  v_vend_a2 uuid := 'aa11aa11-0000-4000-8000-000000000202';
  v_viewer uuid := 'aa11aa11-0000-4000-8000-000000000203';
  v_degradado uuid := 'aa11aa11-0000-4000-8000-000000000204';
  v_user_b uuid := 'aa11aa11-0000-4000-8000-000000000211';
  v_lead1 uuid := 'aa11aa11-0000-4000-8000-000000000301';
  v_lead2 uuid := 'aa11aa11-0000-4000-8000-000000000302';
  v_lead3 uuid := 'aa11aa11-0000-4000-8000-000000000303';
  v_lead4 uuid := 'aa11aa11-0000-4000-8000-000000000304';
  v_lead5 uuid := 'aa11aa11-0000-4000-8000-000000000305';
  v_lead_b uuid := 'aa11aa11-0000-4000-8000-000000000311';
  v_op_a uuid := 'aa11aa11-0000-4000-8000-000000000401';
  v_op_b uuid := 'aa11aa11-0000-4000-8000-000000000411';
  v_crit_a uuid := 'aa11aa11-0000-4000-8000-000000000501';
  v_crit_b uuid := 'aa11aa11-0000-4000-8000-000000000511';
  v_res jsonb;
BEGIN
  BEGIN
    INSERT INTO auth.users(id, email) VALUES
      (v_vend_a, 'vend-a@test.local'), (v_vend_a2, 'vend-a2@test.local'),
      (v_viewer, 'viewer-a@test.local'), (v_degradado, 'degradado-a@test.local'),
      (v_user_b, 'user-b@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;  -- CI sin GoTrue
  END;

  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org_a, 'TEST CROSS ORG A'), (v_org_b, 'TEST CROSS ORG B');

  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
    (v_org_a, v_vend_a, 'vendedor'), (v_org_a, v_vend_a2, 'vendedor'),
    (v_org_a, v_viewer, 'viewer'),
    -- Rol global histórico alto, membership efectiva degradada a viewer.
    (v_org_a, v_degradado, 'viewer'),
    (v_org_b, v_user_b, 'admin_org');

  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_vend_a, 'vendedor'), (v_vend_a2, 'vendedor'), (v_viewer, 'viewer'),
    (v_degradado, 'admin_org'), (v_user_b, 'admin_org')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.crm_etapas_pipeline (id, organization_id, nombre, tipo, orden, probabilidad_default) VALUES
    (v_et_a, v_org_a, 'TEST Abierta A', 'abierta', 81, 20),
    (v_et_b, v_org_b, 'TEST Abierta B', 'abierta', 81, 20);

  INSERT INTO public.crm_leads (id, organization_id, empresa, estado, vendedor_id) VALUES
    (v_lead1, v_org_a, 'Lead propio', 'Calificado', v_vend_a),
    (v_lead2, v_org_a, 'Lead ajeno', 'Calificado', v_vend_a2),
    (v_lead3, v_org_a, 'Lead viewer', 'Calificado', v_vend_a),
    (v_lead4, v_org_a, 'Lead degradado', 'Calificado', v_vend_a),
    (v_lead5, v_org_a, 'Lead otra org', 'Calificado', v_vend_a),
    (v_lead_b, v_org_b, 'Lead B', 'Calificado', v_user_b);

  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, lead_id, vendedor_id, probabilidad) VALUES
    (v_op_a, v_org_a, 'Op A', v_et_a, v_lead2, v_vend_a2, 20),
    (v_op_b, v_org_b, 'Op B', v_et_b, v_lead_b, v_user_b, 20);

  INSERT INTO public.crm_etapa_criterios (id, organization_id, etapa_id, nombre, orden, obligatorio, activo) VALUES
    (v_crit_a, v_org_a, v_et_a, 'TEST Criterio A', 1, true, true),
    (v_crit_b, v_org_b, v_et_b, 'TEST Criterio B', 1, true, true);

  -- ===== A) convertir_lead_rpc =====

  -- A1 · vendedor propietario: camino feliz.
  PERFORM pg_temp.as_user(v_vend_a);
  v_res := public.convertir_lead_rpc(v_lead1, false, NULL, 'Op del vendedor', 100, 'MXN', NULL);
  PERFORM pg_temp.assert((v_res->>'oportunidad_id') IS NOT NULL, 'A1: el vendedor propietario debe poder convertir su lead');
  PERFORM pg_temp.assert((v_res->>'creado') = 'true', 'A1: la conversión debe crear la oportunidad');

  -- A1b · idempotencia: segunda llamada devuelve el mismo id sin crear.
  PERFORM pg_temp.assert(
    (public.convertir_lead_rpc(v_lead1, false, NULL, 'Op del vendedor', 100, 'MXN', NULL)->>'oportunidad_id')
      = (v_res->>'oportunidad_id'),
    'A1b: la conversión debe ser idempotente');

  -- A2 · vendedor ajeno al lead.
  PERFORM pg_temp.espera_lc(
    format('SELECT public.convertir_lead_rpc(%L, false, NULL, %L, 0, %L, NULL)', v_lead2, 'Op ajena', 'MXN'),
    'LC_LEAD_AJENO', 'A2 vendedor ajeno');

  -- A3 · miembro sin rol CRM (viewer).
  PERFORM pg_temp.as_user(v_viewer);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.convertir_lead_rpc(%L, false, NULL, %L, 0, %L, NULL)', v_lead3, 'Op viewer', 'MXN'),
    'LC_ROL_SIN_PERMISO_CRM', 'A3 viewer sin permiso CRM');

  -- A4 · rol global admin_org degradado por la membership a viewer.
  PERFORM pg_temp.as_user(v_degradado);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.convertir_lead_rpc(%L, false, NULL, %L, 0, %L, NULL)', v_lead4, 'Op degradada', 'MXN'),
    'LC_ROL_SIN_PERMISO_CRM', 'A4 membership degradada gana al rol global');

  -- A5 · usuario de otra organización.
  PERFORM pg_temp.as_user(v_user_b);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.convertir_lead_rpc(%L, false, NULL, %L, 0, %L, NULL)', v_lead5, 'Op cross-org', 'MXN'),
    'LC_ORG_AJENA', 'A5 otra organización');

  -- A6 · lead inexistente (sin filtrar datos).
  PERFORM pg_temp.espera_lc(
    format('SELECT public.convertir_lead_rpc(%L, false, NULL, %L, 0, %L, NULL)', gen_random_uuid(), 'Op fantasma', 'MXN'),
    'LC_LEAD_NO_ENCONTRADO', 'A6 lead inexistente');

  PERFORM pg_temp.as_postgres();

  -- ===== B) crm_oportunidades: origen vivo y same-org =====

  -- B1 · INSERT con lead de otra organización.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_oportunidades (organization_id, nombre, etapa_id, lead_id) VALUES (%L, %L, %L, %L)',
           v_org_a, 'Op lead cross', v_et_a, v_lead_b),
    'LC_CRM_LEAD_AJENO', 'B1 lead cross-org');

  -- B2 · INSERT con lead inexistente.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_oportunidades (organization_id, nombre, etapa_id, lead_id) VALUES (%L, %L, %L, %L)',
           v_org_a, 'Op lead fantasma', v_et_a, gen_random_uuid()),
    'LC_CRM_LEAD_AJENO', 'B2 lead inexistente');

  -- B3 · UPDATE de organization_id deja el origen fuera de la organización.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_oportunidades SET organization_id = %L WHERE id = %L', v_org_b, v_op_a),
    'LC_CRM_LEAD_AJENO', 'B3 cambio de organization_id');

  -- ===== C) criterios y cumplimiento =====

  -- C1 · criterio apuntando a etapa de otra organización.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_etapa_criterios (organization_id, etapa_id, nombre, orden) VALUES (%L, %L, %L, 9)',
           v_org_a, v_et_b, 'Criterio cross'),
    'LC_ETAPA_AJENA', 'C1 criterio cross-org');

  -- C2 · criterio apuntando a etapa inexistente.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_etapa_criterios (organization_id, etapa_id, nombre, orden) VALUES (%L, %L, %L, 9)',
           v_org_a, gen_random_uuid(), 'Criterio fantasma'),
    'LC_ETAPA_AJENA', 'C2 etapa inexistente');

  -- C3 · UPDATE de organization_id del criterio.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_etapa_criterios SET organization_id = %L WHERE id = %L', v_org_b, v_crit_a),
    'LC_ETAPA_AJENA', 'C3 criterio cambia de organización');

  -- C4 · cumplimiento con oportunidad de otra organización.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_oportunidad_criterios (organization_id, oportunidad_id, criterio_id) VALUES (%L, %L, %L)',
           v_org_a, v_op_b, v_crit_a),
    'LC_OPORTUNIDAD_AJENA', 'C4 cumplimiento con oportunidad cross-org');

  -- C5 · cumplimiento con criterio de otra organización.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_oportunidad_criterios (organization_id, oportunidad_id, criterio_id) VALUES (%L, %L, %L)',
           v_org_a, v_op_a, v_crit_b),
    'LC_CRITERIO_AJENO', 'C5 cumplimiento con criterio cross-org');

  -- C6 · cumplimiento con criterio inactivo.
  UPDATE public.crm_etapa_criterios SET activo = false WHERE id = v_crit_a;
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_oportunidad_criterios (organization_id, oportunidad_id, criterio_id) VALUES (%L, %L, %L)',
           v_org_a, v_op_a, v_crit_a),
    'LC_CRITERIO_AJENO', 'C6 criterio inactivo');
  UPDATE public.crm_etapa_criterios SET activo = true WHERE id = v_crit_a;

  -- C7 · camino feliz same-org.
  INSERT INTO public.crm_oportunidad_criterios (organization_id, oportunidad_id, criterio_id)
  VALUES (v_org_a, v_op_a, v_crit_a);

  -- ===== D) comentarios =====

  -- D1 · comentario a oportunidad de otra organización.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_comentarios_oportunidad (organization_id, oportunidad_id, autor_id, autor_email, texto) VALUES (%L, %L, %L, %L, %L)',
           v_org_a, v_op_b, v_vend_a, 'vend-a@test.local', 'cross'),
    'LC_OPORTUNIDAD_AJENA', 'D1 comentario cross-org');

  -- D2 · comentario a oportunidad inexistente.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_comentarios_oportunidad (organization_id, oportunidad_id, autor_id, autor_email, texto) VALUES (%L, %L, %L, %L, %L)',
           v_org_a, gen_random_uuid(), v_vend_a, 'vend-a@test.local', 'fantasma'),
    'LC_OPORTUNIDAD_AJENA', 'D2 comentario a oportunidad inexistente');

  -- D3 · camino feliz same-org: comentario + notificación al vendedor.
  INSERT INTO public.crm_comentarios_oportunidad (organization_id, oportunidad_id, autor_id, autor_email, texto)
  VALUES (v_org_a, v_op_a, v_vend_a, 'vend-a@test.local', 'Comentario válido');
  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM public.crm_notificaciones
             WHERE organization_id = v_org_a AND user_id = v_vend_a2
               AND tipo = 'comentario_oportunidad'),
    'D3: el comentario same-org debe notificar al vendedor de la oportunidad');

  -- D4 · comentario a oportunidad soft-deleted.
  UPDATE public.crm_oportunidades SET deleted_at = now() WHERE id = v_op_a;
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_comentarios_oportunidad (organization_id, oportunidad_id, autor_id, autor_email, texto) VALUES (%L, %L, %L, %L, %L)',
           v_org_a, v_op_a, v_vend_a, 'vend-a@test.local', 'borrada'),
    'LC_OPORTUNIDAD_AJENA', 'D4 comentario a oportunidad eliminada');

  RAISE NOTICE 'crm_cross_org_convertir_lead OK · 6 casos de autorización + 10 candados cross-org.';
END $$;

ROLLBACK;
