-- =============================================================
-- fix4_n1_papelera_cotizacion_en_operacion.sql · FIX4 tanda 4 (N-1)
--
-- La papelera de un embarque cuya cotización ligada está 'En operación'
-- ya NO aborta con LC_COT_TRANSICION_INVALIDA: sync_cotizacion_embarque_link
-- levanta la GUC transaccional app.liberando_papelera y
-- guard_estado_cotizacion admite sólo esa reversión ('En operación' →
-- 'Aceptada') con la GUC puesta.
--
--   CASO 1: soft-delete del embarque libera la cotización (vuelve a
--           'Aceptada', embarque_id = NULL) sin excepción.
--   CASO 2: la reversión 'En operación' → 'Aceptada' SIN la GUC sigue
--           prohibida (UPDATE directo → LC_COT_TRANSICION_INVALIDA).
--   CASO 3: con la GUC puesta, otra transición inválida ('En operación'
--           → 'Enviada') sigue rechazada — la GUC no es un bypass general.
--
-- Pre-fix (f102b5f) el CASO 1 muerde: el UPDATE a deleted_at aborta con
-- LC_COT_TRANSICION_INVALIDA (bug reproducido en vivo).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix4_n1_papelera_cotizacion_en_operacion.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org   uuid := 'dd4dd4dd-0000-4000-8000-0000000000a1';
  v_cli   uuid := 'dd4dd4dd-0000-4000-8000-0000000000a2';
  v_cot   uuid := 'dd4dd4dd-0000-4000-8000-0000000000a3';
  v_cot2  uuid := 'dd4dd4dd-0000-4000-8000-0000000000a4';
  v_emb   uuid := 'dd4dd4dd-0000-4000-8000-0000000000a5';
  v_estado public.estado_cotizacion;
  v_emb_link uuid;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'TEST FIX4 N1');
  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES (v_cli, v_org, 'Cliente N1', 'fix4-n1@test.mx');

  INSERT INTO public.cotizaciones (id, organization_id, cliente_id, estado, folio, modo, tipo, conceptos_venta)
  VALUES (v_cot,  v_org, v_cli, 'Aceptada'::public.estado_cotizacion, 'COT-FIX4-N1-1',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, '[]'::jsonb),
         (v_cot2, v_org, v_cli, 'Aceptada'::public.estado_cotizacion, 'COT-FIX4-N1-2',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, '[]'::jsonb);

  INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, estado)
  VALUES (v_emb, v_org, v_cli, 'Marítimo', 'Importación', 'Confirmado'::public.estado_embarque);

  -- Vínculo: embarque fuera de Borrador → cotización pasa a 'En operación'.
  UPDATE public.embarques SET cotizacion_id = v_cot WHERE id = v_emb;
  SELECT estado INTO v_estado FROM public.cotizaciones WHERE id = v_cot;
  PERFORM pg_temp.assert(
    v_estado = 'En operación'::public.estado_cotizacion,
    'SETUP: la cotización no llegó a En operación al vincular el embarque');

  -- ----------------------------------------------------------
  -- CASO 1: papelera del embarque → la cotización vuelve a 'Aceptada'.
  -- ----------------------------------------------------------
  UPDATE public.embarques SET deleted_at = now() WHERE id = v_emb;

  SELECT estado, embarque_id INTO v_estado, v_emb_link
    FROM public.cotizaciones WHERE id = v_cot;
  PERFORM pg_temp.assert(
    v_estado = 'Aceptada'::public.estado_cotizacion AND v_emb_link IS NULL,
    'CASO 1: la papelera no revirtió la cotización a Aceptada / no la desligó');
  RAISE NOTICE 'CASO 1 OK · papelera con cotización En operación ya no aborta (reversión a Aceptada).';

  -- ----------------------------------------------------------
  -- CASO 2: la reversión directa (sin GUC) sigue prohibida.
  -- ----------------------------------------------------------
  UPDATE public.cotizaciones SET estado = 'En operación'::public.estado_cotizacion
   WHERE id = v_cot2;  -- Aceptada → En operación: transición válida del flujo
  BEGIN
    UPDATE public.cotizaciones SET estado = 'Aceptada'::public.estado_cotizacion
     WHERE id = v_cot2;
    RAISE EXCEPTION 'FIX4 N1 FAIL: En operación → Aceptada directa NO fue rechazada';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'LC_COT_TRANSICION_INVALIDA%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'CASO 2 OK · reversión directa sin GUC sigue rechazada (LC_COT_TRANSICION_INVALIDA).';

  -- ----------------------------------------------------------
  -- CASO 3: la GUC sólo abre En operación → Aceptada, nada más.
  -- ----------------------------------------------------------
  PERFORM set_config('app.liberando_papelera', 'on', true);
  BEGIN
    UPDATE public.cotizaciones SET estado = 'Rechazada'::public.estado_cotizacion
     WHERE id = v_cot2;
    RAISE EXCEPTION 'FIX4 N1 FAIL: con la GUC puesta se permitió En operación → Rechazada';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'LC_COT_TRANSICION_INVALIDA%' THEN RAISE; END IF;
  END;
  PERFORM set_config('app.liberando_papelera', 'off', true);
  RAISE NOTICE 'CASO 3 OK · la GUC no habilita otras transiciones inválidas.';

  RAISE NOTICE 'FIX4 N1 OK · 3/3 casos.';
END $$;

ROLLBACK;
