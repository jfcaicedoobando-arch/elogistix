-- =============================================================
-- Lote C28–C30 (v13.823.381)
--  C28 · actualizar_embarque_completo: reactivar el IVA de una línea antes
--        exenta ya no la deja gravada con tasa 0 (contrato de la función).
--  C29 · pnl_financiero_embarque: una factura que cubre DOS embarques atribuye
--        a cada uno sólo sus líneas (funcional: 100 y 200) y el total combinado
--        no se duplica.
--  C30 · convertir_proformas_a_factura: cada proforma origen queda enlazada a
--        la factura resultante (`factura_id` / `factura_secundaria_id`).
-- Todo dentro de BEGIN…ROLLBACK; no toca datos históricos.
-- =============================================================

BEGIN;

-- ── C28 / C30: contratos sobre el catálogo ───────────────────────────────
DO $contratos$
DECLARE
  v_def text;
BEGIN
  v_def := pg_get_functiondef('public.actualizar_embarque_completo(uuid,jsonb,jsonb,jsonb,uuid,timestamptz)'::regprocedure);
  -- Exento sigue en 0 (invariante C22).
  IF v_def !~ 'WHEN COALESCE\(\(cv->>''aplica_iva''\)::boolean, aplica_iva\) = false THEN 0' THEN
    RAISE EXCEPTION 'C28 FAIL: la edición perdió la normalización de líneas exentas';
  END IF;
  -- Edición gravada: tasa enviada > 0 → tasa previa > 0 → 0.16.
  IF v_def !~ 'NULLIF\(\(cv->>''tasa_iva_aplicada''\)::numeric, 0\)' THEN
    RAISE EXCEPTION 'C28 FAIL: una tasa enviada en 0 vuelve a ganarle al fallback canónico';
  END IF;
  IF v_def !~ 'NULLIF\(tasa_iva_aplicada, 0\)' THEN
    RAISE EXCEPTION 'C28 FAIL: la edición no conserva la tasa positiva previa';
  END IF;
  IF v_def !~ 'NULLIF\(tasa_iva_aplicada, 0\),\s*0\.16' THEN
    RAISE EXCEPTION 'C28 FAIL: exenta→gravada sin tasa no cae en el fallback 0.16';
  END IF;

  v_def := pg_get_functiondef('public.convertir_proformas_a_factura(uuid[],uuid,text,text,text,integer,text,uuid)'::regprocedure);
  IF v_def !~ 'factura_id = COALESCE\(v_factura_mxn_id, v_factura_usd_id\)' THEN
    RAISE EXCEPTION 'C30 FAIL: la proforma no queda enlazada a la factura principal';
  END IF;
  IF v_def !~ 'factura_secundaria_id = CASE' THEN
    RAISE EXCEPTION 'C30 FAIL: falta el enlace a la segunda factura (MXN + USD)';
  END IF;
  IF v_def !~ 'THEN v_factura_usd_id' THEN
    RAISE EXCEPTION 'C30 FAIL: la segunda factura enlazada no es la de USD';
  END IF;
  RAISE NOTICE '✓ C28/C30: contratos de IVA y de enlace proforma→factura';
END
$contratos$ LANGUAGE plpgsql;

-- ── C29: funcional con dos embarques (100 y 200) ─────────────────────────
INSERT INTO public.organizations (id, nombre)
VALUES ('c29c0000-0000-4000-8000-000000000001'::uuid, 'C29 P&L Org');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email)
    VALUES ('c29c0000-0000-4000-8000-0000000000a1', 'c29-pnl@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('c29c0000-0000-4000-8000-000000000001'::uuid,
        'c29c0000-0000-4000-8000-0000000000a1', 'contador'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.clientes (id, nombre, organization_id)
VALUES ('c29c0000-0000-4000-8000-0000000000c1'::uuid, 'Cliente C29',
        'c29c0000-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.embarques (id, cliente_id, cliente_nombre, modo, tipo, organization_id, tipo_cambio_usd)
VALUES
  ('c29c0000-0000-4000-8000-0000000000e1'::uuid, 'c29c0000-0000-4000-8000-0000000000c1'::uuid,
   'Cliente C29', 'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
   'c29c0000-0000-4000-8000-000000000001'::uuid, 18),
  ('c29c0000-0000-4000-8000-0000000000e2'::uuid, 'c29c0000-0000-4000-8000-0000000000c1'::uuid,
   'Cliente C29', 'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
   'c29c0000-0000-4000-8000-000000000001'::uuid, 18);

-- Factura fusionada: header en el embarque 1, líneas 100 (emb 1) y 200 (emb 2).
INSERT INTO public.facturas (
  id, numero, cliente_id, cliente_nombre, embarque_id, organization_id,
  subtotal, iva, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado
) VALUES (
  'c29c0000-0000-4000-8000-0000000000f1'::uuid, 'C29-FUSION-1',
  'c29c0000-0000-4000-8000-0000000000c1'::uuid, 'Cliente C29',
  'c29c0000-0000-4000-8000-0000000000e1'::uuid,
  'c29c0000-0000-4000-8000-000000000001'::uuid,
  300, 0, 300, 'MXN'::public.moneda, 1, CURRENT_DATE, CURRENT_DATE + 30,
  'Emitida'::public.estado_factura
);

INSERT INTO public.conceptos_factura (
  factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, embarque_id
) VALUES
  ('c29c0000-0000-4000-8000-0000000000f1'::uuid, 'flete emb 1', 1, 100,
   'MXN'::public.moneda, 100, 'c29c0000-0000-4000-8000-000000000001'::uuid,
   'c29c0000-0000-4000-8000-0000000000e1'::uuid),
  ('c29c0000-0000-4000-8000-0000000000f1'::uuid, 'flete emb 2', 1, 200,
   'MXN'::public.moneda, 200, 'c29c0000-0000-4000-8000-000000000001'::uuid,
   'c29c0000-0000-4000-8000-0000000000e2'::uuid);

DO $pnl$
DECLARE
  v_e1 numeric; v_e2 numeric;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'c29c0000-0000-4000-8000-0000000000a1')::text, true);

  v_e1 := (public.pnl_financiero_embarque('c29c0000-0000-4000-8000-0000000000e1'::uuid)
             #>> '{venta,real_mxn}')::numeric;
  v_e2 := (public.pnl_financiero_embarque('c29c0000-0000-4000-8000-0000000000e2'::uuid)
             #>> '{venta,real_mxn}')::numeric;

  IF round(v_e1, 2) <> 100.00 THEN
    RAISE EXCEPTION 'C29 FAIL: el embarque 1 recibió % en lugar de 100', v_e1;
  END IF;
  IF round(v_e2, 2) <> 200.00 THEN
    RAISE EXCEPTION 'C29 FAIL: el embarque 2 recibió % en lugar de 200', v_e2;
  END IF;
  IF round(v_e1 + v_e2, 2) <> 300.00 THEN
    RAISE EXCEPTION 'C29 FAIL: el total combinado (%) duplica la factura', v_e1 + v_e2;
  END IF;
  RAISE NOTICE '✓ C29: factura multiembarque atribuida 100 / 200 sin duplicar';

  PERFORM set_config('request.jwt.claims', NULL, true);
END
$pnl$ LANGUAGE plpgsql;

ROLLBACK;
