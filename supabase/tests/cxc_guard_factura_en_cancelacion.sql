-- =============================================================
-- cxc_guard_factura_en_cancelacion.sql · v13.592.0
--
-- Una factura con solicitud de cancelación viva ante el SAT
-- (`facturas.cancellation_status` = pending | verifying) NO admite cobros:
-- `assert_factura_viva_para_pago` debe abortar con LC_FACTURA_EN_CANCELACION.
-- Cuando el SAT rechaza la cancelación (status distinto), vuelve a admitirlos.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cxc_guard_factura_en_cancelacion.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '1a1a1a1a-1111-1111-1111-1111111111aa';
  v_cli uuid := '2a2a2a2a-2222-2222-2222-2222222222aa';
  v_fac uuid := '3a3a3a3a-3333-3333-3333-3333333333aa';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Cancelacion CxC')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Cancelacion', 'XAXX010101000', 'cancel@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado,
     cancellation_status)
  VALUES
    (v_fac, v_org, v_cli, 'Test Cli', 'F-CANCEL-GUARD-01',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 1000, 0, 1000, 'Emitida', 'verifying')
  ON CONFLICT (id) DO NOTHING;
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1: cobro sobre factura en verificación → rechazado.
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_sqlstate text; v_msg text;
BEGIN
  BEGIN
    INSERT INTO public.pagos_factura
      (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
       monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
    VALUES
      ('4a4a4a4a-4444-4444-4444-4444444444a1',
       '3a3a3a3a-3333-3333-3333-3333333333aa',
       '1a1a1a1a-1111-1111-1111-1111111111aa',
       CURRENT_DATE, 500, 'MXN', 1, 500, 'Transferencia', 'CANCEL-C1', '', 0);
    v_sqlstate := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_sqlstate = '00000' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: se aceptó un cobro con cancelación en trámite';
  END IF;
  IF v_msg NOT LIKE 'LC_FACTURA_EN_CANCELACION%' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: mensaje inesperado %', v_msg;
  END IF;
  RAISE NOTICE 'CASO 1 OK: cobro rechazado (%) %', v_sqlstate, v_msg;
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: SAT rechaza la cancelación → la factura vuelve a cobrarse.
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_aplicado numeric;
BEGIN
  UPDATE public.facturas SET cancellation_status = 'rejected'
   WHERE id = '3a3a3a3a-3333-3333-3333-3333333333aa';

  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
  VALUES
    ('4a4a4a4a-4444-4444-4444-4444444444a2',
     '3a3a3a3a-3333-3333-3333-3333333333aa',
     '1a1a1a1a-1111-1111-1111-1111111111aa',
     CURRENT_DATE, 500, 'MXN', 1, 500, 'Transferencia', 'CANCEL-C2', '', 0);

  SELECT monto_aplicado_factura INTO v_aplicado
    FROM public.pagos_factura WHERE id = '4a4a4a4a-4444-4444-4444-4444444444a2';
  IF v_aplicado <> 500 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: no se registró el cobro tras el rechazo del SAT';
  END IF;
  RAISE NOTICE 'CASO 2 OK: cancelación rechazada por el SAT ⇒ la factura admite cobros';
END
$caso2$ LANGUAGE plpgsql;

ROLLBACK;
