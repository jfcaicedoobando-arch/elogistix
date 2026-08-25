-- =============================================================
-- cxc_guard_pagada_sin_saldo.sql · BUG-2026-08-25 (facturas legacy)
--
-- Regla única del saldo: una factura en estado terminal
-- (`Pagada`, `Cancelada`, `Sustituida`, `Borrador`) SIEMPRE reporta saldo 0,
-- aunque falten pagos históricos en `pagos_factura`. Antes de este fix, las
-- facturas migradas marcadas "Pagada" sin pagos capturados inflaban el adeudo
-- del estado de cuenta y del portal ("saldo fantasma").
--
-- Cubre:
--   CASO 1 · `public.saldo_factura` devuelve 0 en factura Pagada sin pagos.
--   CASO 2 · el candado anti-sobrepago sigue permitiendo capturar el pago
--            histórico faltante (usa el saldo BRUTO, no el "por cobrar").
--   CASO 3 · no existe ninguna factura viva `Pagada` con saldo > 0.01
--            (invariante de datos: detecta regresiones del backfill).
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
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 5000, 0, 5000, 'Pagada');
END
$fixture$ LANGUAGE plpgsql;

-- ---------- CASO 1 · saldo 0 en estado terminal --------------------------
DO $caso1$
DECLARE
  v_saldo numeric;
BEGIN
  SELECT public.saldo_factura('33333333-3333-3333-3333-3333333333a5') INTO v_saldo;
  IF COALESCE(v_saldo, -1) <> 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: saldo=% en factura Pagada sin pagos (esperado 0)', v_saldo;
  END IF;
  RAISE NOTICE 'CASO 1 OK: factura Pagada sin pagos reporta saldo 0';
END
$caso1$ LANGUAGE plpgsql;

-- ---------- CASO 2 · el pago histórico faltante se puede capturar --------
DO $caso2$
DECLARE
  v_aplicado numeric;
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
  RAISE NOTICE 'CASO 2 OK: pago histórico de regularización aceptado';
END
$caso2$ LANGUAGE plpgsql;

-- ---------- CASO 3 · invariante: sin facturas Pagada con hueco -----------
DO $caso3$
DECLARE
  v_huecos int;
BEGIN
  SELECT count(*) INTO v_huecos
  FROM public.facturas f
  WHERE f.deleted_at IS NULL
    AND f.estado = 'Pagada'
    AND COALESCE(public.saldo_factura_bruto(f.id), 0) > 0.01;

  IF v_huecos > 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: % factura(s) Pagada con pagos faltantes (saldo bruto > 0)', v_huecos;
  END IF;
  RAISE NOTICE 'CASO 3 OK: ninguna factura Pagada con pagos faltantes';
END
$caso3$ LANGUAGE plpgsql;

ROLLBACK;
