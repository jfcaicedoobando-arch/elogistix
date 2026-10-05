-- AUD75: fixtures únicamente en PostgreSQL efímero; ROLLBACK revierte todo.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  cli uuid := gen_random_uuid();
  fac uuid;
  pagada uuid;
  pago uuid;
  n integer;
  importe numeric;
  exposicion record;
  error_acceso boolean := false;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD75');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email, limite_credito_mxn)
  VALUES (cli, fx.org_a, 'Cliente AUD75', 'XAXX010101000', 'aud75@example.invalid', 1000);

  FOR n IN 1..5 LOOP
    importe := CASE n WHEN 4 THEN 29 WHEN 5 THEN 29.04 ELSE 116 END;
    fac := gen_random_uuid();
    INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero, fecha_emision,
      fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, metodo_pago)
    VALUES (fac, fx.org_a, cli, 'Cliente AUD75', 'AUD75-A' || n, CURRENT_DATE,
      CURRENT_DATE + 30, 'MXN', 1, importe, 0, importe, 'Emitida', 'PPD');
    IF n <= 2 THEN
      pago := gen_random_uuid();
      INSERT INTO public.pagos_factura(id, factura_id, organization_id, fecha_pago, monto, moneda,
        tipo_cambio, monto_aplicado_factura, forma_pago)
      VALUES (pago, fac, fx.org_a, CURRENT_DATE, 116, 'MXN', 1, 116, 'Transferencia');
      IF n = 2 THEN pagada := fac; END IF;
    ELSIF n = 3 THEN
      INSERT INTO public.factura_notas_credito(organization_id, factura_id, folio, monto, moneda, tipo_cambio, estado, uuid_fiscal)
      VALUES (fx.org_a, fac, 'AUD75-NC58', 58, 'MXN', 1, 'Aplicada', gen_random_uuid()::text);
    END IF;
  END LOOP;

  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT * INTO STRICT exposicion FROM public.get_exposicion_credito_cliente(cli);
  PERFORM pg_temp.assert(exposicion.facturas_vivas = 3, 'AUD75: A1/A2 pagadas no cuentan entre las tres con saldo');
  PERFORM pg_temp.assert(exposicion.en_uso_mxn = 116.04 AND exposicion.disponible_mxn = 883.96,
    'AUD75: contador corregido conserva exposición 116.04 y disponible 883.96');

  -- El estado Pagada no es criterio financiero: un REP anulado reabre saldo canónico.
  PERFORM pg_temp.as_postgres();
  UPDATE public.pagos_factura SET estado_rep = 'Cancelado' WHERE factura_id = pagada;
  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT * INTO STRICT exposicion FROM public.get_exposicion_credito_cliente(cli);
  PERFORM pg_temp.assert(exposicion.facturas_vivas = 4 AND exposicion.en_uso_mxn = 232.04,
    'AUD75: contador y exposición comparten canon que excluye REP cancelado');

  PERFORM pg_temp.as_user(fx.admin_b);
  BEGIN
    PERFORM public.get_exposicion_credito_cliente(cli);
  EXCEPTION WHEN insufficient_privilege THEN
    error_acceso := true;
  END;
  PERFORM pg_temp.assert(error_acceso, 'AUD75: conserva rechazo del cliente de otra organización');
END;
$tests$;
ROLLBACK;
