-- =============================================================
-- n3_n5_movimientos_bancarios.sql · lote de integridad N3 y N5
--
-- N3 — La captura manual de un movimiento bancario sólo revisaba que la fecha
--      existiera: se podía fechar MAÑANA (en México) o antes del corte de saldo
--      inicial de la cuenta, y el saldo del día dejaba de cuadrar.
-- N5 — Al conciliar se comparaba sólo el importe absoluto: un cargo (salida de
--      dinero) podía vincularse como cobro de cliente y un abono como pago a
--      proveedor.
--
-- Analogía: en la chequera, un depósito y un retiro no se anotan en la misma
-- columna, y no se anota un movimiento con la fecha de mañana.
--
-- Se verifica que:
--   1. Un movimiento manual fechado mañana en México se rechaza.
--   2. Un movimiento manual anterior al corte de la cuenta se rechaza.
--   3. Un movimiento manual con fecha válida se acepta.
--   4. Un cargo NO puede vincularse a un cobro de cliente (pago_factura_id).
--   5. Un abono NO puede vincularse a un pago a proveedor (pago_proveedor_id).
--
-- Todo dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/n3_n5_movimientos_bancarios.sql
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre)
VALUES ('5e5e5e5e-0000-4000-8000-000000000010', 'Test N3 N5 Movimientos');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email)
    VALUES ('5e5e5e5e-0000-4000-8000-000000000099', 'n3n5-movs@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth (pooler sin rol GoTrue).
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('5e5e5e5e-0000-4000-8000-000000000010', '5e5e5e5e-0000-4000-8000-000000000099',
        'admin_org'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.cuentas_bancarias
  (id, organization_id, banco, alias, moneda, saldo_inicial, fecha_saldo_inicial, activa)
VALUES
  ('5e5e5e5e-0000-4000-8000-000000000021', '5e5e5e5e-0000-4000-8000-000000000010',
   'BBVA', 'Pesos N3', 'MXN', 10000, DATE '2026-02-01', true);

-- ── N3 · fecha del movimiento capturado a mano ─────────────────────────────
DO $n3$
DECLARE
  v_manana date := public.fecha_negocio_mx() + 1;
BEGIN
  BEGIN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono, hash_dedupe)
    VALUES ('5e5e5e5e-0000-4000-8000-000000000010', '5e5e5e5e-0000-4000-8000-000000000021',
            v_manana, 'Comisión N3', 'R1', 100, 0, 'manual-n3-futura');
    RAISE EXCEPTION 'N3 FALLÓ: se aceptó un movimiento manual fechado mañana en México (%)', v_manana;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_MOVIMIENTO_MANUAL_FECHA_FUTURA%' THEN
      RAISE EXCEPTION 'N3 FALLÓ: se esperaba LC_MOVIMIENTO_MANUAL_FECHA_FUTURA, llegó %', SQLERRM;
    END IF;
  END;

  BEGIN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono, hash_dedupe)
    VALUES ('5e5e5e5e-0000-4000-8000-000000000010', '5e5e5e5e-0000-4000-8000-000000000021',
            DATE '2026-01-15', 'Comisión N3', 'R2', 100, 0, 'manual-n3-antes-corte');
    RAISE EXCEPTION 'N3 FALLÓ: se aceptó un movimiento manual anterior al corte de la cuenta.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_MOVIMIENTO_MANUAL_FECHA_ANTES_CORTE%' THEN
      RAISE EXCEPTION 'N3 FALLÓ: se esperaba LC_MOVIMIENTO_MANUAL_FECHA_ANTES_CORTE, llegó %', SQLERRM;
    END IF;
  END;

  -- Fecha válida: se acepta (no bloqueamos la captura legítima).
  INSERT INTO public.bbva_movimientos
    (organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono, hash_dedupe)
  VALUES ('5e5e5e5e-0000-4000-8000-000000000010', '5e5e5e5e-0000-4000-8000-000000000021',
          public.fecha_negocio_mx(), 'Comisión N3 válida', 'R3', 100, 0, 'manual-n3-ok');

  RAISE NOTICE 'N3 OK · fecha futura y anterior al corte rechazadas; fecha válida aceptada.';
END
$n3$ LANGUAGE plpgsql;

-- ── N5 · sentido bancario al vincular un movimiento con un pago ────────────
DO $n5$
DECLARE
  v_cliente uuid := '5e5e5e5e-0000-4000-8000-000000000031';
  v_factura uuid := '5e5e5e5e-0000-4000-8000-000000000032';
  v_pago_cxc uuid := '5e5e5e5e-0000-4000-8000-000000000033';
  v_proveedor uuid := '5e5e5e5e-0000-4000-8000-000000000034';
  v_pf uuid := '5e5e5e5e-0000-4000-8000-000000000035';
  v_pago_cxp uuid := '5e5e5e5e-0000-4000-8000-000000000036';
  v_categoria uuid := '5e5e5e5e-0000-4000-8000-000000000037';
BEGIN
  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES (v_cliente, '5e5e5e5e-0000-4000-8000-000000000010', 'Cliente N5', 'n5-cliente@test.mx');

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero, moneda, subtotal, iva, total,
     estado, fecha_emision, fecha_vencimiento)
  VALUES (v_factura, '5e5e5e5e-0000-4000-8000-000000000010', v_cliente, 'Cliente N5',
          'N5-1', 'MXN'::public.moneda, 100, 16, 116, 'Emitida'::public.estado_factura,
          public.fecha_negocio_mx(), public.fecha_negocio_mx() + 20);

  INSERT INTO public.pagos_factura
    (id, organization_id, factura_id, fecha_pago, monto, moneda)
  VALUES (v_pago_cxc, '5e5e5e5e-0000-4000-8000-000000000010', v_factura,
          public.fecha_negocio_mx(), 116, 'MXN'::public.moneda);

  -- Un CARGO (salida de dinero) no puede ser el cobro de un cliente.
  BEGIN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono,
       hash_dedupe, pago_factura_id)
    VALUES ('5e5e5e5e-0000-4000-8000-000000000010', '5e5e5e5e-0000-4000-8000-000000000021',
            public.fecha_negocio_mx(), 'Cobro N5', 'R4', 116, 0, 'n5-cargo-como-cobro', v_pago_cxc);
    RAISE EXCEPTION 'N5 FALLÓ: se aceptó un cargo vinculado a un cobro de cliente.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_MOVIMIENTO_SENTIDO_COBRO%' THEN
      RAISE EXCEPTION 'N5 FALLÓ: se esperaba LC_MOVIMIENTO_SENTIDO_COBRO, llegó %', SQLERRM;
    END IF;
  END;

  -- El abono sí se acepta como cobro.
  INSERT INTO public.bbva_movimientos
    (organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono,
     hash_dedupe, pago_factura_id)
  VALUES ('5e5e5e5e-0000-4000-8000-000000000010', '5e5e5e5e-0000-4000-8000-000000000021',
          public.fecha_negocio_mx(), 'Cobro N5', 'R5', 0, 116, 'n5-abono-como-cobro', v_pago_cxc);

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, tipo)
  VALUES (v_proveedor, '5e5e5e5e-0000-4000-8000-000000000010', 'Proveedor N5',
          'Logistico'::public.categoria_proveedor, 'Naviera'::public.tipo_proveedor);

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre)
  VALUES (v_categoria, '5e5e5e5e-0000-4000-8000-000000000010', 'Categoría N5');

  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor, folio_interno,
     categoria_presupuesto_id, fecha_emision, moneda, subtotal, total, estado, estado_aprobacion)
  VALUES (v_pf, '5e5e5e5e-0000-4000-8000-000000000010', v_proveedor, 'Proveedor N5',
          'PN5-1', 'FP-N50001', v_categoria, public.fecha_negocio_mx(),
          'MXN'::public.moneda, 100, 100, 'Vigente'::public.estado_proveedor_factura,
          'aprobada'::public.estado_aprobacion_factura_proveedor);

  INSERT INTO public.pagos_proveedor
    (id, organization_id, proveedor_factura_id, fecha_pago, monto, moneda)
  VALUES (v_pago_cxp, '5e5e5e5e-0000-4000-8000-000000000010', v_pf,
          public.fecha_negocio_mx(), 100, 'MXN'::public.moneda);

  -- Un ABONO (entrada de dinero) no puede ser el pago de un proveedor.
  BEGIN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono,
       hash_dedupe, pago_proveedor_id)
    VALUES ('5e5e5e5e-0000-4000-8000-000000000010', '5e5e5e5e-0000-4000-8000-000000000021',
            public.fecha_negocio_mx(), 'Pago N5', 'R6', 0, 100, 'n5-abono-como-pago', v_pago_cxp);
    RAISE EXCEPTION 'N5 FALLÓ: se aceptó un abono vinculado a un pago a proveedor.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_MOVIMIENTO_SENTIDO_PAGO%' THEN
      RAISE EXCEPTION 'N5 FALLÓ: se esperaba LC_MOVIMIENTO_SENTIDO_PAGO, llegó %', SQLERRM;
    END IF;
  END;

  -- El cargo sí se acepta como pago a proveedor.
  INSERT INTO public.bbva_movimientos
    (organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono,
     hash_dedupe, pago_proveedor_id)
  VALUES ('5e5e5e5e-0000-4000-8000-000000000010', '5e5e5e5e-0000-4000-8000-000000000021',
          public.fecha_negocio_mx(), 'Pago N5', 'R7', 100, 0, 'n5-cargo-como-pago', v_pago_cxp);

  RAISE NOTICE 'N5 OK · el sentido bancario debe coincidir con el tipo de pago.';
END
$n5$ LANGUAGE plpgsql;

ROLLBACK;
