-- =============================================================
-- anticipos_efectivo_fechas_y_cruce_dof.sql · Lote MNY anticipos P1
--
-- P1.1 Efectivo NO genera salida bancaria, aunque el cliente mande una cuenta
--      (selector no limpiado): la RPC ignora la cuenta de forma autoritativa.
-- P1.2 registrar_anticipo_proveedor / devolver_anticipo_proveedor rechazan
--      fecha futura (fecha_negocio_mx) y fecha dentro del periodo cerrado.
-- P1.3 Una aplicación de anticipo entre monedas se valúa con el DOF del día de
--      aplicación, no con el TC histórico de la factura:
--        100 USD con DOF usd=17.3370 / eur=20.0000  → 86.6850 EUR
--        ruta histórica con TC factura 18.00        → 95.2928 EUR (obsoleta)
--
-- Patrón de ola4_n31_n36_n37.sql: fixture determinista + request.jwt.claims.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/anticipos_efectivo_fechas_y_cruce_dof.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org   uuid := 'd1111111-1111-1111-1111-111111111111';
  v_uid   uuid := 'd5555555-5555-5555-5555-555555555555';
  v_prov  uuid := 'd3333333-3333-3333-3333-333333333333';
  v_cat   uuid := 'd6666666-6666-6666-6666-666666666666';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org D Anticipos')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'anticipos-d@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'contador') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'contador')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Test Prov D', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Cat D', 0, true, 'CostoDirectoEmbarque')
  ON CONFLICT (id) DO NOTHING;

  -- Cuentas MXN y USD de la misma org.
  INSERT INTO public.cuentas_bancarias (id, organization_id, alias, moneda)
  VALUES ('d7777777-7777-7777-7777-777777777777', v_org, 'MXN D', 'MXN'::public.moneda)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.cuentas_bancarias (id, organization_id, alias, moneda)
  VALUES ('d8888888-8888-8888-8888-888888888888', v_org, 'USD D', 'USD'::public.moneda)
  ON CONFLICT (id) DO NOTHING;

  -- Anticipo MXN ya existente para probar la devolución.
  INSERT INTO public.anticipos_proveedor (
    id, organization_id, proveedor_id, fecha_anticipo, monto, moneda, estado, saldo_disponible
  ) VALUES (
    'd9999999-9999-9999-9999-999999999999', v_org, v_prov,
    public.fecha_negocio_mx() - 10, 50, 'MXN'::public.moneda, 'disponible', 50
  ) ON CONFLICT (id) DO NOTHING;

  -- Anticipo USD (TC histórico 17.1527) y factura EUR (TC histórico 18.00).
  INSERT INTO public.anticipos_proveedor (
    id, organization_id, proveedor_id, fecha_anticipo, monto, moneda,
    tipo_cambio_usd, estado, saldo_disponible
  ) VALUES (
    'da000000-0000-0000-0000-00000000000a', v_org, v_prov,
    public.fecha_negocio_mx() - 5, 100, 'USD'::public.moneda,
    17.1527, 'disponible', 100
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
    estado, estado_aprobacion, fecha_emision
  ) VALUES (
    'db000000-0000-0000-0000-00000000000b', v_org, v_prov, 'Test Prov D', 'MNY-P13-01',
    v_cat, 'EUR'::public.moneda, 18.00, 200, 0, 200, 'Borrador', 'aprobada',
    public.fecha_negocio_mx() - 5
  ) ON CONFLICT (id) DO NOTHING;

  -- DOF del día de la aplicación: USD 17.3370 / EUR 20.0000 → 100 USD = 86.6850 EUR.
  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, eur_mxn, origen)
  VALUES (public.fecha_negocio_mx(), 17.3370, 20.0000, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = 17.3370, eur_mxn = 20.0000;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO P1.1: Efectivo con cuenta enviada → ni cuenta guardada ni cargo bancario.
-- -------------------------------------------------------------
DO $efectivo$
DECLARE
  v_ant public.anticipos_proveedor;
  v_movs integer;
BEGIN
  v_ant := public.registrar_anticipo_proveedor(
    p_proveedor_id      => 'd3333333-3333-3333-3333-333333333333',
    p_monto             => 300,
    p_moneda            => 'MXN'::public.moneda,
    p_fecha_anticipo    => public.fecha_negocio_mx(),
    p_metodo_pago       => 'Efectivo',
    p_cuenta_bancaria_id=> 'd7777777-7777-7777-7777-777777777777');

  IF v_ant.cuenta_bancaria_id IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAIL: P1.1 - el anticipo en efectivo guardó cuenta bancaria %',
      v_ant.cuenta_bancaria_id;
  END IF;
  SELECT count(*) INTO v_movs FROM public.bbva_movimientos
   WHERE anticipo_proveedor_id = v_ant.id;
  IF v_movs <> 0 THEN
    RAISE EXCEPTION 'TEST FAIL: P1.1 - el anticipo en efectivo generó % movimiento(s) bancario(s)', v_movs;
  END IF;
  RAISE NOTICE '✓ P1.1: Efectivo sin cuenta ni cargo bancario';
END
$efectivo$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO P1.1b: Transferencia con cuenta sí genera el cargo conciliado.
-- -------------------------------------------------------------
DO $transferencia$
DECLARE
  v_ant public.anticipos_proveedor;
  v_movs integer;
BEGIN
  v_ant := public.registrar_anticipo_proveedor(
    p_proveedor_id      => 'd3333333-3333-3333-3333-333333333333',
    p_monto             => 400,
    p_moneda            => 'MXN'::public.moneda,
    p_fecha_anticipo    => public.fecha_negocio_mx(),
    p_metodo_pago       => 'Transferencia',
    p_cuenta_bancaria_id=> 'd7777777-7777-7777-7777-777777777777');
  SELECT count(*) INTO v_movs FROM public.bbva_movimientos
   WHERE anticipo_proveedor_id = v_ant.id AND cargo = 400;
  IF v_movs <> 1 THEN
    RAISE EXCEPTION 'TEST FAIL: P1.1b - se esperaba 1 cargo bancario, hay %', v_movs;
  END IF;
  RAISE NOTICE '✓ P1.1b: Transferencia conserva el cargo bancario conciliado';
END
$transferencia$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO P1.2a: registrar con fecha futura → LC_ANTICIPO_FECHA_FUTURA.
-- -------------------------------------------------------------
DO $futura$
BEGIN
  BEGIN
    PERFORM public.registrar_anticipo_proveedor(
      p_proveedor_id      => 'd3333333-3333-3333-3333-333333333333',
      p_monto             => 100,
      p_moneda            => 'MXN'::public.moneda,
      p_fecha_anticipo    => public.fecha_negocio_mx() + 3,
      p_metodo_pago       => 'Efectivo');
    RAISE EXCEPTION 'TEST FAIL: P1.2a - se aceptó un anticipo con fecha futura';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_ANTICIPO_FECHA_FUTURA%' THEN
      RAISE EXCEPTION 'TEST FAIL: P1.2a - error inesperado: %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ P1.2a: registrar rechaza fecha futura';
END
$futura$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO P1.2b: registrar dentro del periodo cerrado → LC_PERIODO_CERRADO.
-- -------------------------------------------------------------
DO $cerrado$
DECLARE
  v_org uuid := 'd1111111-1111-1111-1111-111111111111';
  v_cierre date := public.fecha_negocio_mx() - 1;
BEGIN
  INSERT INTO public.configuracion (organization_id, categoria, clave, valor)
  VALUES (v_org, 'contabilidad', 'cierre_periodo_fecha', to_jsonb(v_cierre::text));

  BEGIN
    PERFORM public.registrar_anticipo_proveedor(
      p_proveedor_id      => 'd3333333-3333-3333-3333-333333333333',
      p_monto             => 100,
      p_moneda            => 'MXN'::public.moneda,
      p_fecha_anticipo    => v_cierre,
      p_metodo_pago       => 'Efectivo');
    RAISE EXCEPTION 'TEST FAIL: P1.2b - se aceptó un anticipo en periodo cerrado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_PERIODO_CERRADO%' THEN
      RAISE EXCEPTION 'TEST FAIL: P1.2b - error inesperado: %', SQLERRM;
    END IF;
  END;

  -- Devolución en fecha cerrada: mismo candado.
  BEGIN
    PERFORM public.devolver_anticipo_proveedor(
      'd9999999-9999-9999-9999-999999999999'::uuid, 50, v_cierre,
      'd7777777-7777-7777-7777-777777777777'::uuid, NULL, 'Reembolso de prueba');
    RAISE EXCEPTION 'TEST FAIL: P1.2b - se aceptó una devolución en periodo cerrado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_PERIODO_CERRADO%' THEN
      RAISE EXCEPTION 'TEST FAIL: P1.2b - error inesperado (devolución): %', SQLERRM;
    END IF;
  END;

  DELETE FROM public.configuracion
   WHERE organization_id = v_org AND categoria = 'contabilidad'
     AND clave = 'cierre_periodo_fecha';
  RAISE NOTICE '✓ P1.2b: registrar y devolver rechazan el periodo cerrado';
END
$cerrado$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO P1.2c: devolución con fecha futura → LC_ANTICIPO_FECHA_FUTURA;
-- con fecha de hoy → se registra.
-- -------------------------------------------------------------
DO $devolucion$
DECLARE
  v_row public.anticipos_proveedor;
BEGIN
  BEGIN
    PERFORM public.devolver_anticipo_proveedor(
      'd9999999-9999-9999-9999-999999999999'::uuid, 50, public.fecha_negocio_mx() + 2,
      'd7777777-7777-7777-7777-777777777777'::uuid, NULL, 'Reembolso de prueba');
    RAISE EXCEPTION 'TEST FAIL: P1.2c - se aceptó una devolución con fecha futura';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_ANTICIPO_FECHA_FUTURA%' THEN
      RAISE EXCEPTION 'TEST FAIL: P1.2c - error inesperado: %', SQLERRM;
    END IF;
  END;

  v_row := public.devolver_anticipo_proveedor(
    'd9999999-9999-9999-9999-999999999999'::uuid, 50, public.fecha_negocio_mx(),
    'd7777777-7777-7777-7777-777777777777'::uuid, NULL, 'Reembolso de prueba');
  IF v_row.estado <> 'devuelto' OR COALESCE(v_row.saldo_disponible, -1) <> 0 THEN
    RAISE EXCEPTION 'TEST FAIL: P1.2c - la devolución válida no dejó el anticipo devuelto (estado=%, saldo=%)',
      v_row.estado, v_row.saldo_disponible;
  END IF;
  RAISE NOTICE '✓ P1.2c: devolución rechaza fecha futura y acepta hoy';
END
$devolucion$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO P1.3: aplicación USD→EUR valuada con el DOF del día (86.6850),
-- no con el TC histórico de la factura (95.2928).
-- -------------------------------------------------------------
DO $cruce$
DECLARE
  v_ap public.anticipos_aplicaciones;
  v_pago public.pagos_proveedor;
BEGIN
  v_ap := public.aplicar_anticipo_a_factura(
    'da000000-0000-0000-0000-00000000000a'::uuid,
    'db000000-0000-0000-0000-00000000000b'::uuid,
    100,
    public.fecha_negocio_mx());

  IF v_ap.moneda_aplicada <> 'USD'::public.moneda OR v_ap.monto_aplicado <> 100 THEN
    RAISE EXCEPTION 'TEST FAIL: P1.3 - la aplicación no quedó en la moneda del anticipo (%, %)',
      v_ap.moneda_aplicada, v_ap.monto_aplicado;
  END IF;

  SELECT * INTO v_pago FROM public.pagos_proveedor WHERE id = v_ap.pago_proveedor_id;
  IF round(v_pago.monto_en_moneda_factura, 4) <> 86.6850 THEN
    RAISE EXCEPTION 'TEST FAIL: P1.3 - monto_en_moneda_factura esperado 86.6850 (DOF), obtuvo %',
      round(v_pago.monto_en_moneda_factura, 4);
  END IF;
  RAISE NOTICE '✓ P1.3: aplicación entre monedas valuada con el DOF del día (86.6850 EUR)';
END
$cruce$ LANGUAGE plpgsql;

ROLLBACK;
