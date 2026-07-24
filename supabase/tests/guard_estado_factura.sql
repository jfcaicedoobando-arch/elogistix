-- =============================================================
-- guard_estado_factura.sql · Ola 1 (auditoría de tests 2026-07-24)
--
-- Tests conductuales del guard `guard_estado_factura` — la máquina
-- de estados fiscal de CxC (nuevo en HEAD, sin cobertura):
--   · cancelar una factura con pagos vivos   → LC_FAC_CANCEL_CON_PAGOS
--   · reabrir una factura cancelada          → LC_FAC_REAPERTURA
--   · fijar a mano un estado calculado       → LC_FAC_ESTADO_CALCULADO
--   · bypass del recálculo automático        → permitido vía GUC
--   · cancelación limpia (sin pagos)         → permitida
--
-- Corre en CI como paso del workflow rls-tests. Fixture en
-- BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/guard_estado_factura.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_cli uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Guard Estado') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Estado', 'XAXX010101000', 'estado@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- Factura A: con un pago vivo (para CASO 1).
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    ('33333333-3333-3333-3333-333333333331', v_org, v_cli, 'Test Cli', 'F-EST-A',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 2000, 0, 2000, 'Emitida');
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
  VALUES
    ('44444444-4444-4444-4444-444444444411',
     '33333333-3333-3333-3333-333333333331', v_org,
     CURRENT_DATE, 500, 'MXN', 1, 500, 'Transferencia', 'EST-A', '', 0);

  -- Factura B: sin pagos (para cancelación limpia y reapertura).
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    ('33333333-3333-3333-3333-333333333332', v_org, v_cli, 'Test Cli', 'F-EST-B',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 1500, 0, 1500, 'Emitida');
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1: cancelar factura con pago vivo → P0001 LC_FAC_CANCEL_CON_PAGOS
-- -------------------------------------------------------------
DO $$
DECLARE v_state text; v_msg text;
BEGIN
  BEGIN
    UPDATE public.facturas SET estado = 'Cancelada'
     WHERE id = '33333333-3333-3333-3333-333333333331';
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_state <> 'P0001' OR v_msg NOT LIKE 'LC_FAC_CANCEL_CON_PAGOS%' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: esperado P0001/LC_FAC_CANCEL_CON_PAGOS, vino % / %', v_state, v_msg;
  END IF;
  RAISE NOTICE 'CASO 1 OK: cancelación con pagos vivos rechazada';
END $$;

-- -------------------------------------------------------------
-- CASO 2: fijar a mano 'Pagada' → P0001 LC_FAC_ESTADO_CALCULADO
-- -------------------------------------------------------------
DO $$
DECLARE v_state text; v_msg text;
BEGIN
  BEGIN
    UPDATE public.facturas SET estado = 'Pagada'
     WHERE id = '33333333-3333-3333-3333-333333333332';
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_state <> 'P0001' OR v_msg NOT LIKE 'LC_FAC_ESTADO_CALCULADO%' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: esperado P0001/LC_FAC_ESTADO_CALCULADO, vino % / %', v_state, v_msg;
  END IF;
  RAISE NOTICE 'CASO 2 OK: estado calculado no se puede fijar a mano';
END $$;

-- -------------------------------------------------------------
-- CASO 3: cancelación limpia (sin pagos) → permitida
-- -------------------------------------------------------------
DO $$
DECLARE v_estado public.estado_factura;
BEGIN
  UPDATE public.facturas SET estado = 'Cancelada'
   WHERE id = '33333333-3333-3333-3333-333333333332';
  SELECT estado INTO v_estado FROM public.facturas
   WHERE id = '33333333-3333-3333-3333-333333333332';
  IF v_estado <> 'Cancelada' THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: estado=% (esperado Cancelada)', v_estado;
  END IF;
  RAISE NOTICE 'CASO 3 OK: cancelación limpia permitida';
END $$;

-- -------------------------------------------------------------
-- CASO 4: reabrir factura cancelada → P0001 LC_FAC_REAPERTURA
-- -------------------------------------------------------------
DO $$
DECLARE v_state text; v_msg text;
BEGIN
  BEGIN
    UPDATE public.facturas SET estado = 'Emitida'
     WHERE id = '33333333-3333-3333-3333-333333333332';
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_state <> 'P0001' OR v_msg NOT LIKE 'LC_FAC_REAPERTURA%' THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: esperado P0001/LC_FAC_REAPERTURA, vino % / %', v_state, v_msg;
  END IF;
  RAISE NOTICE 'CASO 4 OK: reapertura de cancelada rechazada';
END $$;

-- -------------------------------------------------------------
-- CASO 5: bypass del recálculo automático → permitido
-- (el trigger recalcular_estado_factura opera así; como postgres
--  con el GUC app.recalc_estado_factura='1' debe poder fijar
--  'Pagada' manualmente)
-- -------------------------------------------------------------
DO $$
DECLARE v_estado public.estado_factura;
BEGIN
  PERFORM set_config('app.recalc_estado_factura', '1', true);
  UPDATE public.facturas SET estado = 'Pagada'
   WHERE id = '33333333-3333-3333-3333-333333333331';
  SELECT estado INTO v_estado FROM public.facturas
   WHERE id = '33333333-3333-3333-3333-333333333331';
  PERFORM set_config('app.recalc_estado_factura', '', true);
  IF v_estado <> 'Pagada' THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: bypass de recálculo no fijó Pagada (estado=%)', v_estado;
  END IF;
  RAISE NOTICE 'CASO 5 OK: bypass de recálculo funciona';
END $$;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 5 NOTICE "CASO n OK" y ROLLBACK.
-- =============================================================
