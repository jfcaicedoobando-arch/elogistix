-- =============================================================
-- cxc_guard_sobrepago.sql · Ola 1 (auditoría de tests 2026-07-24)
--
-- Tests conductuales anti-sobrepago de CxC sobre `public.pagos_factura`.
-- Gemelo de `cxp_guard_sobrepago.sql` (FIX-R3-01). Cubre AMBOS guards:
--   · `tg_pago_factura_no_sobrepago`     → LC_PAGO_EXCEDE_SALDO (P0001)
--   · `assert_factura_viva_para_pago`    → LC_PAGO_SOBREPAGO (23514)
--     (comparación directa NEW vs saldo-excl-self — el patrón correcto)
-- y el guard de tenant `LC_TENANT_MISMATCH` (23514).
--
-- Corre en CI como paso del workflow rls-tests. Todo el fixture vive
-- dentro de BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cxc_guard_sobrepago.sql
-- =============================================================

BEGIN;

-- Fixture con IDs deterministas.
DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_org2 uuid := '99999999-9999-9999-9999-999999999999';
  v_cli uuid := '22222222-2222-2222-2222-222222222222';
  v_fac uuid := '33333333-3333-3333-3333-333333333333';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Guard CxC'), (v_org2, 'Test Org2 Guard CxC')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Guard CxC', 'XAXX010101000', 'cxc@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- Factura MXN 3000 emitida (estado vivo: admite pagos).
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    (v_fac, v_org, v_cli, 'Test Cli', 'F-CXC-GUARD-01',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 3000, 0, 3000, 'Emitida');

  -- Factura auxiliar SIN pagos, exclusiva del CASO 7 (tenant mismatch).
  -- La factura principal queda saldada tras el CASO 5 y en ese estado el guard
  -- `zz_pago_factura_viva` dispara LC_PAGO_SOBREPAGO antes de que el guard de
  -- tenant (`zz_pagos_factura_no_sobrepago`) alcance a evaluarse.
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    ('33333333-3333-3333-3333-333333333307', v_org, v_cli, 'Test Cli', 'F-CXC-GUARD-07',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 3000, 0, 3000, 'Emitida');

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
    INSERT INTO public.pagos_factura
      (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
       monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
    VALUES
      ('44444444-4444-4444-4444-444444444401',
       '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111',
       CURRENT_DATE, 4000, 'MXN', 1, 4000, 'Transferencia', 'CXC-C1', '', 0);
    v_sqlstate := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
  END;
  IF v_sqlstate = '00000' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: INSERT de sobrepago fue aceptado';
  END IF;
  IF v_sqlstate NOT IN ('23514', 'P0001') THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: sqlstate inesperado % (esperado 23514/P0001)', v_sqlstate;
  END IF;
  RAISE NOTICE 'CASO 1 OK: INSERT sobrepago rechazado (%)', v_sqlstate;
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: INSERT válido (1000 de 3000) → pasa, estado → Parcial
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_aplicado numeric; v_estado public.estado_factura;
BEGIN
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
  VALUES
    ('44444444-4444-4444-4444-444444444402',
     '33333333-3333-3333-3333-333333333333',
     '11111111-1111-1111-1111-111111111111',
     CURRENT_DATE, 1000, 'MXN', 1, 1000, 'Transferencia', 'CXC-C2', '', 0);

  SELECT monto_aplicado_factura INTO v_aplicado
    FROM public.pagos_factura WHERE id = '44444444-4444-4444-4444-444444444402';
  IF v_aplicado <> 1000 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: monto_aplicado_factura=% (esperado 1000)', v_aplicado;
  END IF;
  SELECT estado INTO v_estado FROM public.facturas
   WHERE id = '33333333-3333-3333-3333-333333333333';
  IF v_estado <> 'Parcialmente pagada' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: estado=% (esperado Parcialmente pagada)', v_estado;
  END IF;
  RAISE NOTICE 'CASO 2 OK: pago válido aceptado, factura en Parcialmente pagada';
END
$caso2$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 3 (regresión del bug histórico CxP, en su gemelo CxC):
-- UPDATE que produce sobrepago (1000 → 3500; saldo real 2000)
-- → 23514/P0001. En la ventana OLD+saldo el guard débil pasa,
-- pero assert_factura_viva_para_pago (comparación directa) debe
-- rechazar SIEMPRE.
-- -------------------------------------------------------------
DO $caso3$
DECLARE
  v_sqlstate text;
BEGIN
  BEGIN
    UPDATE public.pagos_factura
       SET monto_aplicado_factura = 3500, monto = 3500
     WHERE id = '44444444-4444-4444-4444-444444444402';
    v_sqlstate := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
  END;
  IF v_sqlstate = '00000' THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: UPDATE a sobrepago (3500 > saldo 2000 + OLD 1000) fue aceptado';
  END IF;
  IF v_sqlstate NOT IN ('23514', 'P0001') THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: sqlstate inesperado % (esperado 23514/P0001)', v_sqlstate;
  END IF;
  RAISE NOTICE 'CASO 3 OK: UPDATE a sobrepago rechazado (%)', v_sqlstate;
END
$caso3$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 4: UPDATE legítimo (1000 → 2000; saldo 2000) → pasa
-- -------------------------------------------------------------
DO $caso4$
DECLARE
  v_aplicado numeric; v_saldo numeric;
BEGIN
  UPDATE public.pagos_factura
     SET monto_aplicado_factura = 2000, monto = 2000
   WHERE id = '44444444-4444-4444-4444-444444444402';

  SELECT monto_aplicado_factura INTO v_aplicado
    FROM public.pagos_factura WHERE id = '44444444-4444-4444-4444-444444444402';
  IF v_aplicado <> 2000 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: monto_aplicado_factura=% (esperado 2000)', v_aplicado;
  END IF;
  SELECT public.saldo_factura('33333333-3333-3333-3333-333333333333') INTO v_saldo;
  IF v_saldo <> 1000 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: saldo=% (esperado 1000)', v_saldo;
  END IF;
  RAISE NOTICE 'CASO 4 OK: UPDATE legítimo aceptado, saldo=1000';
END
$caso4$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 5: pago que COMPLETA la factura (1000) → estado Pagada
-- -------------------------------------------------------------
DO $caso5$
DECLARE
  v_estado public.estado_factura; v_saldo numeric;
BEGIN
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
  VALUES
    ('44444444-4444-4444-4444-444444444405',
     '33333333-3333-3333-3333-333333333333',
     '11111111-1111-1111-1111-111111111111',
     CURRENT_DATE, 1000, 'MXN', 1, 1000, 'Transferencia', 'CXC-C5', '', 0);

  SELECT estado INTO v_estado FROM public.facturas
   WHERE id = '33333333-3333-3333-3333-333333333333';
  IF v_estado <> 'Pagada' THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: estado=% (esperado Pagada)', v_estado;
  END IF;
  SELECT public.saldo_factura('33333333-3333-3333-3333-333333333333') INTO v_saldo;
  IF v_saldo <> 0 THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: saldo=% (esperado 0)', v_saldo;
  END IF;
  RAISE NOTICE 'CASO 5 OK: factura completada → Pagada, saldo=0';
END
$caso5$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 6: pago adicional sobre factura ya Pagada → 23514/P0001
-- -------------------------------------------------------------
DO $caso6$
DECLARE
  v_sqlstate text;
BEGIN
  BEGIN
    INSERT INTO public.pagos_factura
      (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
       monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
    VALUES
      ('44444444-4444-4444-4444-444444444406',
       '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111',
       CURRENT_DATE, 100, 'MXN', 1, 100, 'Transferencia', 'CXC-C6', '', 0);
    v_sqlstate := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
  END;
  IF v_sqlstate = '00000' THEN
    RAISE EXCEPTION 'CASO 6 FALLÓ: pago sobre factura saldada fue aceptado';
  END IF;
  IF v_sqlstate NOT IN ('23514', 'P0001') THEN
    RAISE EXCEPTION 'CASO 6 FALLÓ: sqlstate inesperado % (esperado 23514/P0001)', v_sqlstate;
  END IF;
  RAISE NOTICE 'CASO 6 OK: pago sobre factura saldada rechazado (%)', v_sqlstate;
END
$caso6$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 7: tenant mismatch (pago de org2 contra factura de org1)
-- → 23514 LC_TENANT_MISMATCH
-- -------------------------------------------------------------
DO $caso7$
DECLARE
  v_sqlstate text; v_msg text;
BEGIN
  BEGIN
    INSERT INTO public.pagos_factura
      (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
       monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
    VALUES
      ('44444444-4444-4444-4444-444444444407',
       '33333333-3333-3333-3333-333333333307',
       '99999999-9999-9999-9999-999999999999',
       CURRENT_DATE, 100, 'MXN', 1, 100, 'Transferencia', 'CXC-C7', '', 0);
    v_sqlstate := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_sqlstate = '00000' THEN
    RAISE EXCEPTION 'CASO 7 FALLÓ: pago cross-tenant fue aceptado';
  END IF;
  -- v13.777.9: los FK compuestos por org (Ola 2) rechazan el cruce ANTES del
  -- guard de pago, con LC_ORG_CRUZADA. Cualquiera de los dos candados es
  -- aceptable: lo importante es que el pago cross-tenant no entre.
  IF v_sqlstate <> '23514'
     OR (v_msg NOT LIKE 'LC_TENANT_MISMATCH%' AND v_msg NOT LIKE 'LC_ORG_CRUZADA%') THEN
    RAISE EXCEPTION 'CASO 7 FALLÓ: se esperaba LC_TENANT_MISMATCH/LC_ORG_CRUZADA con 23514, vino % / %', v_sqlstate, v_msg;
  END IF;
  RAISE NOTICE 'CASO 7 OK: tenant mismatch rechazado (%)', v_msg;
END
$caso7$ LANGUAGE plpgsql;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 7 NOTICE "CASO n OK" y ROLLBACK.
-- Cualquier RAISE EXCEPTION aborta el script (ON_ERROR_STOP=1).
-- =============================================================
