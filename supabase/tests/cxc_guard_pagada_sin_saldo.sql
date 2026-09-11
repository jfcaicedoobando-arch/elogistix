-- =============================================================
-- cxc_guard_pagada_sin_saldo.sql · BUG-2026-08-25 → Ola v17 (F1015)
--
-- Regla ÚNICA del saldo (v13.823.296, `public._saldo_factura_calc`):
--   saldo = total − cobros VIGENTES − NC aplicadas (en moneda de la factura).
--   Sólo `Cancelada` y `Sustituida` fuerzan saldo 0.
--
-- El atajo histórico "si estado = `Pagada` entonces saldo 0" SE ELIMINÓ: hacía
-- depender el saldo del estado y el estado del saldo (circularidad). Con él,
-- una factura cuyo REP se canceló seguía reportando saldo 0 y no admitía nota
-- de crédito (bug de la factura 1015). Este guard fija la regla nueva para que
-- nadie reintroduzca el atajo.
--
-- Cubre:
--   CASO 1 · `Pagada` sin pagos capturados reporta su saldo REAL (no 0).
--   CASO 2 · el candado anti-sobrepago permite capturar el pago histórico
--            faltante y, al capturarlo, el saldo cae a 0.
--   CASO 3 · `Cancelada` / `Sustituida` sí reportan 0 (estados terminales).
--   CASO 4 · un cobro ANULADO por REP cancelado no abate el saldo.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cxc_guard_pagada_sin_saldo.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-1111111111a5';
  v_cli uuid := '22222222-2222-2222-2222-2222222222a5';
  v_fac uuid := '33333333-3333-3333-3333-3333333333a5';
  v_fac_can uuid := '33333333-3333-3333-3333-3333333333a6';
  v_fac_rep uuid := '33333333-3333-3333-3333-3333333333a7';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Guard Pagada')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Guard Pagada', 'XAXX010101000', 'pagada@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- Factura legacy: estado Pagada, CERO pagos capturados.
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    (v_fac, v_org, v_cli, 'Test Cli', 'F-LEGACY-PAGADA-01',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 5000, 0, 5000, 'Pagada'),
    (v_fac_can, v_org, v_cli, 'Test Cli', 'F-LEGACY-CANCELADA-01',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 7000, 0, 7000, 'Cancelada'),
    (v_fac_rep, v_org, v_cli, 'Test Cli', 'F-REP-CANCELADO-01',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 3000, 0, 3000, 'Pagada');
END
$fixture$ LANGUAGE plpgsql;

-- ---------- CASO 1 · Pagada sin pagos reporta su saldo real --------------
DO $caso1$
DECLARE
  v_saldo numeric;
BEGIN
  SELECT public.saldo_factura('33333333-3333-3333-3333-3333333333a5') INTO v_saldo;
  IF COALESCE(v_saldo, -1) <> 5000 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: saldo=% en factura Pagada sin pagos (esperado 5000: el estado no fabrica saldo 0)', v_saldo;
  END IF;
  RAISE NOTICE 'CASO 1 OK: el saldo sale de los cobros, no del estado';
END
$caso1$ LANGUAGE plpgsql;

-- ---------- CASO 2 · el pago histórico faltante se puede capturar --------
DO $caso2$
DECLARE
  v_aplicado numeric;
  v_saldo numeric;
BEGIN
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
  VALUES
    ('44444444-4444-4444-4444-4444444444a5',
     '33333333-3333-3333-3333-3333333333a5',
     '11111111-1111-1111-1111-1111111111a5',
     CURRENT_DATE, 5000, 'MXN', 1, 5000, 'Transferencia', 'AJUSTE-LEGACY', '', 0);

  SELECT monto_aplicado_factura INTO v_aplicado
    FROM public.pagos_factura WHERE id = '44444444-4444-4444-4444-4444444444a5';
  IF v_aplicado <> 5000 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: monto_aplicado_factura=% (esperado 5000)', v_aplicado;
  END IF;

  SELECT public.saldo_factura('33333333-3333-3333-3333-3333333333a5') INTO v_saldo;
  IF COALESCE(v_saldo, -1) <> 0 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: tras capturar el pago el saldo quedó en % (esperado 0)', v_saldo;
  END IF;
  RAISE NOTICE 'CASO 2 OK: pago histórico aceptado y saldo liquidado';
END
$caso2$ LANGUAGE plpgsql;

-- ---------- CASO 3 · estados terminales sí reportan 0 -------------------
DO $caso3$
DECLARE
  v_saldo numeric;
  v_bruto numeric;
BEGIN
  SELECT public.saldo_factura('33333333-3333-3333-3333-3333333333a6') INTO v_saldo;
  SELECT public.saldo_factura_bruto('33333333-3333-3333-3333-3333333333a6') INTO v_bruto;
  IF COALESCE(v_saldo, -1) <> 0 OR COALESCE(v_bruto, -1) <> 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: factura Cancelada reporta saldo=% / bruto=% (esperado 0)', v_saldo, v_bruto;
  END IF;
  RAISE NOTICE 'CASO 3 OK: Cancelada/Sustituida son los únicos estados que fuerzan 0';
END
$caso3$ LANGUAGE plpgsql;

-- ---------- CASO 4 · cobro anulado por REP cancelado no abate -----------
DO $caso4$
DECLARE
  v_saldo numeric;
BEGIN
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas,
     diferencia_cambiaria_mxn, estado_rep)
  VALUES
    ('44444444-4444-4444-4444-4444444444a7',
     '33333333-3333-3333-3333-3333333333a7',
     '11111111-1111-1111-1111-1111111111a5',
     CURRENT_DATE, 3000, 'MXN', 1, 3000, 'Transferencia', 'REP-CANCELADO', '', 0,
     'Cancelado');

  SELECT public.saldo_factura('33333333-3333-3333-3333-3333333333a7') INTO v_saldo;
  IF COALESCE(v_saldo, -1) <> 3000 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: saldo=% con un cobro ANULADO por REP cancelado (esperado 3000)', v_saldo;
  END IF;
  RAISE NOTICE 'CASO 4 OK: los cobros anulados no abaten el saldo';
END
$caso4$ LANGUAGE plpgsql;

ROLLBACK;
