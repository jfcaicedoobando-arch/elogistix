-- =============================================================
-- cxp_guard_factura_cancelada.sql · BL-03
--
-- Tests conductuales del guard de vida CxP (paridad con CxC
-- assert_factura_viva_para_pago): una factura de proveedor Cancelada —aunque
-- conserve estado_aprobacion='aprobada'— o en papelera NO admite pagos.
--
--   · CASO 1: INSERT pago sobre factura Cancelada con aprobación zombie → 23514
--   · CASO 2: INSERT pago sobre factura en papelera (deleted_at)      → 23514
--   · CASO 3: INSERT pago sobre factura Vigente aprobada (control)    → pasa
--
-- Fixture en BEGIN…ROLLBACK: no ensucia el snapshot. El estado 'Cancelada'
-- se fija en el INSERT (el trigger trg_guard_estado_proveedor_factura sólo
-- vigila UPDATE OF estado; la vía productiva es cancelar_factura_proveedor).
--
-- Corre en CI como paso del workflow rls-tests.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cxp_guard_factura_cancelada.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_prov uuid := '22222222-2222-2222-2222-222222222222';
  v_cat uuid := '66666666-6666-6666-6666-666666666666';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Guard Cxp Cancelada') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Test Prov Guard Cancelada', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias
    (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES
    (v_cat, v_org, 'Test Guard Cancelada', 0, true, 'CostoDirectoEmbarque');

  -- Cancelada con aprobación zombie (el escenario BL-03).
  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
     categoria_presupuesto_id,
     moneda, tipo_cambio_usd, subtotal, iva, total, estado, estado_aprobacion)
  VALUES
    ('33333333-3333-3333-3333-3333333333c1', v_org, v_prov, 'Test Prov', 'GUARD-CANC-01',
     v_cat, 'MXN'::public.moneda, 0, 3000, 0, 3000, 'Cancelada', 'aprobada');

  -- En papelera.
  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
     categoria_presupuesto_id,
     moneda, tipo_cambio_usd, subtotal, iva, total, estado, estado_aprobacion, deleted_at)
  VALUES
    ('33333333-3333-3333-3333-3333333333c2', v_org, v_prov, 'Test Prov', 'GUARD-CANC-02',
     v_cat, 'MXN'::public.moneda, 0, 3000, 0, 3000, 'Vigente', 'aprobada', now());

  -- Vigente (control).
  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
     categoria_presupuesto_id,
     moneda, tipo_cambio_usd, subtotal, iva, total, estado, estado_aprobacion)
  VALUES
    ('33333333-3333-3333-3333-3333333333c3', v_org, v_prov, 'Test Prov', 'GUARD-CANC-03',
     v_cat, 'MXN'::public.moneda, 0, 3000, 0, 3000, 'Vigente', 'aprobada');
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1: INSERT pago sobre factura Cancelada con aprobación zombie → 23514
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
       '33333333-3333-3333-3333-3333333333c1',
       1000, 'MXN'::public.moneda, NULL);
    RAISE EXCEPTION 'CASO1_FALLO: se aceptó un pago sobre factura Cancelada';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    RAISE NOTICE '✓ CASO 1: pago sobre Cancelada rechazado (SQLSTATE %)', v_sqlstate;
  END;
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: INSERT pago sobre factura en papelera → 23514
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_sqlstate text;
BEGIN
  BEGIN
    INSERT INTO public.pagos_proveedor
      (organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd)
    VALUES
      ('11111111-1111-1111-1111-111111111111',
       '33333333-3333-3333-3333-3333333333c2',
       1000, 'MXN'::public.moneda, NULL);
    RAISE EXCEPTION 'CASO2_FALLO: se aceptó un pago sobre factura en papelera';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    RAISE NOTICE '✓ CASO 2: pago sobre factura en papelera rechazado (SQLSTATE %)', v_sqlstate;
  END;
END
$caso2$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 3 (control): INSERT pago sobre factura Vigente aprobada → pasa
-- -------------------------------------------------------------
DO $caso3$
DECLARE
  v_mmf numeric;
BEGIN
  INSERT INTO public.pagos_proveedor
    (id, organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd)
  VALUES
    ('44444444-4444-4444-4444-4444444444c3',
     '11111111-1111-1111-1111-111111111111',
     '33333333-3333-3333-3333-3333333333c3',
     1000, 'MXN'::public.moneda, NULL);

  SELECT monto_en_moneda_factura INTO v_mmf
    FROM public.pagos_proveedor WHERE id = '44444444-4444-4444-4444-4444444444c3';

  IF v_mmf IS NULL OR round(v_mmf,2) <> 1000 THEN
    RAISE EXCEPTION 'CASO3_FALLO: el pago válido no se registró bien (monto_en_moneda_factura=%)', v_mmf;
  END IF;
  RAISE NOTICE '✓ CASO 3: pago sobre factura Vigente aprobada pasa (monto_en_moneda_factura=%)', v_mmf;
END
$caso3$ LANGUAGE plpgsql;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 3 NOTICE "✓ CASO n" y ROLLBACK.
-- =============================================================
