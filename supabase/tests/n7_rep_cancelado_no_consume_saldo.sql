-- =============================================================
-- n7_rep_cancelado_no_consume_saldo.sql · v13.823.390
--
-- N7: un cobro cuyo REP quedó CANCELADO ante el SAT está ANULADO y NO consume
-- saldo. El canon (`_saldo_factura_calc`, `cartera_pendiente`) ya lo excluía,
-- pero `assert_factura_viva_para_pago` sumaba `pagos_factura` en bruto: tras
-- cancelar un REP la UI mostraba saldo y la BD rechazaba el cobro de reemplazo
-- como sobrepago.
--
--   · CASO 1 (positivo): pago de 1000 con REP 'Cancelado' + cobro de reemplazo
--     por los mismos 1000 → se acepta.
--   · CASO 2 (negativo): con el pago VIVO, un segundo cobro de 1000 sigue
--     fallando con LC_PAGO_SOBREPAGO.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/n7_rep_cancelado_no_consume_saldo.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org uuid;
  v_cli uuid;
  v_fac uuid := gen_random_uuid();
  v_fac2 uuid := gen_random_uuid();
  v_pago uuid := gen_random_uuid();
  v_sqlstate text;
  v_msg text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST N7 REP CANCELADO', 'TN7000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE N7', 'XAXX010101000', 'n7@test.mx')
  RETURNING id INTO v_cli;

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, tipo_cambio, estado)
  VALUES
    (v_fac, v_org, v_cli, 'CLIENTE N7', 'F-N7-0001',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 1000, 0, 1000, 1, 'Emitida'),
    (v_fac2, v_org, v_cli, 'CLIENTE N7', 'F-N7-0002',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 1000, 0, 1000, 1, 'Emitida');

  -- ── CASO 1 · pago con REP cancelado no consume saldo.
  INSERT INTO public.pagos_factura
    (id, organization_id, factura_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas)
  VALUES
    (v_pago, v_org, v_fac, CURRENT_DATE, 1000, 'MXN', 1, 1000, '03', 'N7-C1', '');

  UPDATE public.pagos_factura SET estado_rep = 'Cancelado' WHERE id = v_pago;

  INSERT INTO public.pagos_factura
    (organization_id, factura_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas)
  VALUES
    (v_org, v_fac, CURRENT_DATE, 1000, 'MXN', 1, 1000, '03', 'N7-C1-REEMPLAZO', '');
  RAISE NOTICE 'CASO 1 OK: el cobro de reemplazo se aceptó tras cancelar el REP';

  -- ── CASO 2 · con el pago vivo, el sobrepago sigue bloqueado.
  INSERT INTO public.pagos_factura
    (organization_id, factura_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas)
  VALUES
    (v_org, v_fac2, CURRENT_DATE, 1000, 'MXN', 1, 1000, '03', 'N7-C2', '');

  BEGIN
    INSERT INTO public.pagos_factura
      (organization_id, factura_id, fecha_pago, monto, moneda, tipo_cambio,
       monto_aplicado_factura, forma_pago, referencia, notas)
    VALUES
      (v_org, v_fac2, CURRENT_DATE, 1000, 'MXN', 1, 1000, '03', 'N7-C2-DUP', '');
    v_sqlstate := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_sqlstate = '00000' THEN
    RAISE EXCEPTION 'REGRESION P0: se aceptó un sobrepago con el REP vivo';
  END IF;
  IF v_msg !~ 'LC_PAGO_(SOBREPAGO|EXCEDE_SALDO)' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: se esperaba sobrepago bloqueado, se obtuvo: %', v_msg;
  END IF;
  RAISE NOTICE 'CASO 2 OK: el sobrepago con REP vivo sigue bloqueado';
END;
$$;

ROLLBACK;
