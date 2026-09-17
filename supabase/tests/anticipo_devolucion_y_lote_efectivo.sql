-- =============================================================
-- anticipo_devolucion_y_lote_efectivo.sql · Lote MNY (P1.1 y P1.2)
--
-- P1.1 devolver_anticipo_proveedor debe COMPLETARSE: el candado
--      assert_movimiento_pago_consistente acepta el abono sólo como devolución
--      genuina (anticipo devuelto, monto = monto_devuelto, misma org/moneda y
--      hash 'devolucion-<id>'), y rechaza abono sin devolución, cargo con hash
--      de devolución y monto distinto.
-- P1.2 registrar_pago_proveedor_lote con metodo_pago = 'Efectivo' NO crea
--      movimiento bancario aunque el payload traiga una cuenta obsoleta.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/anticipo_devolucion_y_lote_efectivo.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org  uuid := 'e1111111-1111-1111-1111-111111111111';
  v_uid  uuid := 'e5555555-5555-5555-5555-555555555555';
  v_prov uuid := 'e3333333-3333-3333-3333-333333333333';
  v_cat  uuid := 'e6666666-6666-6666-6666-666666666666';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org E Anticipos')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'anticipos-e@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'contador') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'contador')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Test Prov E', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Cat E', 0, true, 'CostoDirectoEmbarque')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.cuentas_bancarias (id, organization_id, alias, moneda)
  VALUES ('e7777777-7777-7777-7777-777777777777', v_org, 'MXN E', 'MXN'::public.moneda)
  ON CONFLICT (id) DO NOTHING;

  -- Anticipo MXN disponible para devolver.
  INSERT INTO public.anticipos_proveedor (
    id, organization_id, proveedor_id, fecha_anticipo, monto, moneda, estado, saldo_disponible
  ) VALUES (
    'e9999999-9999-9999-9999-999999999999', v_org, v_prov,
    public.fecha_negocio_mx() - 10, 400, 'MXN'::public.moneda, 'disponible', 400
  ) ON CONFLICT (id) DO NOTHING;

  -- Factura MXN abierta para el pago en lote.
  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, subtotal, iva, total,
    estado, estado_aprobacion, fecha_emision
  ) VALUES (
    'eb000000-0000-0000-0000-00000000000b', v_org, v_prov, 'Test Prov E', 'MNY-P12-01',
    v_cat, 'MXN'::public.moneda, 500, 0, 500, 'Vigente', 'aprobada',
    public.fecha_negocio_mx() - 5
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END
$fixture$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------
-- P1.1 · devolución genuina: happy path y rechazos del candado
-- ---------------------------------------------------------------
DO $devolucion$
DECLARE
  v_ant   public.anticipos_proveedor;
  v_org   uuid := 'e1111111-1111-1111-1111-111111111111';
  v_cta   uuid := 'e7777777-7777-7777-7777-777777777777';
  v_id    uuid := 'e9999999-9999-9999-9999-999999999999';
  v_abono int;
  v_err   text;
BEGIN
  v_ant := public.devolver_anticipo_proveedor(
    v_id, 400, public.fecha_negocio_mx(), v_cta, 'REF-DEV-1', 'Proveedor regresó el dinero');

  IF v_ant.estado <> 'devuelto' OR COALESCE(v_ant.saldo_disponible,0) <> 0
     OR v_ant.monto_devuelto <> 400 THEN
    RAISE EXCEPTION 'TEST FAIL: P1.1 - la devolución no actualizó estado/saldo (%, %, %)',
      v_ant.estado, v_ant.saldo_disponible, v_ant.monto_devuelto;
  END IF;

  SELECT count(*) INTO v_abono FROM public.bbva_movimientos
   WHERE anticipo_proveedor_id = v_id AND abono = 400 AND cargo = 0
     AND estado_conciliacion = 'Pendiente';
  IF v_abono <> 1 THEN
    RAISE EXCEPTION 'TEST FAIL: P1.1 - se esperaba exactamente 1 abono pendiente, hay %', v_abono;
  END IF;
  RAISE NOTICE '✓ P1.1: devolución completada con un abono pendiente';

  -- Rechazo 1: abono con monto distinto al devuelto.
  BEGIN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, cargo, abono,
       estado_conciliacion, anticipo_proveedor_id, hash_dedupe)
    VALUES (v_org, v_cta, public.fecha_negocio_mx(), 'Devolución mal monto', 0, 123,
            'Pendiente'::public.estado_conciliacion, v_id, 'devolucion-' || v_id::text);
    RAISE EXCEPTION 'TEST FAIL: P1.1 - se aceptó un abono con monto distinto al devuelto';
  EXCEPTION WHEN others THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_MOVIMIENTO_MONTO_MISMATCH%' THEN RAISE; END IF;
  END;

  -- Rechazo 2: hash de devolución pero sentido cargo.
  BEGIN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, cargo, abono,
       estado_conciliacion, anticipo_proveedor_id, hash_dedupe)
    VALUES (v_org, v_cta, public.fecha_negocio_mx(), 'Devolución al revés', 400, 0,
            'Pendiente'::public.estado_conciliacion, v_id, 'devolucion-' || v_id::text);
    RAISE EXCEPTION 'TEST FAIL: P1.1 - se aceptó una devolución como cargo';
  EXCEPTION WHEN others THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_MOVIMIENTO_SENTIDO_DEVOLUCION%' THEN RAISE; END IF;
  END;

  -- Rechazo 3: abono sin llave de devolución sigue prohibido (anticipo = cargo).
  BEGIN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, cargo, abono,
       estado_conciliacion, anticipo_proveedor_id, hash_dedupe)
    VALUES (v_org, v_cta, public.fecha_negocio_mx(), 'Abono suelto', 0, 400,
            'Pendiente'::public.estado_conciliacion, v_id, 'manual-abono-suelto-e');
    RAISE EXCEPTION 'TEST FAIL: P1.1 - se aceptó un abono de anticipo sin devolución';
  EXCEPTION WHEN others THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_MOVIMIENTO_SENTIDO_PAGO%' THEN RAISE; END IF;
  END;
  RAISE NOTICE '✓ P1.1: el candado rechaza monto, sentido y vínculo inválidos';
END
$devolucion$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------
-- P1.2 · lote CxP en Efectivo: sin movimiento bancario
-- ---------------------------------------------------------------
DO $lote$
DECLARE
  v_lote uuid;
  v_movs int;
  v_pagos int;
BEGIN
  v_lote := public.registrar_pago_proveedor_lote(jsonb_build_object(
    'proveedor_id', 'e3333333-3333-3333-3333-333333333333',
    'fecha_pago', public.fecha_negocio_mx()::text,
    'moneda', 'MXN',
    'metodo_pago', 'Efectivo',
    -- Cuenta obsoleta que quedó del método anterior: la RPC debe ignorarla.
    'cuenta_bancaria_id', 'e7777777-7777-7777-7777-777777777777',
    'importe_recibido', 500,
    'request_id', gen_random_uuid()::text,
    'renglones', jsonb_build_array(
      jsonb_build_object('factura_id', 'eb000000-0000-0000-0000-00000000000b', 'monto', 500))
  ));

  SELECT count(*) INTO v_pagos FROM public.pagos_proveedor
   WHERE pago_proveedor_lote_id = v_lote AND deleted_at IS NULL;
  IF v_pagos <> 1 THEN
    RAISE EXCEPTION 'TEST FAIL: P1.2 - se esperaba 1 pago en el lote, hay %', v_pagos;
  END IF;

  SELECT count(*) INTO v_movs FROM public.bbva_movimientos
   WHERE pago_proveedor_lote_id = v_lote;
  IF v_movs <> 0 THEN
    RAISE EXCEPTION 'TEST FAIL: P1.2 - Efectivo creó % movimiento(s) bancario(s)', v_movs;
  END IF;
  RAISE NOTICE '✓ P1.2: el lote en efectivo se registra sin salida bancaria';
END
$lote$ LANGUAGE plpgsql;

ROLLBACK;
