-- =============================================================
-- ola4_altas_indices.sql · Ola 4 (parches N15 y N16)
--
-- N15: los índices únicos pago↔movimiento bancario deben filtrar
--      deleted_at IS NULL (un movimiento en papelera no bloquea la
--      re-conciliación del mismo pago).
-- N16: una proforma no puede tener dos facturas vivas en la misma moneda.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola4_altas_indices.sql
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- CASO N15 (a): definición de los índices.
-- -------------------------------------------------------------
DO $n15a$
DECLARE
  v_def_fact text; v_def_prov text;
BEGIN
  SELECT indexdef INTO v_def_fact FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'uq_bbva_movimientos_pago_factura';
  SELECT indexdef INTO v_def_prov FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'uq_bbva_movimientos_pago_proveedor';
  IF v_def_fact IS NULL OR v_def_fact NOT ILIKE '%deleted_at IS NULL%' THEN
    RAISE EXCEPTION 'TEST FAIL: N15 - uq_bbva_movimientos_pago_factura no filtra deleted_at (def=%)', v_def_fact;
  END IF;
  IF v_def_prov IS NULL OR v_def_prov NOT ILIKE '%deleted_at IS NULL%' THEN
    RAISE EXCEPTION 'TEST FAIL: N15 - uq_bbva_movimientos_pago_proveedor no filtra deleted_at (def=%)', v_def_prov;
  END IF;
  RAISE NOTICE '✓ N15: ambos índices únicos filtran deleted_at IS NULL';
END
$n15a$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N15 (b): un movimiento soft-borrado ya no bloquea insertar otro
-- movimiento vivo con el mismo pago_factura_id.
-- -------------------------------------------------------------
DO $n15b$
DECLARE
  v_org uuid := 'd1111111-1111-1111-1111-111111111111';
  v_cuenta uuid := 'd9999999-9999-9999-9999-999999999999';
  v_pago uuid := 'd2020202-2020-2020-2020-202020202020';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org Ola4 Indices')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.cuentas_bancarias (id, organization_id, alias)
  VALUES (v_cuenta, v_org, 'Cuenta Ola4 Indices') ON CONFLICT (id) DO NOTHING;

  -- El trigger assert_movimiento_pago_consistente exige un pago vivo real.
  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES ('d3333333-3333-3333-3333-333333333333', v_org, 'Cliente Ola4 Indices', 'ola4-indices@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.facturas (
    id, organization_id, cliente_id, cliente_nombre, numero, expediente,
    moneda, subtotal, iva, total, estado, fecha_emision, fecha_vencimiento
  ) VALUES (
    'd4444444-4444-4444-4444-444444444444', v_org,
    'd3333333-3333-3333-3333-333333333333', 'Cliente Ola4 Indices', 'OLA4-IDX-01',
    'ELIDX001', 'MXN'::public.moneda, 1000, 0, 1000, 'Emitida'::public.estado_factura,
    CURRENT_DATE - 1, CURRENT_DATE + 20
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.pagos_factura (
    id, organization_id, factura_id, monto, moneda, fecha_pago
  ) VALUES (
    v_pago, v_org, 'd4444444-4444-4444-4444-444444444444', 100,
    'MXN'::public.moneda, CURRENT_DATE
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.bbva_movimientos (
    id, organization_id, cuenta_bancaria_id, fecha, cargo, hash_dedupe, pago_factura_id
  ) VALUES (
    'd1010101-1010-1010-1010-101010101010', v_org, v_cuenta,
    CURRENT_DATE, 100, 'ola4-idx-hash-1', v_pago
  );
  UPDATE public.bbva_movimientos SET deleted_at = now()
   WHERE id = 'd1010101-1010-1010-1010-101010101010';

  INSERT INTO public.bbva_movimientos (
    id, organization_id, cuenta_bancaria_id, fecha, cargo, hash_dedupe, pago_factura_id
  ) VALUES (
    'd1010102-1010-1010-1010-101010101020', v_org, v_cuenta,
    CURRENT_DATE, 100, 'ola4-idx-hash-2', v_pago
  );
  RAISE NOTICE '✓ N15: movimiento soft-borrado ya no bloquea re-conciliación del pago';
END
$n15b$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N16: índice único proforma+moneda con predicado deleted_at IS NULL.
-- -------------------------------------------------------------
DO $n16$
DECLARE
  v_def text;
BEGIN
  SELECT indexdef INTO v_def FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'uq_facturas_proforma_moneda_viva';
  IF v_def IS NULL OR v_def NOT ILIKE '%deleted_at IS NULL%' THEN
    RAISE EXCEPTION 'TEST FAIL: N16 - uq_facturas_proforma_moneda_viva no filtra deleted_at (def=%)', v_def;
  END IF;
  IF v_def NOT ILIKE '%proforma_id%' OR v_def NOT ILIKE '%moneda%' THEN
    RAISE EXCEPTION 'TEST FAIL: N16 - el índice no cubre (proforma_id, moneda) (def=%)', v_def;
  END IF;
  RAISE NOTICE '✓ N16: índice único de proforma+moneda filtra deleted_at IS NULL';
END
$n16$ LANGUAGE plpgsql;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 3 NOTICE "✓ N1x" y ROLLBACK.
-- =============================================================
