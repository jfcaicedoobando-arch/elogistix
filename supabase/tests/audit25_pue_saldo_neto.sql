-- AUD25: pagos reales, NC canónicas y una sola exhibición. Sólo DB efímera.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  fac uuid := gen_random_uuid();
  sin_nc uuid := gen_random_uuid();
  cli uuid := gen_random_uuid();
  pago uuid := gen_random_uuid();
  err text;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD25');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES (cli, fx.org_a, 'AUD25', 'XAXX010101000', 'aud25@example.invalid');
  INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero, fecha_emision,
    fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, metodo_pago)
  VALUES (fac, fx.org_a, cli, 'Fixture', 'AUD25-NC', CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 1, 100, 16, 116, 'Emitida', 'PUE'),
         (sin_nc, fx.org_a, cli, 'Fixture', 'AUD25-SIN-NC', CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 1, 100, 16, 116, 'Emitida', 'PUE');
  INSERT INTO public.factura_notas_credito(organization_id, factura_id, folio, monto, moneda, tipo_cambio, estado, uuid_fiscal)
  VALUES (fx.org_a, fac, 'AUD25-USD', 1, 'USD', 20, 'Timbrada', gen_random_uuid()::text),
         (fx.org_a, fac, 'AUD25-MXN', 38, 'MXN', 1, 'Aplicada', gen_random_uuid()::text),
         (fx.org_a, fac, 'AUD25-DRAFT', 5, 'MXN', 1, 'Borrador', NULL),
         (fx.org_a, fac, 'AUD25-CANCEL', 5, 'MXN', 1, 'Cancelada', NULL);
  INSERT INTO public.factura_notas_credito(organization_id, factura_id, folio, monto, moneda, tipo_cambio, estado, uuid_fiscal, deleted_at)
  VALUES (fx.org_a, fac, 'AUD25-DELETED', 5, 'MXN', 1, 'Timbrada', gen_random_uuid()::text, now());
  PERFORM pg_temp.assert(public._nc_aplicadas_moneda_factura(fac) = 58, 'AUD25: autoridad NC debe descontar58 y excluir borrador/cancelada/deleted');
  PERFORM pg_temp.as_user(fx.admin_a);
  BEGIN
    INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago)
    VALUES (fac, fx.org_a, CURRENT_DATE, 57, 'MXN', 1, 57, 'Transferencia');
    RAISE EXCEPTION 'AUD25: pago parcial57 fue permitido';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL:%', 'AUD25: error parcial distinto: ' || err);
    PERFORM pg_temp.assert(err NOT ILIKE '%PPD%', 'AUD25: no recomendar cambiar CFDI emitido');
  END;
  INSERT INTO public.pagos_factura(id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago)
  VALUES (pago, fac, fx.org_a, CURRENT_DATE, 2.90, 'USD', 20, 58, 'Transferencia');
  PERFORM pg_temp.assert(public.saldo_factura(fac) = 0, 'AUD25: NC58 más cobroUSD2.90 debe liquidar116');
  UPDATE public.pagos_factura SET monto = 2.90, monto_aplicado_factura = 58 WHERE id = pago;
  BEGIN
    INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago)
    VALUES (fac, fx.org_a, CURRENT_DATE, 0.01, 'MXN', 1, 0.01, 'Transferencia');
    RAISE EXCEPTION 'AUD25: segunda exhibición fue permitida';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_PAGO_%', 'AUD25: rechazo segunda exhibición inesperado: ' || err);
  END;
  UPDATE public.pagos_factura SET estado_rep = 'Cancelado' WHERE id = pago;
  INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago)
  VALUES (fac, fx.org_a, CURRENT_DATE, 58, 'MXN', 1, 58, 'Transferencia'),
         (sin_nc, fx.org_a, CURRENT_DATE, 116, 'MXN', 1, 116, 'Transferencia');
  PERFORM pg_temp.assert(public.saldo_factura(fac) = 0 AND public.saldo_factura(sin_nc) = 0, 'AUD25: REP cancelado no consume exhibición y PUE sinNC sigue116');
END;
$tests$;
ROLLBACK;
