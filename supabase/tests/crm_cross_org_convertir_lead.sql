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
-- éxito abortan la suite. El RAISE de "operación permitida" va FUERA del bloque
-- EXCEPTION: si estuviera dentro, se atraparía a sí mismo y —como su texto
-- incluye el LC_* esperado— aprobaría el caso (falso verde).
CREATE OR REPLACE FUNCTION pg_temp.espera_lc(_sql text, _codigo text, _caso text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_msg text;
  v_permitido boolean := false;
BEGIN
  BEGIN
    EXECUTE _sql;
    v_permitido := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF position(_codigo in v_msg) = 0 THEN
      RAISE EXCEPTION 'FALLO %: se esperaba % y llegó «%»', _caso, _codigo, v_msg;
    END IF;
  END;

  IF v_permitido THEN
    RAISE EXCEPTION 'FALLO %: se esperaba % y la operación fue permitida', _caso, _codigo;
  END IF;
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
  v_crit_a2 uuid := 'aa11aa11-0000-4000-8000-000000000502';
  v_crit_b uuid := 'aa11aa11-0000-4000-8000-000000000511';
  v_lead6 uuid := 'aa11aa11-0000-4000-8000-000000000306';
  v_lead7 uuid := 'aa11aa11-0000-4000-8000-000000000307';
  v_cli_a uuid := 'aa11aa11-0000-4000-8000-000000000601';
  v_cli_a_borrado uuid := 'aa11aa11-0000-4000-8000-000000000602';
  v_cli_b uuid := 'aa11aa11-0000-4000-8000-000000000611';
  v_lead_b2 uuid := 'aa11aa11-0000-4000-8000-000000000312';
  v_cumpl_id uuid;
  v_coment_id uuid;
  v_n integer;
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
    (v_org_a, v_viewer, 'customer_service'),
    -- Rol global histórico alto, membership efectiva degradada a viewer.
    (v_org_a, v_degradado, 'customer_service'),
    (v_org_b, v_user_b, 'admin_org');

  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_vend_a, 'vendedor'), (v_vend_a2, 'vendedor'), (v_viewer, 'customer_service'),
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
    (v_lead6, v_org_a, 'Lead service', 'Calificado', v_vend_a),
    (v_lead7, v_org_a, 'Lead borrado', 'Calificado', v_vend_a),
    (v_lead_b, v_org_b, 'Lead B', 'Calificado', v_user_b),
    (v_lead_b2, v_org_b, 'Lead B sin oportunidad', 'Calificado', v_user_b);

  UPDATE public.crm_leads SET deleted_at = now() WHERE id = v_lead7;

  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
    (v_cli_a, v_org_a, 'TEST Cliente A', 'cli-a@test.local'),
    (v_cli_a_borrado, v_org_a, 'TEST Cliente A borrado', 'cli-a-del@test.local'),
    (v_cli_b, v_org_b, 'TEST Cliente B', 'cli-b@test.local');
  UPDATE public.clientes SET deleted_at = now() WHERE id = v_cli_a_borrado;

  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, lead_id, vendedor_id, probabilidad) VALUES
    (v_op_a, v_org_a, 'Op A', v_et_a, v_lead2, v_vend_a2, 20),
    (v_op_b, v_org_b, 'Op B', v_et_b, v_lead_b, v_user_b, 20);

  INSERT INTO public.crm_etapa_criterios (id, organization_id, etapa_id, nombre, orden, obligatorio, activo) VALUES
    (v_crit_a, v_org_a, v_et_a, 'TEST Criterio A', 1, true, true),
    (v_crit_a2, v_org_a, v_et_a, 'TEST Criterio A2', 2, false, true),
    (v_crit_b, v_org_b, v_et_b, 'TEST Criterio B', 1, true, true);

  -- ===== A) convertir_lead_rpc =====

  -- A0 · JWT con role=authenticated pero SIN sub: sesión rota ⇒ nada se toca.
  SELECT count(*) INTO v_n FROM public.crm_oportunidades WHERE organization_id = v_org_a;
  PERFORM pg_temp.as_authenticated_sin_uid();
  PERFORM pg_temp.espera_lc(
    format('SELECT public.convertir_lead_rpc(%L, false, NULL, %L, 0, %L, NULL)', v_lead1, 'Op sin sesión', 'MXN'),
    'LC_SESION_REQUERIDA', 'A0 authenticated sin uid');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_oportunidades WHERE organization_id = v_org_a) = v_n,
    'A0: la llamada sin sesión no debe crear oportunidades');
  PERFORM pg_temp.assert(
    (SELECT estado FROM public.crm_leads WHERE id = v_lead1) = 'Calificado'::crm_lead_estado,
    'A0: la llamada sin sesión no debe marcar el prospecto');

  -- A0b · claim service_role sin uid: proceso interno permitido explícitamente.
  PERFORM pg_temp.as_service_role();
  v_res := public.convertir_lead_rpc(v_lead6, false, NULL, 'Op interna', 10, 'MXN', NULL);
  PERFORM pg_temp.assert((v_res->>'oportunidad_id') IS NOT NULL,
    'A0b: el proceso interno (service_role) debe poder convertir sin usuario firmado');

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

  -- A7 · lead soft-deleted: se trata como inexistente.
  PERFORM pg_temp.as_user(v_vend_a);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.convertir_lead_rpc(%L, false, NULL, %L, 0, %L, NULL)', v_lead7, 'Op borrada', 'MXN'),
    'LC_LEAD_NO_ENCONTRADO', 'A7 lead soft-deleted');

  -- A8 · etapa inicial soft-deleted (aunque siga activa): no se selecciona.
  PERFORM pg_temp.as_postgres();
  -- La organización puede tener etapas semilla; se marcan todas las abiertas
  -- como borradas para probar que la RPC honra deleted_at.
  UPDATE public.crm_etapas_pipeline SET deleted_at = now()
   WHERE organization_id = v_org_b AND tipo = 'abierta' AND activa = true;
  PERFORM pg_temp.as_user(v_user_b);
  PERFORM pg_temp.espera_lc(
    format('SELECT public.convertir_lead_rpc(%L, false, NULL, %L, 0, %L, NULL)', v_lead_b2, 'Op etapa borrada', 'MXN'),
    'LC_PIPELINE_SIN_ETAPAS', 'A8 etapa inicial soft-deleted');
  PERFORM pg_temp.as_postgres();
  UPDATE public.crm_etapas_pipeline SET deleted_at = NULL WHERE organization_id = v_org_b;



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
    'LC_ETAPA_AJENA', 'B3 cambio de organization_id');

  -- B4 · camino feliz: cliente vivo de la misma organización.
  INSERT INTO public.crm_oportunidades (organization_id, nombre, etapa_id, cliente_id)
  VALUES (v_org_a, 'Op cliente same-org', v_et_a, v_cli_a);
  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM public.crm_oportunidades
             WHERE organization_id = v_org_a AND cliente_id = v_cli_a),
    'B4: la oportunidad con cliente de la misma organización debe insertarse');

  -- B5 · cliente de otra organización.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_oportunidades (organization_id, nombre, etapa_id, cliente_id) VALUES (%L, %L, %L, %L)',
           v_org_a, 'Op cliente cross', v_et_a, v_cli_b),
    'LC_CRM_CLIENTE_AJENO', 'B5 cliente cross-org');
  PERFORM pg_temp.assert(
    NOT EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE cliente_id = v_cli_b),
    'B5: no debe quedar oportunidad con cliente cross-org');

  -- B6 · cliente inexistente.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_oportunidades (organization_id, nombre, etapa_id, cliente_id) VALUES (%L, %L, %L, %L)',
           v_org_a, 'Op cliente fantasma', v_et_a, gen_random_uuid()),
    'LC_CRM_CLIENTE_AJENO', 'B6 cliente inexistente');

  -- B7 · cliente soft-deleted.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_oportunidades (organization_id, nombre, etapa_id, cliente_id) VALUES (%L, %L, %L, %L)',
           v_org_a, 'Op cliente borrado', v_et_a, v_cli_a_borrado),
    'LC_CRM_CLIENTE_AJENO', 'B7 cliente soft-deleted');
  PERFORM pg_temp.assert(
    NOT EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE cliente_id = v_cli_a_borrado),
    'B7: no debe quedar oportunidad con cliente eliminado');

  -- B8 · lead soft-deleted como origen.
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_oportunidades (organization_id, nombre, etapa_id, lead_id) VALUES (%L, %L, %L, %L)',
           v_org_a, 'Op lead borrado', v_et_a, v_lead7),
    'LC_CRM_LEAD_AJENO', 'B8 lead soft-deleted');
  PERFORM pg_temp.assert(
    NOT EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE lead_id = v_lead7),
    'B8: no debe quedar oportunidad con prospecto eliminado');



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
  VALUES (v_org_a, v_op_a, v_crit_a)
  RETURNING id INTO v_cumpl_id;

  -- C8 · UPDATE del cumplimiento: no puede migrar de organización.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_oportunidad_criterios SET organization_id = %L WHERE id = %L', v_org_b, v_cumpl_id),
    'LC_OPORTUNIDAD_AJENA', 'C8 cumplimiento cambia de organización');
  PERFORM pg_temp.assert(
    (SELECT organization_id FROM public.crm_oportunidad_criterios WHERE id = v_cumpl_id) = v_org_a,
    'C8: el cumplimiento debe conservar su organización');

  -- C9 · UPDATE del cumplimiento apuntando a criterio soft-deleted.
  UPDATE public.crm_etapa_criterios SET deleted_at = now() WHERE id = v_crit_a2;
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_oportunidad_criterios SET criterio_id = %L WHERE id = %L', v_crit_a2, v_cumpl_id),
    'LC_CRITERIO_AJENO', 'C9 cumplimiento a criterio soft-deleted');
  PERFORM pg_temp.assert(
    (SELECT criterio_id FROM public.crm_oportunidad_criterios WHERE id = v_cumpl_id) = v_crit_a,
    'C9: el cumplimiento debe conservar su criterio original');

  -- C10 · UPDATE del cumplimiento a oportunidad de otra organización.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_oportunidad_criterios SET oportunidad_id = %L WHERE id = %L', v_op_b, v_cumpl_id),
    'LC_OPORTUNIDAD_AJENA', 'C10 cumplimiento a oportunidad cross-org');


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
  VALUES (v_org_a, v_op_a, v_vend_a, 'vend-a@test.local', 'Comentario válido')
  RETURNING id INTO v_coment_id;
  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM public.crm_notificaciones
             WHERE organization_id = v_org_a AND user_id = v_vend_a2
               AND tipo = 'comentario_oportunidad'),
    'D3: el comentario same-org debe notificar al vendedor de la oportunidad');

  -- D3b · UPDATE del comentario: ni organización ni oportunidad pueden migrar.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_comentarios_oportunidad SET organization_id = %L WHERE id = %L', v_org_b, v_coment_id),
    'LC_OPORTUNIDAD_AJENA', 'D3b comentario cambia de organización');
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_comentarios_oportunidad SET oportunidad_id = %L WHERE id = %L', v_op_b, v_coment_id),
    'LC_OPORTUNIDAD_AJENA', 'D3b comentario a oportunidad cross-org');
  PERFORM pg_temp.assert(
    (SELECT organization_id = v_org_a AND oportunidad_id = v_op_a
       FROM public.crm_comentarios_oportunidad WHERE id = v_coment_id),
    'D3b: el comentario debe conservar organización y oportunidad');

  -- D4 · comentario a oportunidad soft-deleted.
  UPDATE public.crm_oportunidades SET deleted_at = now() WHERE id = v_op_a;
  PERFORM pg_temp.espera_lc(
    format('INSERT INTO public.crm_comentarios_oportunidad (organization_id, oportunidad_id, autor_id, autor_email, texto) VALUES (%L, %L, %L, %L, %L)',
           v_org_a, v_op_a, v_vend_a, 'vend-a@test.local', 'borrada'),
    'LC_OPORTUNIDAD_AJENA', 'D4 comentario a oportunidad eliminada');

  RAISE NOTICE 'crm_cross_org_convertir_lead OK · sesión/rol en convertir_lead_rpc y candados cross-org de oportunidades, criterios, cumplimientos y comentarios.';

END $$;

ROLLBACK;
