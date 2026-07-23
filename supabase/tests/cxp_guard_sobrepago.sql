-- =============================================================
-- cxp_guard_sobrepago.sql · Sprint 1 · FIX-R3-01
--
-- Tests conductuales del trigger `guard_pago_proveedor` sobre
-- `public.pagos_proveedor`. Cubre INSERT y UPDATE, con el bug
-- histórico del path UPDATE (delta vs saldo) como caso #3.
--
-- Corre en CI como paso adicional del workflow rls-tests. Todo el
-- fixture vive dentro de un bloque transaccional y se limpia al
-- final: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cxp_guard_sobrepago.sql
-- =============================================================

BEGIN;

-- Fixture con IDs deterministas para poder referenciarlos entre casos.
DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_prov uuid := '22222222-2222-2222-2222-222222222222';
  v_fact uuid := '33333333-3333-3333-3333-333333333333';
  v_cat uuid := '66666666-6666-6666-6666-666666666666';
BEGIN
  -- Categoría de presupuesto mínima (columna NOT NULL en proveedor_facturas).
  INSERT INTO public.presupuesto_categorias
    (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES
    (v_cat, v_org, 'Test Guard Sobrepago', 0, true, 'CostoDirectoEmbarque');

  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
     categoria_presupuesto_id,
     moneda, tipo_cambio_usd, subtotal, iva, total, estado)
  VALUES
    (v_fact, v_org, v_prov, 'Test Prov', 'GUARD-SOBRE-01',
     v_cat,
     'MXN'::public.moneda, 0, 3000, 0, 3000, 'Borrador');
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1: INSERT sobrepago (4000 sobre factura de 3000) → 23514
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_sqlstate text;
BEGIN
  BEGIN
    INSERT INTO public.pagos_proveedor
      (organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd)
    VALUES
      ('11111111-1111-1111-1111-111111111111',
       '33333333-3333-3333-3333-333333333333',
       4000, 'MXN'::public.moneda, 0);
    RAISE EXCEPTION 'CASO1_FALLO: se aceptó INSERT sobrepago (esperaba LC_PAGO_EXCEDE_SALDO)';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    RAISE NOTICE '✓ CASO 1: INSERT sobrepago rechazado (SQLSTATE %)', v_sqlstate;
  END;
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: INSERT válido → pasa y monto_en_moneda_factura poblado
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_pago_id uuid := '44444444-4444-4444-4444-444444444444';
  v_mmf numeric;
BEGIN
  INSERT INTO public.pagos_proveedor
    (id, organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd)
  VALUES
    (v_pago_id,
     '11111111-1111-1111-1111-111111111111',
     '33333333-3333-3333-3333-333333333333',
     1000, 'MXN'::public.moneda, 0);

  SELECT monto_en_moneda_factura INTO v_mmf
    FROM public.pagos_proveedor WHERE id = v_pago_id;

  IF v_mmf IS NULL OR round(v_mmf,2) <> 1000 THEN
    RAISE EXCEPTION 'CASO2_FALLO: monto_en_moneda_factura=% (esperaba 1000)', v_mmf;
  END IF;
  RAISE NOTICE '✓ CASO 2: INSERT válido pasa (monto_en_moneda_factura=%)', v_mmf;
END
$caso2$ LANGUAGE plpgsql;

-- Segundo pago legítimo (1000) — deja saldo 1000.
INSERT INTO public.pagos_proveedor
  (id, organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd)
VALUES
  ('55555555-5555-5555-5555-555555555555',
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333',
   1000, 'MXN'::public.moneda, 0);

-- -------------------------------------------------------------
-- CASO 3 (BUG histórico): UPDATE eleva pago 1000→2500 en factura 3000
--   con otro pago vivo de 1000 → total quedaría 3500 → 23514.
-- -------------------------------------------------------------
DO $caso3$
DECLARE
  v_sqlstate text;
BEGIN
  BEGIN
    UPDATE public.pagos_proveedor
       SET monto = 2500
     WHERE id = '55555555-5555-5555-5555-555555555555';
    RAISE EXCEPTION 'CASO3_FALLO: se aceptó UPDATE que produce sobrepago (esperaba LC_PAGO_EXCEDE_SALDO)';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    RAISE NOTICE '✓ CASO 3: UPDATE sobrepago rechazado (SQLSTATE %)', v_sqlstate;
  END;
END
$caso3$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 4: UPDATE legítimo (1000 → 2000, saldo total 3000) → pasa.
-- -------------------------------------------------------------
DO $caso4$
DECLARE
  v_mmf numeric;
BEGIN
  UPDATE public.pagos_proveedor
     SET monto = 2000
   WHERE id = '55555555-5555-5555-5555-555555555555';

  SELECT monto_en_moneda_factura INTO v_mmf
    FROM public.pagos_proveedor
   WHERE id = '55555555-5555-5555-5555-555555555555';

  IF v_mmf IS NULL OR round(v_mmf,2) <> 2000 THEN
    RAISE EXCEPTION 'CASO4_FALLO: monto_en_moneda_factura=% (esperaba 2000)', v_mmf;
  END IF;
  RAISE NOTICE '✓ CASO 4: UPDATE legítimo pasa (monto_en_moneda_factura=%)', v_mmf;
END
$caso4$ LANGUAGE plpgsql;

ROLLBACK;
