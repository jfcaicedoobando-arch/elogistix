-- =============================================================
-- fix4_n2_portal_proforma_dual.sql · FIX4 tanda 4 (N-2 / N-2b)
--
-- Portal público de proformas tras la multimoneda:
--   CASO 1: proforma con ambos juegos (MXN y USD) → el JSON expone los dos
--           juegos duales y las claves legacy derivan de MXN.
--   CASO 2: proforma sólo-USD (subtotal_mxn = 0) → legacy deriva de USD.
--   CASO 3: ambos subtotales en cero → legacy = MXN con ceros (default).
--   CASO 4 (BL-11 intacto): link expirado → no expone montos ni conceptos,
--           sólo estado y número.
--   CASO 5 (N-2b): portal_responder_por_token end-to-end con actor anónimo
--           → 200 (jsonb con estado_cliente), fila actualizada y bitácora
--           escrita con usuario_id NULL.
--
-- Pre-fix (f102b5f) muerde dos veces: el CASO 1 aborta con 42703 (columna
-- subtotal/moneda inexistente → el 500 del link activo) y el CASO 5 con
-- 23502 (bitacora_actividad.usuario_id NOT NULL con actor anónimo).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix4_n2_portal_proforma_dual.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org   uuid := 'ee5ee5ee-0000-4000-8000-0000000000a1';
  v_cli   uuid := 'ee5ee5ee-0000-4000-8000-0000000000a2';
  v_pf_a  uuid := 'ee5ee5ee-0000-4000-8000-0000000000a3';
  v_pf_b  uuid := 'ee5ee5ee-0000-4000-8000-0000000000a4';
  v_pf_c  uuid := 'ee5ee5ee-0000-4000-8000-0000000000a5';
  v_pf_d  uuid := 'ee5ee5ee-0000-4000-8000-0000000000a6';
  v_tok_a uuid := 'ee5ee5ee-0000-4000-8000-0000000000b3';
  v_tok_b uuid := 'ee5ee5ee-0000-4000-8000-0000000000b4';
  v_tok_c uuid := 'ee5ee5ee-0000-4000-8000-0000000000b5';
  v_tok_d uuid := 'ee5ee5ee-0000-4000-8000-0000000000b6';
  v_j jsonb;
  v_p jsonb;
  v_estado text;
  v_bit integer;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'TEST FIX4 N2');
  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES (v_cli, v_org, 'Cliente N2', 'fix4-n2@test.mx');

  INSERT INTO public.proformas (
    id, organization_id, cliente_id, numero, cliente_nombre, expediente,
    subtotal_mxn, iva_mxn, total_mxn, subtotal_usd, iva_usd, total_usd,
    estado_cliente, token_publico, token_expira_at
  ) VALUES
    (v_pf_a, v_org, v_cli, 'PF-N2-A', 'Cliente N2', 'EXP-N2-A',
     1000, 160, 1160, 200, 32, 232, 'pendiente', v_tok_a, now() + interval '7 days'),
    (v_pf_b, v_org, v_cli, 'PF-N2-B', 'Cliente N2', 'EXP-N2-B',
     0, 0, 0, 500, 80, 580, 'pendiente', v_tok_b, now() + interval '7 days'),
    (v_pf_c, v_org, v_cli, 'PF-N2-C', 'Cliente N2', 'EXP-N2-C',
     0, 0, 0, 0, 0, 0, 'pendiente', v_tok_c, now() + interval '7 days'),
    (v_pf_d, v_org, v_cli, 'PF-N2-D', 'Cliente N2', 'EXP-N2-D',
     900, 144, 1044, 0, 0, 0, 'pendiente', v_tok_d, now() - interval '1 day');

  -- Conceptos mezclados en la proforma A (caso real de consolidada).
  INSERT INTO public.proforma_conceptos_consolidados
    (proforma_id, descripcion, cantidad, precio_unitario, total, moneda, organization_id)
  VALUES
    (v_pf_a, 'Flete marítimo', 1, 200, 200, 'USD'::public.moneda, v_org),
    (v_pf_a, 'Maniobras', 2, 500, 1000, 'MXN'::public.moneda, v_org);

  -- ----------------------------------------------------------
  -- CASO 1: dual MXN+USD → ambos juegos presentes, legacy = MXN.
  -- ----------------------------------------------------------
  v_j := public.portal_obtener_proforma_por_token(v_tok_a);
  v_p := v_j -> 'proforma';
  PERFORM pg_temp.assert(v_j ->> 'estado_link' = 'activo', 'CASO 1: estado_link no es activo');
  PERFORM pg_temp.assert(
    (v_p ->> 'subtotal_mxn')::numeric = 1000 AND (v_p ->> 'iva_mxn')::numeric = 160
    AND (v_p ->> 'total_mxn')::numeric = 1160
    AND (v_p ->> 'subtotal_usd')::numeric = 200 AND (v_p ->> 'iva_usd')::numeric = 32
    AND (v_p ->> 'total_usd')::numeric = 232,
    'CASO 1: los juegos duales no cuadran');
  PERFORM pg_temp.assert(
    v_p ->> 'moneda' = 'MXN' AND (v_p ->> 'subtotal')::numeric = 1000
    AND (v_p ->> 'iva')::numeric = 160 AND (v_p ->> 'total')::numeric = 1160,
    'CASO 1: las claves legacy no derivan de MXN');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM jsonb_array_elements(v_j -> 'conceptos')) = 2
    AND (SELECT count(DISTINCT c ->> 'moneda') FROM jsonb_array_elements(v_j -> 'conceptos') c) = 2,
    'CASO 1: los conceptos mezclados no llegaron con su moneda');
  RAISE NOTICE 'CASO 1 OK · dual MXN+USD con legacy derivado de MXN y conceptos mezclados.';

  -- ----------------------------------------------------------
  -- CASO 2: sólo-USD → legacy deriva de USD.
  -- ----------------------------------------------------------
  v_p := public.portal_obtener_proforma_por_token(v_tok_b) -> 'proforma';
  PERFORM pg_temp.assert(
    v_p ->> 'moneda' = 'USD' AND (v_p ->> 'subtotal')::numeric = 500
    AND (v_p ->> 'iva')::numeric = 80 AND (v_p ->> 'total')::numeric = 580
    AND (v_p ->> 'subtotal_mxn')::numeric = 0 AND (v_p ->> 'total_usd')::numeric = 580,
    'CASO 2: proforma sólo-USD no derivó el legacy en USD');
  RAISE NOTICE 'CASO 2 OK · sólo-USD deriva el legacy en USD.';

  -- ----------------------------------------------------------
  -- CASO 3: ambos cero → legacy MXN con ceros (default histórico).
  -- ----------------------------------------------------------
  v_p := public.portal_obtener_proforma_por_token(v_tok_c) -> 'proforma';
  PERFORM pg_temp.assert(
    v_p ->> 'moneda' = 'MXN' AND (v_p ->> 'subtotal')::numeric = 0
    AND (v_p ->> 'total')::numeric = 0,
    'CASO 3: proforma en ceros no cayó al default MXN');
  RAISE NOTICE 'CASO 3 OK · ambos cero → legacy MXN en ceros.';

  -- ----------------------------------------------------------
  -- CASO 4: BL-11 intacto — link expirado no expone montos.
  -- ----------------------------------------------------------
  v_j := public.portal_obtener_proforma_por_token(v_tok_d);
  v_p := v_j -> 'proforma';
  PERFORM pg_temp.assert(v_j ->> 'estado_link' = 'expirado', 'CASO 4: estado_link no es expirado');
  PERFORM pg_temp.assert(
    NOT (v_p ? 'subtotal') AND NOT (v_p ? 'subtotal_mxn') AND NOT (v_p ? 'total_usd')
    AND NOT (v_p ? 'cliente_nombre')
    AND v_j -> 'conceptos' = '[]'::jsonb,
    'CASO 4: el link expirado expuso montos o datos del cliente (BL-11 roto)');
  RAISE NOTICE 'CASO 4 OK · BL-11 intacto (expirado sin montos ni cliente).';

  -- ----------------------------------------------------------
  -- CASO 5: responder end-to-end con actor anónimo (N-2b).
  -- ----------------------------------------------------------
  v_j := public.portal_responder_por_token(v_tok_b, 'aceptada', '');
  PERFORM pg_temp.assert(v_j ->> 'estado_cliente' = 'aceptada',
    'CASO 5: la respuesta del portal no devolvió estado_cliente=aceptada');
  SELECT estado_cliente INTO v_estado FROM public.proformas WHERE id = v_pf_b;
  PERFORM pg_temp.assert(v_estado = 'aceptada', 'CASO 5: la proforma no quedó aceptada');
  SELECT count(*) INTO v_bit FROM public.bitacora_actividad
   WHERE entidad_id = v_pf_b AND accion = 'proforma_aceptada_cliente'
     -- El actor anónimo se registra sin usuario real: o NULL, o el usuario
     -- sentinel de sistema ('00000000-…') que usa la RPC del portal.
     AND (usuario_id IS NULL OR usuario_id = '00000000-0000-0000-0000-000000000000'::uuid)
     AND usuario_email = 'cliente-portal-token';
  PERFORM pg_temp.assert(v_bit = 1,
    'CASO 5: la bitácora del actor anónimo no quedó escrita sin usuario real');
  RAISE NOTICE 'CASO 5 OK · responder end-to-end 200 + bitácora de actor anónimo.';

  RAISE NOTICE 'FIX4 N2 OK · 5/5 casos.';
END $$;

ROLLBACK;
