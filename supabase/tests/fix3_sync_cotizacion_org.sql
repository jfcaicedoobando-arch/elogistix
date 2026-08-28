-- =============================================================
-- fix3_sync_cotizacion_org.sql · FIX3 tanda 3 (Ronda-2 P3)
--
-- sync_cotizacion_embarque_link valida ahora que la cotización
-- pertenezca a la MISMA organización del embarque:
--   1. Vínculo cross-tenant (embarque org A ← cotización org B) →
--      rechazado con LC_COTIZACION_OTRA_ORG (23514) y la cotización
--      ajena queda intacta.
--   2. Vínculo mismo-org sigue funcionando (embarque_id asignado;
--      con embarque fuera de Borrador la cotización pasa a En operación).
--   3. Papelera: si un dato corrupto ya ligó una cotización de otra org,
--      el soft-delete del embarque NO la toca (no-op cross-tenant), y sí
--      libera la cotización de la misma org.
--
-- NOTA (fuera de alcance, reportado): la liberación de papelera de una
-- cotización en 'En operación' choca con guard_estado_cotizacion
-- (LC_COT_TRANSICION_INVALIDA: En operación → Aceptada no está permitido
-- por la máquina de estados) — conflicto pre-existente entre O2.10 y la
-- RG de transiciones, no introducido por este fix. Por eso el CASO 3b usa
-- una cotización que permanece en 'Aceptada' (embarque en Borrador).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_sync_cotizacion_org.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org_a uuid := 'cc3cc3cc-0000-4000-8000-0000000000a1';
  v_org_b uuid := 'cc3cc3cc-0000-4000-8000-0000000000b1';
  v_cli_a uuid := 'cc3cc3cc-0000-4000-8000-0000000000a2';
  v_cli_b uuid := 'cc3cc3cc-0000-4000-8000-0000000000b2';
  v_cot_b uuid := 'cc3cc3cc-0000-4000-8000-0000000000b3';
  v_cot_a uuid := 'cc3cc3cc-0000-4000-8000-0000000000a3';
  v_cot_a2 uuid := 'cc3cc3cc-0000-4000-8000-0000000000a6';
  v_emb_a uuid := 'cc3cc3cc-0000-4000-8000-0000000000a4';
  v_emb_b uuid := 'cc3cc3cc-0000-4000-8000-0000000000a5';
  v_emb_c uuid := 'cc3cc3cc-0000-4000-8000-0000000000a7';
  v_estado public.estado_cotizacion;
  v_emb_link uuid;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org_a, 'TEST FIX3 SYNC A'), (v_org_b, 'TEST FIX3 SYNC B');
  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
    (v_cli_a, v_org_a, 'Cliente A', 'sync-cot-a@test.mx'),
    (v_cli_b, v_org_b, 'Cliente B', 'sync-cot-b@test.mx');

  INSERT INTO public.cotizaciones (id, organization_id, cliente_id, estado, folio, modo, tipo, conceptos_venta)
  VALUES (v_cot_b, v_org_b, v_cli_b, 'Aceptada'::public.estado_cotizacion, 'COT-FIX3-B1',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, '[]'::jsonb),
         (v_cot_a, v_org_a, v_cli_a, 'Aceptada'::public.estado_cotizacion, 'COT-FIX3-A1',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, '[]'::jsonb),
         (v_cot_a2, v_org_a, v_cli_a, 'Aceptada'::public.estado_cotizacion, 'COT-FIX3-A2',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, '[]'::jsonb);

  INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, estado)
  VALUES (v_emb_a, v_org_a, v_cli_a, 'Marítimo', 'Importación', 'Confirmado'::public.estado_embarque),
         (v_emb_b, v_org_a, v_cli_a, 'Marítimo', 'Importación', 'Confirmado'::public.estado_embarque),
         (v_emb_c, v_org_a, v_cli_a, 'Marítimo', 'Importación', 'Borrador'::public.estado_embarque);

  -- ----------------------------------------------------------
  -- CASO 1: vínculo cross-tenant → rechazo 23514, cotización B intacta.
  -- ----------------------------------------------------------
  BEGIN
    UPDATE public.embarques SET cotizacion_id = v_cot_b WHERE id = v_emb_a;
    RAISE EXCEPTION 'FIX3 SYNC FAIL: el vínculo cross-tenant NO fue rechazado';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM NOT LIKE 'LC_COTIZACION_OTRA_ORG%' THEN
        RAISE EXCEPTION 'FIX3 SYNC FAIL: se esperaba LC_COTIZACION_OTRA_ORG y vino: %', SQLERRM;
      END IF;
  END;

  SELECT estado, embarque_id INTO v_estado, v_emb_link
    FROM public.cotizaciones WHERE id = v_cot_b;
  PERFORM pg_temp.assert(
    v_estado = 'Aceptada'::public.estado_cotizacion AND v_emb_link IS NULL,
    'CASO 1: la cotización de la org B fue modificada por el intento cross-tenant');
  RAISE NOTICE 'CASO 1 OK · vínculo cross-tenant rechazado (LC_COTIZACION_OTRA_ORG).';

  -- ----------------------------------------------------------
  -- CASO 2: vínculo mismo-org → embarque_id asignado + En operación
  -- (embarque fuera de Borrador), y en Borrador sólo vincula.
  -- ----------------------------------------------------------
  UPDATE public.embarques SET cotizacion_id = v_cot_a WHERE id = v_emb_a;
  SELECT estado, embarque_id INTO v_estado, v_emb_link
    FROM public.cotizaciones WHERE id = v_cot_a;
  PERFORM pg_temp.assert(
    v_emb_link = v_emb_a AND v_estado = 'En operación'::public.estado_cotizacion,
    'CASO 2: el vínculo legítimo mismo-org se rompió');

  UPDATE public.embarques SET cotizacion_id = v_cot_a2 WHERE id = v_emb_c;
  SELECT estado, embarque_id INTO v_estado, v_emb_link
    FROM public.cotizaciones WHERE id = v_cot_a2;
  PERFORM pg_temp.assert(
    v_emb_link = v_emb_c AND v_estado = 'Aceptada'::public.estado_cotizacion,
    'CASO 2b: el vínculo con embarque en Borrador debía conservar Aceptada');
  RAISE NOTICE 'CASO 2 OK · vínculo mismo-org intacto (con y sin transición de estado).';

  -- ----------------------------------------------------------
  -- CASO 3: papelera con dato corrupto cross-tenant → no-op sobre org B.
  -- (Se siembra el vínculo corrupto directo sobre cotizaciones — el trigger
  --  vive sobre embarques, así que esto simula el dato legado ya dañado.
  --  Se deja en 'Aceptada' para no pelear con la máquina de estados — el
  --  punto del caso es el filtro de org, no la transición.)
  -- ----------------------------------------------------------
  UPDATE public.cotizaciones
     SET embarque_id = v_emb_b
   WHERE id = v_cot_b;

  UPDATE public.embarques SET deleted_at = now() WHERE id = v_emb_b;

  SELECT estado, embarque_id INTO v_estado, v_emb_link
    FROM public.cotizaciones WHERE id = v_cot_b;
  PERFORM pg_temp.assert(
    v_emb_link = v_emb_b AND v_estado = 'Aceptada'::public.estado_cotizacion,
    'CASO 3: la papelera del embarque tocó una cotización de OTRA org');

  -- Sanity: la papelera sí libera la cotización de la MISMA org.
  UPDATE public.embarques SET deleted_at = now() WHERE id = v_emb_c;
  SELECT estado, embarque_id INTO v_estado, v_emb_link
    FROM public.cotizaciones WHERE id = v_cot_a2;
  PERFORM pg_temp.assert(
    v_emb_link IS NULL AND v_estado = 'Aceptada'::public.estado_cotizacion,
    'CASO 3b: la papelera ya no libera la cotización propia');
  RAISE NOTICE 'CASO 3 OK · papelera acotada a la org (no-op cross-tenant, libera la propia).';
END $$;

ROLLBACK;
