-- =============================================================
-- cotizacion_ganadora_autoridad_unica.sql · v13.823.58
--
-- Congela la autoridad transaccional única cotización terminal → oportunidad
-- ganada (trigger BEFORE `zz_crm_cerrar_oportunidad_desde_cotizacion`):
--   A) Primera aceptación: etapa ganada, probabilidad 100, valor_real,
--      ganadora, EXACTAMENTE una auditoría `oportunidad_ganada_auto` y
--      EXACTAMENTE una notificación al vendedor real de la oportunidad.
--   B) Reintento con la misma ganadora y Aceptada → En operación: sólo
--      sincroniza el embarque ganador (embarque real), sin duplicar
--      auditoría/notificación ni mover el monto.
--   C) Segunda cotización de la misma oportunidad: LC_COTIZACION_GANADORA_EXISTE
--      y ninguna escritura parcial.
--   D) Re-cotizar revirtiendo el estado está cerrado por el guard de estados
--      (LC_COT_TRANSICION_INVALIDA): la re-cotización usa versión nueva.
--   E) Oportunidad perdida: LC_OPORTUNIDAD_PERDIDA_REQUIERE_REAPERTURA.
--   F) La ganadora no puede cambiar de oportunidad ni de organización
--      (LC_COTIZACION_GANADORA_INMUTABLE) ni apuntar cross-org
--      (LC_OPORTUNIDAD_AJENA).
--   G) Papelera: conserva ganadora, valor_real y versión aceptada.
--   H) Índice parcial de respaldo: se congela que sea UNIQUE, sobre
--      (organization_id, oportunidad_id) y con el predicado exacto.
--   I) Invariantes: SECURITY DEFINER + search_path, sin `WHEN OTHERS`, sin
--      EXECUTE para PUBLIC/anon/authenticated, timing/eventos/columnas exactas
--      del trigger canónico y ausencia de los tres triggers viejos.
--   J) v13.823.58 — `aceptar_cotizacion_version` llamada DOS veces por RPC:
--      la segunda devuelve éxito idempotente (`sin_cambios=true`) sin
--      reescribir sellos ni duplicar auditoría.
--   K) v13.823.58 — sello del backfill legacy coherente con el snapshot
--      elegido cuando la versión viva difiere del último snapshot.
--
-- Concurrencia de dos sesiones: `scripts/ci/concurrencia-cotizacion-ganadora.sh`
-- (necesita dos conexiones, no cabe en esta suite de una sola transacción).
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
  v_op4 uuid := 'cc57cc57-0000-4000-8000-000000000304';  -- RPC idempotente
  v_op5 uuid := 'cc57cc57-0000-4000-8000-000000000305';  -- legacy backfill
  v_op_b uuid := 'cc57cc57-0000-4000-8000-000000000311';  -- otra organización
  v_c1 uuid := 'cc57cc57-0000-4000-8000-000000000401';
  v_c2 uuid := 'cc57cc57-0000-4000-8000-000000000402';
  v_c3 uuid := 'cc57cc57-0000-4000-8000-000000000403';
  v_c4 uuid := 'cc57cc57-0000-4000-8000-000000000404';  -- RPC idempotente
  v_c5 uuid := 'cc57cc57-0000-4000-8000-000000000405';  -- legacy backfill
  v_emb uuid := 'cc57cc57-0000-4000-8000-000000000501';
  v_motivo uuid := 'cc57cc57-0000-4000-8000-000000000601';
  v_lead_b uuid := 'cc57cc57-0000-4000-8000-000000000701';
  v_vend uuid := 'cc57cc57-0000-4000-8000-000000000801';  -- vendedor de la op1
  v_acept uuid := 'cc57cc57-0000-4000-8000-000000000802'; -- quien acepta por RPC
  v_snap_at timestamptz := now() - interval '90 days';
  v_res jsonb;
  v_res2 jsonb;
  v_sello record;
  r record;
BEGIN
  -- ===== Fixture =====
  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org_a, 'TEST COT ORG A'), (v_org_b, 'TEST COT ORG B');

  -- Usuarios de fixture: en CI sin GoTrue `auth.users` puede no aceptar altas.
  BEGIN
    INSERT INTO public.crm_etapas_pipeline (id, organization_id, nombre, tipo, orden, probabilidad_default, sla_dias) VALUES
      (v_et_ab_a, v_org_a, 'TEST Abierta A', 'abierta', 81, 20, 7),
      (v_et_ga_a, v_org_a, 'TEST Ganada A', 'ganada', 82, 100, 7),
      (v_et_pe_a, v_org_a, 'TEST Perdida A', 'perdida', 83, 0, 7),
      (v_et_ab_b, v_org_b, 'TEST Abierta B', 'abierta', 81, 20, 7),
      (v_et_ga_b, v_org_b, 'TEST Ganada B', 'ganada', 82, 100, 7);
  END;

  -- En CI/sandbox sin permisos sobre `auth` esta alta no es indispensable:
  -- `vendedor_id` y `user_id` de las notificaciones no tienen FK a auth.users.
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      (v_vend, 'cot-vend-a@test.local'),
      (v_acept, 'cot-acepta-a@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN NULL;
  END;

  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
    (v_org_a, v_vend, 'vendedor'),
    (v_org_a, v_acept, 'gerente_comercial')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
    (v_cli_a, v_org_a, 'TEST Cliente COT A', 'cot-cli-a@test.local');

  INSERT INTO public.crm_leads (id, organization_id, empresa, estado) VALUES
    (v_lead_b, v_org_b, 'Lead B COT', 'Calificado');

  INSERT INTO public.crm_motivos_perdida (id, organization_id, nombre) VALUES
    (v_motivo, v_org_a, 'TEST Precio');

  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, cliente_id, probabilidad, motivo_perdida_id, lead_id, vendedor_id) VALUES
    (v_op1, v_org_a, 'Op feliz', v_et_ab_a, v_cli_a, 20, NULL, NULL, v_vend),
    (v_op2, v_org_a, 'Op perdida', v_et_pe_a, v_cli_a, 0, v_motivo, NULL, NULL),
    (v_op3, v_org_a, 'Op destino', v_et_ab_a, v_cli_a, 20, NULL, NULL, NULL),
    (v_op4, v_org_a, 'Op RPC', v_et_ab_a, v_cli_a, 20, NULL, NULL, NULL),
    (v_op5, v_org_a, 'Op legacy', v_et_ga_a, v_cli_a, 100, NULL, NULL, NULL),
    (v_op_b, v_org_b, 'Op ajena', v_et_ab_b, NULL, 20, NULL, v_lead_b, NULL);

  INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, cliente_id, oportunidad_id, estado, subtotal, version)
  VALUES
    (v_c1, v_org_a, 'TEST-COT-0001', 'Marítimo', 'Importación', v_cli_a, v_op1, 'Enviada', 1000, 1),
    (v_c2, v_org_a, 'TEST-COT-0002', 'Marítimo', 'Importación', v_cli_a, v_op1, 'Enviada', 2000, 1),
    (v_c3, v_org_a, 'TEST-COT-0003', 'Marítimo', 'Importación', v_cli_a, v_op2, 'Enviada', 3000, 1),
    (v_c4, v_org_a, 'TEST-COT-0004', 'Marítimo', 'Importación', v_cli_a, v_op4, 'Enviada', 4000, 1);

  -- Embarque real para la propagación de `embarque_ganador_id`.
  INSERT INTO public.embarques (id, organization_id, cliente_id, expediente, modo, tipo, estado)
  VALUES (v_emb, v_org_a, v_cli_a, 'ELTCO0001', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 'En Tránsito'::public.estado_embarque);

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
  -- Sin `<= 1`: la oportunidad tiene vendedor real, así que la notificación
  -- DEBE existir y ser única (una prueba con `<= 1` pasaría con cero).
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_notificaciones
      WHERE organization_id = v_org_a AND tipo = 'oportunidad_ganada'
        AND user_id = v_vend) = 1,
    'A: exactamente una notificación de oportunidad ganada al vendedor');

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
    (SELECT count(*) FROM public.crm_notificaciones
      WHERE organization_id = v_org_a AND tipo = 'oportunidad_ganada'
        AND user_id = v_vend) = 1,
    'B1: el reintento no debe duplicar la notificación');
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

  -- ===== D) Re-cotizar la ganadora: variante cerrada por el guard de estado =====
  -- `guard_estado_cotizacion` no permite Aceptada/En operación → Borrador: la
  -- re-cotización se hace con una versión nueva, nunca revirtiendo el estado.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.cotizaciones SET estado = ''Borrador'' WHERE id = %L', v_c1),
    'LC_COT_TRANSICION_INVALIDA', 'D reversión directa a Borrador');
  PERFORM pg_temp.assert(
    (SELECT valor_real FROM public.crm_oportunidades WHERE id = v_op1) = 1000,
    'D: el monto histórico se conserva');

  -- ===== B2) Aceptada → En operación con embarque real =====
  UPDATE public.cotizaciones SET estado = 'En operación', embarque_id = v_emb WHERE id = v_c1;
  SELECT o.* INTO r FROM public.crm_oportunidades o WHERE o.id = v_op1;
  PERFORM pg_temp.assert(r.embarque_ganador_id = v_emb,
    'B2: el embarque ganador debe llenarse con el embarque de la cotización');
  PERFORM pg_temp.assert(r.valor_real = 1000,
    'B2: el monto histórico no cambia al pasar a En operación');
  PERFORM pg_temp.assert(r.cotizacion_ganadora_id = v_c1,
    'B2: la ganadora sigue siendo la misma');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.bitacora_actividad
      WHERE entidad_id = v_op1
        AND accion IN ('oportunidad_ganada_auto','oportunidad_ganada_vinculada','oportunidad_ganada_revalorada')) = 1,
    'B2: pasar a En operación no duplica eventos de cierre');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.crm_notificaciones
      WHERE organization_id = v_org_a AND tipo = 'oportunidad_ganada'
        AND user_id = v_vend) = 1,
    'B2: sigue existiendo exactamente una notificación');
  PERFORM pg_temp.assert(
    (SELECT version_aceptada FROM public.cotizaciones WHERE id = v_c1) = 1,
    'B2: el sello de versión aceptada no se reescribe');

  -- ===== J) RPC `aceptar_cotizacion_version` llamada dos veces =====
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_acept, 'email', 'cot-acepta-a@test.local')::text, true);

  v_res := public.aceptar_cotizacion_version(v_c4);
  PERFORM pg_temp.assert(COALESCE((v_res ->> 'sin_cambios')::boolean, true) = false,
    'J: la primera aceptación por RPC reporta sin_cambios=false');
  PERFORM pg_temp.assert((v_res ->> 'version_aceptada')::int = 1,
    'J: la primera aceptación devuelve la versión sellada');
  SELECT version_aceptada, aceptada_en, aceptada_por, estado::text AS estado INTO v_sello
    FROM public.cotizaciones WHERE id = v_c4;
  PERFORM pg_temp.assert(v_sello.estado = 'Aceptada', 'J: la cotización queda Aceptada');

  -- Segundo llamado = respuesta de red perdida: éxito idempotente.
  v_res2 := public.aceptar_cotizacion_version(v_c4);
  PERFORM pg_temp.assert((v_res2 ->> 'sin_cambios')::boolean = true,
    'J: el reintento por RPC devuelve sin_cambios=true');
  PERFORM pg_temp.assert((v_res2 ->> 'version_aceptada')::int = (v_res ->> 'version_aceptada')::int,
    'J: el reintento devuelve la misma versión aceptada');
  PERFORM pg_temp.assert((v_res2 ->> 'origen_aceptacion') = (v_res ->> 'origen_aceptacion'),
    'J: el reintento devuelve el mismo origen de aceptación');
  PERFORM pg_temp.assert(
    (SELECT aceptada_en = v_sello.aceptada_en
        AND aceptada_por = v_sello.aceptada_por
        AND version_aceptada = v_sello.version_aceptada
       FROM public.cotizaciones WHERE id = v_c4),
    'J: el reintento no reescribe el sello de aceptación');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.bitacora_actividad
      WHERE entidad_id = v_c4 AND accion = 'cotizacion.aceptada_version_fijada') = 1,
    'J: exactamente una auditoría de aceptación de versión');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.bitacora_actividad
      WHERE entidad_id = v_op4 AND accion = 'oportunidad_ganada_auto') = 1,
    'J: exactamente una auditoría de cierre de oportunidad');
  PERFORM pg_temp.assert(
    (SELECT valor_real FROM public.crm_oportunidades WHERE id = v_op4) = 4000,
    'J: el reintento no cambia valor_real');

  PERFORM set_config('request.jwt.claims', NULL, true);

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
  -- El cambio de organización lo ataja antes el guard de tenencia
  -- `_cotizacion_oportunidad_misma_org` (corre antes que `zz_`): basta con que
  -- quede bloqueado con un LC de dominio, no importa cuál de los dos gana.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.cotizaciones SET organization_id = %L WHERE id = %L', v_org_b, v_c1),
    'LC_OPORTUNIDAD_AJENA', 'F cambio de organización');
  PERFORM pg_temp.assert(
    (SELECT oportunidad_id FROM public.cotizaciones WHERE id = v_c1) = v_op1,
    'F: la fila conserva su oportunidad original');

  -- Cross-org directo: una cotización de A no puede cerrar una oportunidad de B.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.cotizaciones SET oportunidad_id = %L WHERE id = %L', v_op_b, v_c2),
    'LC_OPORTUNIDAD_AJENA', 'F cross-org');

  -- ===== K) Sello legacy coherente con el snapshot elegido =====
  -- Legacy: versión viva 3, único snapshot version_num = 1. El sello incoherente
  -- (version_aceptada = version viva) debe corregirse al número y fecha DEL
  -- SNAPSHOT, nunca al subtotal/versión vivos. La sentencia es la misma que
  -- aplica la migración v13.823.58.
  INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, cliente_id,
    oportunidad_id, estado, subtotal, version, version_aceptada, aceptada_en)
  VALUES (v_c5, v_org_a, 'TEST-COT-0005', 'Marítimo', 'Importación', v_cli_a,
          NULL, 'Enviada', 1578, 3, NULL, NULL);
  INSERT INTO public.cotizacion_versiones (cotizacion_id, organization_id, version_num,
    folio, estado_al_snapshot, snapshot, costos_snapshot, created_at)
  VALUES (v_c5, v_org_a, 1, 'TEST-COT-0005', 'Enviada',
          jsonb_build_object('subtotal', 1798.48), '[]'::jsonb, v_snap_at);
  UPDATE public.cotizaciones
     SET oportunidad_id = v_op5, estado = 'Aceptada', version_aceptada = 3, aceptada_en = now()
   WHERE id = v_c5;
  UPDATE public.crm_oportunidades SET valor_real = 1798.48 WHERE id = v_op5;

  UPDATE public.cotizaciones c
     SET version_aceptada = 1,
         aceptada_en = v_snap_at,
         updated_at = now()
   WHERE c.id = v_c5
     AND c.organization_id = v_org_a
     AND c.version_aceptada = c.version
     AND c.version_aceptada IS DISTINCT FROM 1;

  SELECT version_aceptada, aceptada_en INTO v_sello FROM public.cotizaciones WHERE id = v_c5;
  PERFORM pg_temp.assert(v_sello.version_aceptada = 1,
    'K: version_aceptada debe sellarse con el version_num del snapshot elegido');
  PERFORM pg_temp.assert(v_sello.aceptada_en = v_snap_at,
    'K: aceptada_en debe sellarse con el created_at del snapshot elegido');
  PERFORM pg_temp.assert(
    (SELECT valor_real FROM public.crm_oportunidades WHERE id = v_op5) = 1798.48,
    'K: el monto histórico del snapshot se conserva (nunca el subtotal vivo)');

  -- ===== G) Papelera conserva la historia =====
  UPDATE public.cotizaciones SET deleted_at = now() WHERE id = v_c1;
  SELECT o.*, NULL::crm_etapa_tipo AS etapa_tipo INTO r
    FROM public.crm_oportunidades o WHERE o.id = v_op1;
  PERFORM pg_temp.assert(r.cotizacion_ganadora_id = v_c1, 'G: la Papelera conserva la ganadora');
  PERFORM pg_temp.assert(r.valor_real = 1000, 'G: la Papelera conserva valor_real');

  -- ===== H) Índice parcial de respaldo: metadatos exactos =====
  SELECT i.indisunique AS es_unico,
         pg_get_expr(i.indpred, i.indrelid) AS predicado,
         (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
            FROM unnest(i.indkey::int[]) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum) AS columnas
    INTO r
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'ux_cotizaciones_ganadora_viva_por_oportunidad';
  PERFORM pg_temp.assert(r.es_unico IS TRUE, 'H: el índice de respaldo debe ser UNIQUE');
  PERFORM pg_temp.assert(r.columnas = 'organization_id,oportunidad_id',
    'H: el índice debe ser sobre (organization_id, oportunidad_id)');
  -- v13.823.59: comparación COMPLETA del predicado normalizado (los ILIKE
  -- parciales aprobaban reglas distintas). Cualquier cambio de predicado
  -- —agregar estados, quitar deleted_at, etc.— rompe esta aserción.
  PERFORM pg_temp.assert(
    regexp_replace(r.predicado, '\s+', ' ', 'g') =
      '((deleted_at IS NULL) AND (oportunidad_id IS NOT NULL) AND '
      || '(estado = ANY (ARRAY[''Aceptada''::estado_cotizacion, ''En operación''::estado_cotizacion])))',
    'H: el predicado debe ser exactamente deleted_at IS NULL AND oportunidad_id IS NOT NULL '
    || 'AND estado IN (Aceptada, En operación); recibido: ' || COALESCE(r.predicado, '<nulo>'));

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

  -- Timing/eventos/columnas exactas del trigger canónico.
  SELECT t.tgtype,
         (SELECT string_agg(a.attname, ',' ORDER BY a.attname)
            FROM unnest(t.tgattr::int[]) AS col(attnum)
            JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = col.attnum) AS cols
    INTO r
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'cotizaciones'
     AND t.tgname = 'zz_crm_cerrar_oportunidad_desde_cotizacion';
  PERFORM pg_temp.assert(r.tgtype IS NOT NULL, 'I: debe existir el trigger canónico');
  PERFORM pg_temp.assert((r.tgtype & 1) = 1, 'I: el trigger debe ser FOR EACH ROW');
  PERFORM pg_temp.assert((r.tgtype & 2) = 2, 'I: el trigger debe ser BEFORE');
  PERFORM pg_temp.assert((r.tgtype & 4) = 4, 'I: el trigger debe cubrir INSERT');
  PERFORM pg_temp.assert((r.tgtype & 16) = 16, 'I: el trigger debe cubrir UPDATE');
  PERFORM pg_temp.assert((r.tgtype & 8) = 0, 'I: el trigger no debe cubrir DELETE');
  PERFORM pg_temp.assert(
    r.cols = 'deleted_at,embarque_id,estado,oportunidad_id,organization_id',
    'I: UPDATE OF debe limitarse a estado, embarque_id, oportunidad_id, organization_id y deleted_at');

  PERFORM pg_temp.assert(
    NOT EXISTS (
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'cotizaciones'
         AND t.tgname IN ('trg_cotizacion_acepta_oportunidad',
                          'trg_cotizacion_cierra_oportunidad',
                          'trg_crm_set_valor_real_on_aceptada')),
    'I: los tres triggers competidores deben estar ausentes');

  -- La RPC de aceptación debe conservar el lock y devolver `sin_cambios`.
  SELECT p.prosrc AS src INTO r
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'aceptar_cotizacion_version';
  PERFORM pg_temp.assert(r.src ILIKE '%FOR UPDATE%', 'I: la RPC debe bloquear la fila');
  PERFORM pg_temp.assert(r.src ILIKE '%sin_cambios%', 'I: la RPC debe reportar sin_cambios');
  PERFORM pg_temp.assert(r.src ILIKE '%LC_COTIZACION_ACEPTACION_INCONSISTENTE%',
    'I: la RPC debe fallar cerrado ante un enlace ganador inconsistente');

  RAISE NOTICE 'cotizacion_ganadora_autoridad_unica OK';
END
$$;

ROLLBACK;
