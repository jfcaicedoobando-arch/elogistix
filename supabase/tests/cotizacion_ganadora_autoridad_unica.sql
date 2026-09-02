-- =============================================================
-- cotizacion_ganadora_autoridad_unica.sql · v13.823.57
--
-- Congela la autoridad transaccional única cotización terminal → oportunidad
-- ganada (trigger BEFORE `zz_crm_cerrar_oportunidad_desde_cotizacion`):
--   A) Primera aceptación: etapa ganada, probabilidad 100, valor_real,
--      ganadora, una auditoría `oportunidad_ganada_auto` y una notificación.
--   B) Reintento con la misma ganadora y Aceptada → En operación: sólo
--      sincroniza el embarque ganador, sin duplicar auditoría/notificación.
--   C) Segunda cotización de la misma oportunidad: LC_COTIZACION_GANADORA_EXISTE
--      y ninguna escritura parcial.
--   D) Re-cotizar y re-aceptar la misma ganadora: nuevo valor + auditoría
--      `oportunidad_ganada_revalorada`, sin segunda notificación.
--   E) Oportunidad perdida: LC_OPORTUNIDAD_PERDIDA_REQUIERE_REAPERTURA.
--   F) La ganadora no puede cambiar de oportunidad ni de organización
--      (LC_COTIZACION_GANADORA_INMUTABLE) ni apuntar cross-org
--      (LC_OPORTUNIDAD_AJENA).
--   G) Papelera: conserva ganadora, valor_real y versión aceptada.
--   H) Índice parcial de respaldo: una sola cotización viva terminal por
--      (organization_id, oportunidad_id).
--   I) Invariantes: SECURITY DEFINER + search_path, sin `WHEN OTHERS`, sin
--      EXECUTE para PUBLIC/anon/authenticated.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/cotizacion_ganadora_autoridad_unica.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- El RAISE de "operación permitida" vive FUERA del bloque EXCEPTION: dentro se
-- atraparía a sí mismo y aprobaría el caso (falso verde).
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
  v_org_a uuid := 'cc57cc57-0000-4000-8000-00000000000a';
  v_org_b uuid := 'cc57cc57-0000-4000-8000-00000000000b';
  v_et_ab_a uuid := 'cc57cc57-0000-4000-8000-000000000101';
  v_et_ga_a uuid := 'cc57cc57-0000-4000-8000-000000000102';
  v_et_pe_a uuid := 'cc57cc57-0000-4000-8000-000000000103';
  v_et_ab_b uuid := 'cc57cc57-0000-4000-8000-000000000111';
  v_et_ga_b uuid := 'cc57cc57-0000-4000-8000-000000000112';
  v_cli_a uuid := 'cc57cc57-0000-4000-8000-000000000201';
  v_op1 uuid := 'cc57cc57-0000-4000-8000-000000000301';  -- feliz
  v_op2 uuid := 'cc57cc57-0000-4000-8000-000000000302';  -- perdida
  v_op3 uuid := 'cc57cc57-0000-4000-8000-000000000303';  -- destino de cambio
  v_op_b uuid := 'cc57cc57-0000-4000-8000-000000000311';  -- otra organización
  v_c1 uuid := 'cc57cc57-0000-4000-8000-000000000401';
  v_c2 uuid := 'cc57cc57-0000-4000-8000-000000000402';
  v_c3 uuid := 'cc57cc57-0000-4000-8000-000000000403';
  v_emb uuid := 'cc57cc57-0000-4000-8000-000000000501';
  v_motivo uuid := 'cc57cc57-0000-4000-8000-000000000601';
  v_lead_b uuid := 'cc57cc57-0000-4000-8000-000000000701';
  r record;
BEGIN
  -- ===== Fixture =====
  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org_a, 'TEST COT ORG A'), (v_org_b, 'TEST COT ORG B');

  INSERT INTO public.crm_etapas_pipeline (id, organization_id, nombre, tipo, orden, probabilidad_default, sla_dias) VALUES
    (v_et_ab_a, v_org_a, 'TEST Abierta A', 'abierta', 81, 20, 7),
    (v_et_ga_a, v_org_a, 'TEST Ganada A', 'ganada', 82, 100, 7),
    (v_et_pe_a, v_org_a, 'TEST Perdida A', 'perdida', 83, 0, 7),
    (v_et_ab_b, v_org_b, 'TEST Abierta B', 'abierta', 81, 20, 7),
    (v_et_ga_b, v_org_b, 'TEST Ganada B', 'ganada', 82, 100, 7);

  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
    (v_cli_a, v_org_a, 'TEST Cliente COT A', 'cot-cli-a@test.local');

  INSERT INTO public.crm_leads (id, organization_id, empresa, estado) VALUES
    (v_lead_b, v_org_b, 'Lead B COT', 'Calificado');

  INSERT INTO public.crm_motivos_perdida (id, organization_id, nombre) VALUES
    (v_motivo, v_org_a, 'TEST Precio');

  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, cliente_id, probabilidad, motivo_perdida_id, lead_id) VALUES
    (v_op1, v_org_a, 'Op feliz', v_et_ab_a, v_cli_a, 20, NULL, NULL),
    (v_op2, v_org_a, 'Op perdida', v_et_pe_a, v_cli_a, 0, v_motivo, NULL),
    (v_op3, v_org_a, 'Op destino', v_et_ab_a, v_cli_a, 20, NULL, NULL),
    (v_op_b, v_org_b, 'Op ajena', v_et_ab_b, NULL, 20, NULL, v_lead_b);

  INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, cliente_id, oportunidad_id, estado, subtotal, version)
  VALUES
    (v_c1, v_org_a, 'TEST-COT-0001', 'Marítimo', 'Importación', v_cli_a, v_op1, 'Enviada', 1000, 1),
    (v_c2, v_org_a, 'TEST-COT-0002', 'Marítimo', 'Importación', v_cli_a, v_op1, 'Enviada', 2000, 1),
    (v_c3, v_org_a, 'TEST-COT-0003', 'Marítimo', 'Importación', v_cli_a, v_op2, 'Enviada', 3000, 1);

  -- ===== A) Primera aceptación =====
  UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_c1;

  -- El alta de la organización siembra un pipeline por omisión, así que la
  -- etapa ganada elegida puede ser la sembrada: se valida el TIPO, no el id.
  SELECT o.*, e.tipo AS etapa_tipo INTO r
    FROM public.crm_oportunidades o
    JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
   WHERE o.id = v_op1;
  PERFORM pg_temp.assert(r.etapa_tipo = 'ganada'::crm_etapa_tipo,
    'A: la oportunidad debe quedar en una etapa ganada');
  PERFORM pg_temp.assert(r.probabilidad = 100, 'A: la probabilidad debe quedar en 100');
  PERFORM pg_temp.assert(r.valor_real = 1000, 'A: valor_real debe tomar el subtotal de la ganadora');
  PERFORM pg_temp.assert(r.cotizacion_ganadora_id = v_c1, 'A: debe sellarse la cotización ganadora');
  PERFORM pg_temp.assert(r.fecha_cierre_real IS NOT NULL, 'A: debe fijarse la fecha de cierre real');

  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.bitacora_actividad
      WHERE entidad_id = v_op1 AND accion = 'oportunidad_ganada_auto') = 1,
    'A: exactamente una auditoría oportunidad_ganada_auto');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_notificaciones
      WHERE organization_id = v_org_a AND tipo = 'oportunidad_ganada') <= 1,
    'A: a lo más una notificación de oportunidad ganada');

  PERFORM pg_temp.assert(
    (SELECT version_aceptada FROM public.cotizaciones WHERE id = v_c1) = 1
    AND (SELECT aceptada_en FROM public.cotizaciones WHERE id = v_c1) IS NOT NULL,
    'A: la primera transición terminal sella versión y fecha de aceptación');

  -- ===== B1) Reintento idempotente con la misma ganadora =====
  UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_c1;
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.bitacora_actividad
      WHERE entidad_id = v_op1 AND accion = 'oportunidad_ganada_auto') = 1,
    'B1: el reintento no debe duplicar la auditoría');
  PERFORM pg_temp.assert(
    (SELECT valor_real FROM public.crm_oportunidades WHERE id = v_op1) = 1000,
    'B1: el reintento no cambia el monto');

  -- ===== C) Segunda cotización de la misma oportunidad =====
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.cotizaciones SET estado = ''Aceptada'' WHERE id = %L', v_c2),
    'LC_COTIZACION_GANADORA_EXISTE', 'C segunda ganadora');
  PERFORM pg_temp.assert(
    (SELECT estado::text FROM public.cotizaciones WHERE id = v_c2) = 'Enviada',
    'C: la segunda cotización no debe quedar aceptada');
  PERFORM pg_temp.assert(
    (SELECT cotizacion_ganadora_id FROM public.crm_oportunidades WHERE id = v_op1) = v_c1,
    'C: la ganadora original se conserva');

  -- ===== D) Re-cotizar y re-aceptar la misma ganadora =====
  UPDATE public.cotizaciones SET estado = 'Borrador' WHERE id = v_c1;
  UPDATE public.cotizaciones SET subtotal = 1500, version = 2 WHERE id = v_c1;
  UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_c1;

  PERFORM pg_temp.assert(
    (SELECT valor_real FROM public.crm_oportunidades WHERE id = v_op1) = 1500,
    'D: re-aceptar actualiza el monto al nuevo subtotal');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.bitacora_actividad
      WHERE entidad_id = v_op1 AND accion = 'oportunidad_ganada_revalorada') = 1,
    'D: debe existir auditoría explícita del cambio de valor');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_notificaciones
      WHERE organization_id = v_org_a AND tipo = 'oportunidad_ganada') <= 1,
    'D: no se duplica la notificación de oportunidad ganada');

  -- ===== B2) Aceptada → En operación: sólo sincroniza el embarque ganador =====
  UPDATE public.cotizaciones SET estado = 'En operación' WHERE id = v_c1;
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.bitacora_actividad
      WHERE entidad_id = v_op1 AND accion = 'oportunidad_ganada_auto') = 1,
    'B2: pasar a En operación no duplica la auditoría');
  PERFORM pg_temp.assert(
    (SELECT valor_real FROM public.crm_oportunidades WHERE id = v_op1) = 1500,
    'B2: el monto histórico no cambia al pasar a En operación');

  -- ===== E) Oportunidad perdida =====
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.cotizaciones SET estado = ''Aceptada'' WHERE id = %L', v_c3),
    'LC_OPORTUNIDAD_PERDIDA_REQUIERE_REAPERTURA', 'E oportunidad perdida');
  PERFORM pg_temp.assert(
    (SELECT e.tipo FROM public.crm_oportunidades o
       JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
      WHERE o.id = v_op2) = 'perdida'::crm_etapa_tipo,
    'E: la oportunidad perdida no cambia de etapa');

  -- ===== F) Inmutabilidad de la ganadora =====
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.cotizaciones SET oportunidad_id = %L WHERE id = %L', v_op3, v_c1),
    'LC_COTIZACION_GANADORA_INMUTABLE', 'F cambio de oportunidad');
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.cotizaciones SET organization_id = %L WHERE id = %L', v_org_b, v_c1),
    'LC_COTIZACION_GANADORA_INMUTABLE', 'F cambio de organización');
  PERFORM pg_temp.assert(
    (SELECT oportunidad_id FROM public.cotizaciones WHERE id = v_c1) = v_op1,
    'F: la fila conserva su oportunidad original');

  -- Cross-org directo: una cotización de A no puede cerrar una oportunidad de B.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.cotizaciones SET oportunidad_id = %L WHERE id = %L', v_op_b, v_c2),
    'LC_OPORTUNIDAD_AJENA', 'F cross-org');

  -- ===== G) Papelera conserva la historia =====
  UPDATE public.cotizaciones SET deleted_at = now() WHERE id = v_c1;
  SELECT o.*, NULL::crm_etapa_tipo AS etapa_tipo INTO r
    FROM public.crm_oportunidades o WHERE o.id = v_op1;
  PERFORM pg_temp.assert(r.cotizacion_ganadora_id = v_c1, 'G: la Papelera conserva la ganadora');
  PERFORM pg_temp.assert(r.valor_real = 1500, 'G: la Papelera conserva valor_real');

  -- ===== H) Índice parcial de respaldo =====
  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM pg_indexes
             WHERE schemaname = 'public' AND tablename = 'cotizaciones'
               AND indexname = 'ux_cotizaciones_ganadora_viva_por_oportunidad'),
    'H: debe existir el índice único parcial de respaldo');

  -- ===== I) Invariantes de la autoridad única =====
  SELECT p.prosecdef AS secdef, p.proconfig::text AS cfg, p.prosrc AS src
    INTO r
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'crm_cerrar_oportunidad_desde_cotizacion';
  PERFORM pg_temp.assert(r.secdef, 'I: la función debe ser SECURITY DEFINER');
  PERFORM pg_temp.assert(r.cfg ILIKE '%search_path%', 'I: debe fijar search_path');
  PERFORM pg_temp.assert(r.src !~* 'WHEN\s+OTHERS', 'I: prohibido EXCEPTION WHEN OTHERS');

  PERFORM pg_temp.assert(
    NOT has_function_privilege('anon', 'public.crm_cerrar_oportunidad_desde_cotizacion()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.crm_cerrar_oportunidad_desde_cotizacion()', 'EXECUTE'),
    'I: anon/authenticated no deben poder ejecutar la función del trigger');

  PERFORM pg_temp.assert(
    NOT EXISTS (
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'cotizaciones'
         AND t.tgname IN ('trg_cotizacion_acepta_oportunidad',
                          'trg_cotizacion_cierra_oportunidad',
                          'trg_crm_set_valor_real_on_aceptada')),
    'I: los tres triggers competidores deben estar ausentes');

  RAISE NOTICE 'cotizacion_ganadora_autoridad_unica OK';
END
$$;

ROLLBACK;
