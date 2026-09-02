-- =============================================================
-- crm_actividad_entidad_tenant.sql · v13.823.56
--
-- Congela la microcorrección de integridad/reloj de crm_actividades:
--   A) Guard polimórfico: la entidad ligada (lead/oportunidad/cliente/contacto)
--      debe existir, estar viva y ser de la misma organización, tanto al
--      INSERT como al UPDATE de organization_id/entidad_tipo/entidad_id.
--      Rechazo con LC_CRM_ACTIVIDAD_ENTIDAD_AJENA (mensaje único).
--   B) Reloj de movimiento: sólo el alta de una actividad de oportunidad y la
--      transición fecha_completada NULL → valor refrescan
--      crm_oportunidades.ultimo_movimiento_at.
--   C) Higiene: caso contractual de 3 oportunidades abiertas ⇒ seguimiento
--      oportuno 0.3333, vencidas = 1, sin próxima actividad = 1.
--   D) Schema invariant: funciones SECURITY DEFINER con search_path fijo, sin
--      EXECUTE para PUBLIC/anon/authenticated, y triggers con el alcance
--      exacto de columnas (no se ensancha el UPDATE OF).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/crm_actividad_entidad_tenant.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- Espera un error cuyo mensaje contenga `_codigo`. El RAISE de "operación
-- permitida" va FUERA del bloque EXCEPTION: si estuviera dentro se atraparía a
-- sí mismo y aprobaría el caso (falso verde).
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
  LC text := 'LC_CRM_ACTIVIDAD_ENTIDAD_AJENA';
  v_org_a uuid := 'bb22bb22-0000-4000-8000-00000000000a';
  v_org_b uuid := 'bb22bb22-0000-4000-8000-00000000000b';
  v_adm_a uuid := 'bb22bb22-0000-4000-8000-000000000201';
  v_et_a  uuid := 'bb22bb22-0000-4000-8000-000000000101';
  v_et_b  uuid := 'bb22bb22-0000-4000-8000-000000000111';
  -- Entidades vivas de A
  v_lead_a uuid := 'bb22bb22-0000-4000-8000-000000000301';
  v_op_a   uuid := 'bb22bb22-0000-4000-8000-000000000401';
  v_cli_a  uuid := 'bb22bb22-0000-4000-8000-000000000501';
  v_con_a  uuid := 'bb22bb22-0000-4000-8000-000000000601';
  -- Entidades soft-deleted de A
  v_lead_a_del uuid := 'bb22bb22-0000-4000-8000-000000000302';
  v_op_a_del   uuid := 'bb22bb22-0000-4000-8000-000000000402';
  v_cli_a_del  uuid := 'bb22bb22-0000-4000-8000-000000000502';
  v_con_a_del  uuid := 'bb22bb22-0000-4000-8000-000000000602';
  -- Entidades de B
  v_lead_b uuid := 'bb22bb22-0000-4000-8000-000000000311';
  v_op_b   uuid := 'bb22bb22-0000-4000-8000-000000000411';
  v_cli_b  uuid := 'bb22bb22-0000-4000-8000-000000000511';
  v_con_b  uuid := 'bb22bb22-0000-4000-8000-000000000611';
  -- Oportunidades del caso contractual de higiene
  v_h1 uuid := 'bb22bb22-0000-4000-8000-000000000701';
  v_h2 uuid := 'bb22bb22-0000-4000-8000-000000000702';
  v_h3 uuid := 'bb22bb22-0000-4000-8000-000000000703';
  v_act uuid;
  -- El reloj se mide por versión de fila (ctid): dentro de una transacción
  -- now() es constante, así que comparar timestamps no distingue "se tocó la
  -- oportunidad" de "no se tocó". Un UPDATE sí crea una nueva versión de fila.
  v_ver_a tid;
  v_ver_b tid;

  v_n integer;
  v_ins text;
  r record;
  v_tipos text[] := ARRAY['lead', 'oportunidad', 'cliente', 'contacto'];
  v_tipo text;
  v_vivo uuid;
  v_borrado uuid;
  v_ajeno uuid;
BEGIN
  -- ===== Fixture =====
  -- No se simulan usuarios: los guards y el reloj se validan sobre la sesión
  -- del dueño (aplican también a service_role) y el caso de higiene se aísla
  -- retirando el resto de oportunidades abiertas dentro de esta transacción.
  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org_a, 'TEST ACT ORG A'), (v_org_b, 'TEST ACT ORG B');


  INSERT INTO public.crm_etapas_pipeline (id, organization_id, nombre, tipo, orden, probabilidad_default, sla_dias) VALUES
    (v_et_a, v_org_a, 'TEST Abierta A', 'abierta', 91, 20, 7),
    (v_et_b, v_org_b, 'TEST Abierta B', 'abierta', 91, 20, 7);

  INSERT INTO public.crm_leads (id, organization_id, empresa, estado) VALUES
    (v_lead_a, v_org_a, 'Lead A vivo', 'Calificado'),
    (v_lead_a_del, v_org_a, 'Lead A borrado', 'Calificado'),
    (v_lead_b, v_org_b, 'Lead B', 'Calificado');
  UPDATE public.crm_leads SET deleted_at = now() WHERE id = v_lead_a_del;

  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
    (v_cli_a, v_org_a, 'TEST Cliente A', 'act-cli-a@test.local'),
    (v_cli_a_del, v_org_a, 'TEST Cliente A borrado', 'act-cli-a-del@test.local'),
    (v_cli_b, v_org_b, 'TEST Cliente B', 'act-cli-b@test.local');
  UPDATE public.clientes SET deleted_at = now() WHERE id = v_cli_a_del;

  INSERT INTO public.contactos_cliente (id, organization_id, cliente_id, nombre, email) VALUES
    (v_con_a, v_org_a, v_cli_a, 'Contacto A', 'act-con-a@test.local'),
    (v_con_a_del, v_org_a, v_cli_a, 'Contacto A borrado', 'act-con-a-del@test.local'),
    (v_con_b, v_org_b, v_cli_b, 'Contacto B', 'act-con-b@test.local');

  UPDATE public.contactos_cliente SET deleted_at = now() WHERE id = v_con_a_del;

  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, lead_id, probabilidad) VALUES
    (v_op_a, v_org_a, 'Op A', v_et_a, v_lead_a, 20),
    (v_op_a_del, v_org_a, 'Op A borrada', v_et_a, v_lead_a, 20),
    (v_h1, v_org_a, 'Op higiene sin actividad', v_et_a, v_lead_a, 20),
    (v_h2, v_org_a, 'Op higiene vencida', v_et_a, v_lead_a, 20),
    (v_h3, v_org_a, 'Op higiene futura', v_et_a, v_lead_a, 20),
    (v_op_b, v_org_b, 'Op B', v_et_b, v_lead_b, 20);
  UPDATE public.crm_oportunidades SET deleted_at = now() WHERE id = v_op_a_del;

  -- ===== A) Guard polimórfico por tipo =====
  FOREACH v_tipo IN ARRAY v_tipos LOOP
    SELECT CASE v_tipo
             WHEN 'lead' THEN v_lead_a WHEN 'oportunidad' THEN v_op_a
             WHEN 'cliente' THEN v_cli_a ELSE v_con_a END,
           CASE v_tipo
             WHEN 'lead' THEN v_lead_a_del WHEN 'oportunidad' THEN v_op_a_del
             WHEN 'cliente' THEN v_cli_a_del ELSE v_con_a_del END,
           CASE v_tipo
             WHEN 'lead' THEN v_lead_b WHEN 'oportunidad' THEN v_op_b
             WHEN 'cliente' THEN v_cli_b ELSE v_con_b END
      INTO v_vivo, v_borrado, v_ajeno;

    v_ins := 'INSERT INTO public.crm_actividades (organization_id, tipo, asunto, entidad_tipo, entidad_id) VALUES (%L, %L, %L, %L, %L)';

    -- Feliz: entidad viva de la misma organización.
    EXECUTE format(v_ins, v_org_a, 'nota', 'OK ' || v_tipo, v_tipo, v_vivo);
    PERFORM pg_temp.assert(
      (SELECT count(*) FROM public.crm_actividades
        WHERE organization_id = v_org_a AND entidad_tipo = v_tipo::public.crm_entidad_tipo
          AND entidad_id = v_vivo) = 1,
      format('A-%s: la actividad same-org viva debe permitirse', v_tipo));

    -- Cross-org, inexistente y soft-deleted: rechazados con el LC exacto.
    PERFORM pg_temp.espera_lc(format(v_ins, v_org_a, 'nota', 'X', v_tipo, v_ajeno), LC,
      format('A-%s cross-org', v_tipo));
    PERFORM pg_temp.espera_lc(format(v_ins, v_org_a, 'nota', 'X', v_tipo, gen_random_uuid()), LC,
      format('A-%s inexistente', v_tipo));
    PERFORM pg_temp.espera_lc(format(v_ins, v_org_a, 'nota', 'X', v_tipo, v_borrado), LC,
      format('A-%s soft-deleted', v_tipo));

    PERFORM pg_temp.assert(
      (SELECT count(*) FROM public.crm_actividades WHERE asunto = 'X') = 0,
      format('A-%s: ningún rechazo debe dejar la actividad', v_tipo));
    PERFORM pg_temp.assert(
      (SELECT count(*) FROM public.crm_actividades WHERE organization_id = v_org_b) = 0,
      format('A-%s: la organización ajena no debe recibir actividades', v_tipo));
  END LOOP;

  -- Entidad ajena intacta (la oportunidad de B no fue tocada).
  SELECT ultimo_movimiento_at INTO v_mov_b FROM public.crm_oportunidades WHERE id = v_op_b;

  -- ===== A') UPDATE de las tres columnas vigiladas =====
  SELECT id INTO v_act FROM public.crm_actividades
   WHERE organization_id = v_org_a AND entidad_tipo = 'lead' AND entidad_id = v_lead_a;

  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_actividades SET organization_id = %L WHERE id = %L', v_org_b, v_act),
    LC, 'A6 UPDATE organization_id');
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_actividades SET entidad_id = %L WHERE id = %L', v_lead_b, v_act),
    LC, 'A7 UPDATE entidad_id cross-org');
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_actividades SET entidad_tipo = %L WHERE id = %L', 'cliente', v_act),
    LC, 'A8 UPDATE entidad_tipo incoherente');

  SELECT count(*) INTO v_n FROM public.crm_actividades
   WHERE id = v_act AND organization_id = v_org_a
     AND entidad_tipo = 'lead' AND entidad_id = v_lead_a;
  PERFORM pg_temp.assert(v_n = 1, 'A6-A8: la fila original debe conservarse intacta');

  -- Editar otros campos de una actividad NO dispara el guard (alcance exacto
  -- del UPDATE OF): así el historial ligado a entidades ya borradas sigue
  -- editable.
  INSERT INTO public.crm_actividades (organization_id, tipo, asunto, entidad_tipo, entidad_id)
  VALUES (v_org_a, 'nota', 'Historia', 'lead', v_lead_a) RETURNING id INTO v_act;
  UPDATE public.crm_leads SET deleted_at = now() WHERE id = v_lead_a;
  UPDATE public.crm_actividades SET resultado = 'editado' WHERE id = v_act;
  PERFORM pg_temp.assert(
    (SELECT resultado FROM public.crm_actividades WHERE id = v_act) = 'editado',
    'A9: editar resultado de una actividad histórica no debe bloquearse');
  UPDATE public.crm_leads SET deleted_at = NULL WHERE id = v_lead_a;

  -- ===== B) Reloj de movimiento =====
  UPDATE public.crm_oportunidades SET ultimo_movimiento_at = now() - interval '30 days'
   WHERE id IN (v_op_a, v_op_b);
  SELECT ultimo_movimiento_at INTO v_mov_a FROM public.crm_oportunidades WHERE id = v_op_a;
  SELECT ultimo_movimiento_at INTO v_mov_b FROM public.crm_oportunidades WHERE id = v_op_b;

  INSERT INTO public.crm_actividades (organization_id, tipo, asunto, entidad_tipo, entidad_id, fecha_programada)
  VALUES (v_org_a, 'llamada', 'Reloj', 'oportunidad', v_op_a, now() + interval '2 days')
  RETURNING id INTO v_act;

  PERFORM pg_temp.assert(
    (SELECT ultimo_movimiento_at FROM public.crm_oportunidades WHERE id = v_op_a) > v_mov_a,
    'B1: el alta de actividad debe refrescar la oportunidad propia');
  PERFORM pg_temp.assert(
    (SELECT ultimo_movimiento_at FROM public.crm_oportunidades WHERE id = v_op_b) = v_mov_b,
    'B1: el alta de actividad no debe tocar oportunidades de otra organización');

  -- Editar notas/resultado o reprogramar NO rejuvenece el SLA.
  UPDATE public.crm_oportunidades SET ultimo_movimiento_at = now() - interval '30 days'
   WHERE id = v_op_a;
  SELECT ultimo_movimiento_at INTO v_mov_a FROM public.crm_oportunidades WHERE id = v_op_a;
  UPDATE public.crm_actividades SET resultado = 'llamada sin éxito', descripcion = 'nota'
   WHERE id = v_act;
  UPDATE public.crm_actividades SET fecha_programada = now() + interval '5 days' WHERE id = v_act;
  PERFORM pg_temp.assert(
    (SELECT ultimo_movimiento_at FROM public.crm_oportunidades WHERE id = v_op_a) = v_mov_a,
    'B2: editar notas/resultado o posponer no debe refrescar el SLA');

  -- Completar sí refresca.
  UPDATE public.crm_actividades SET fecha_completada = now() WHERE id = v_act;
  PERFORM pg_temp.assert(
    (SELECT ultimo_movimiento_at FROM public.crm_oportunidades WHERE id = v_op_a) > v_mov_a,
    'B3: completar la actividad debe refrescar la oportunidad');

  -- Un segundo UPDATE de fecha_completada ya con valor no es transición.
  UPDATE public.crm_oportunidades SET ultimo_movimiento_at = now() - interval '30 days'
   WHERE id = v_op_a;
  SELECT ultimo_movimiento_at INTO v_mov_a FROM public.crm_oportunidades WHERE id = v_op_a;
  UPDATE public.crm_actividades SET fecha_completada = now() WHERE id = v_act;
  PERFORM pg_temp.assert(
    (SELECT ultimo_movimiento_at FROM public.crm_oportunidades WHERE id = v_op_a) = v_mov_a,
    'B4: recompletar una actividad ya completada no debe refrescar el SLA');

  -- ===== C) Caso contractual de higiene (3 abiertas) =====
  -- Aislamiento: se retiran por soft-delete (no DELETE físico) TODAS las demás
  -- oportunidades abiertas, incluidas las de A) y B). El cambio nunca se
  -- confirma (ROLLBACK final) y por MVCC ninguna otra sesión lo ve, así que la
  -- suite sigue siendo autocontenida y paralelizable.
  UPDATE public.crm_oportunidades o SET deleted_at = now()
   WHERE o.deleted_at IS NULL
     AND o.id NOT IN (v_h1, v_h2, v_h3)
     AND EXISTS (SELECT 1 FROM public.crm_etapas_pipeline e
                  WHERE e.id = o.etapa_id AND e.tipo = 'abierta');

  -- h2: actividad vencida (programada en el pasado, sin completar).
  INSERT INTO public.crm_actividades (organization_id, tipo, asunto, entidad_tipo, entidad_id, fecha_programada)
  VALUES (v_org_a, 'llamada', 'Vencida', 'oportunidad', v_h2, now() - interval '3 days');
  -- h3: actividad futura.
  INSERT INTO public.crm_actividades (organization_id, tipo, asunto, entidad_tipo, entidad_id, fecha_programada)
  VALUES (v_org_a, 'llamada', 'Futura', 'oportunidad', v_h3, now() + interval '3 days');

  -- h1 y h3 dentro del SLA (7 días); h2 fuera del SLA ⇒ estado 'vencida'.
  UPDATE public.crm_oportunidades SET ultimo_movimiento_at = now() - interval '1 day'
   WHERE id IN (v_h1, v_h3);
  UPDATE public.crm_oportunidades SET ultimo_movimiento_at = now() - interval '20 days'
   WHERE id = v_h2;

  SELECT * INTO r FROM public.crm_higiene_pipeline();
  PERFORM pg_temp.assert(r.abiertas = 3,
    format('C1: se esperaban 3 abiertas y llegaron %s', r.abiertas));
  PERFORM pg_temp.assert(r.seguimiento_oportuno_pct = 0.3333,
    format('C2: seguimiento oportuno debía ser 0.3333 y fue %s', r.seguimiento_oportuno_pct));
  PERFORM pg_temp.assert(r.vencidas = 1,
    format('C3: vencidas debía ser 1 y fue %s', r.vencidas));
  PERFORM pg_temp.assert(r.sin_actividad_programada = 1,
    format('C4: sin próxima actividad debía ser 1 y fue %s', r.sin_actividad_programada));


  -- ===== D) Schema invariant: definición, ACL y alcance del trigger =====
  PERFORM pg_temp.assert(
    (SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=public'])
       FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('_crm_actividad_entidad_misma_org', '_crm_actividad_toca_oportunidad')),
    'D1: ambas funciones deben ser SECURITY DEFINER con search_path fijo');

  PERFORM pg_temp.assert(
    NOT EXISTS (
      SELECT 1 FROM pg_proc p, unnest(ARRAY['anon', 'authenticated', 'public']) g
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname IN ('_crm_actividad_entidad_misma_org', '_crm_actividad_toca_oportunidad')
         AND has_function_privilege(g, p.oid, 'EXECUTE')),
    'D2: PUBLIC/anon/authenticated no deben poder ejecutar las funciones del guard');

  PERFORM pg_temp.assert(
    (SELECT count(*) FROM pg_trigger t
      WHERE t.tgrelid = 'public.crm_actividades'::regclass
        AND t.tgname = 'trg_crm_actividad_entidad_misma_org'
        AND NOT t.tgisinternal
        AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
               FROM unnest(t.tgattr) c JOIN pg_attribute a
                 ON a.attrelid = t.tgrelid AND a.attnum = c)
            = ARRAY['entidad_id', 'entidad_tipo', 'organization_id']) = 1,
    'D3: el guard debe vigilar exactamente organization_id, entidad_tipo y entidad_id');

  PERFORM pg_temp.assert(
    (SELECT count(*) FROM pg_trigger t
      WHERE t.tgrelid = 'public.crm_actividades'::regclass
        AND t.tgname = 'trg_crm_actividad_toca_oportunidad'
        AND NOT t.tgisinternal
        AND (SELECT array_agg(a.attname::text)
               FROM unnest(t.tgattr) c JOIN pg_attribute a
                 ON a.attrelid = t.tgrelid AND a.attnum = c)
            = ARRAY['fecha_completada']) = 1,
    'D4: el toque de oportunidad debe dispararse sólo por fecha_completada');

  PERFORM pg_temp.assert(
    (SELECT position('EXCEPTION WHEN OTHERS' in upper(prosrc)) = 0
       FROM pg_proc WHERE pronamespace = 'public'::regnamespace
        AND proname = '_crm_actividad_toca_oportunidad'),
    'D5: el toque de oportunidad no debe silenciar errores');

  RAISE NOTICE 'crm_actividad_entidad_tenant: OK';
END;
$$;

ROLLBACK;
