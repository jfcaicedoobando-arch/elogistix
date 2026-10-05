-- Sólo Postgres efímero. Regresión de RPC/trigger reales, sin PAC ni datos remotos.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  cli uuid := gen_random_uuid();
  fac uuid := gen_random_uuid();
  fac2 uuid := gen_random_uuid();
  fac_mxn uuid := gen_random_uuid();
  fac_eur uuid := gen_random_uuid();
  pago uuid;
  req uuid := gen_random_uuid();
  historico uuid := gen_random_uuid();
  res jsonb;
  detalle jsonb;
  esperado numeric;
  tc numeric;
  recibido numeric;
  aplicado numeric;
  err text;
  antes integer;
  cambio text;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD88-93');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email)
  VALUES (cli, fx.org_a, 'AUD88-93', 'XAXX010101000', 'audit88-93@example.invalid');
  INSERT INTO public.tipos_cambio_dof(fecha, usd_mxn, eur_mxn, origen)
  VALUES (CURRENT_DATE-1,18.1903,20,'manual')
  ON CONFLICT(fecha) DO UPDATE SET usd_mxn=18.1903, eur_mxn=20;
  INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero, fecha_emision,
    fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, metodo_pago, uuid_fiscal)
  VALUES (fac, fx.org_a, cli, 'Fixture', 'AUD91-USD', CURRENT_DATE-1, CURRENT_DATE+30, 'USD', 18.1903, 100, 16, 116, 'Emitida', 'PPD', gen_random_uuid()::text),
    (fac2, fx.org_a, cli, 'Fixture', 'AUD91-USD2', CURRENT_DATE-1, CURRENT_DATE+30, 'USD', 18.1903, 100, 16, 116, 'Emitida', 'PPD', gen_random_uuid()::text),
    (fac_mxn, fx.org_a, cli, 'Fixture', 'AUD91-MXN', CURRENT_DATE-1, CURRENT_DATE+30, 'MXN', 1, 100, 16, 116, 'Emitida', 'PPD', gen_random_uuid()::text),
    (fac_eur, fx.org_a, cli, 'Fixture', 'AUD91-EUR', CURRENT_DATE-1, CURRENT_DATE+30, 'EUR', 20, 100, 16, 116, 'Emitida', 'PPD', gen_random_uuid()::text);
  PERFORM pg_temp.as_user(fx.admin_a);

  SELECT count(*) INTO antes FROM public.pagos_factura WHERE factura_id=fac;
  BEGIN
    PERFORM public.registrar_pago_factura_atomico(fac, CURRENT_DATE-1, 20, 'MXN', 20, 1, '99');
    RAISE EXCEPTION 'AUD88: 99 fue aceptada';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_PAGO_FORMA_REP_INVALIDA:%', 'AUD88: rechazo equivocado: '||err);
  END;
  PERFORM pg_temp.assert((SELECT count(*) FROM public.pagos_factura WHERE factura_id=fac)=antes, 'AUD88: no debe persistir pago99');
  BEGIN
    PERFORM public.registrar_pago_factura_atomico(fac, CURRENT_DATE-1, 1, 'USD', 1, 1, '03');
    RAISE EXCEPTION 'AUD91: TC neutral1 fue aceptado como valuación USD/MXN';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_PAGO_TC_NO_VERIFICABLE:%', 'AUD91: rechazo equivocado: '||err);
  END;

  res := public.registrar_pago_factura_atomico(fac, CURRENT_DATE-1, 1, 'USD', 18.1903, 1, '03', '', '', 999, NULL, req);
  pago := (res->>'pago_id')::uuid;
  PERFORM pg_temp.assert((SELECT monto=1 AND monto_aplicado_factura=1 AND tipo_cambio=18.1903 AND diferencia_cambiaria_mxn=0 FROM public.pagos_factura WHERE id=pago), 'AUD91: aplicación USD1 y valuación independiente');
  detalle := public.pago_detalle('cobro', pago);
  PERFORM pg_temp.assert((detalle#>>'{pago,monto_mxn}')::numeric=18.1903, 'AUD91: detalle debe valuar USD1 a MXN18.1903');
  PERFORM pg_temp.assert((public.registrar_pago_factura_atomico(fac, CURRENT_DATE-1, 1, 'USD', 18.1903, 1, '03', '', '', 0, NULL, req)->>'pago_id')::uuid=pago, 'AUD91: retry conserva cobro sin duplicar');

  -- AUD92/93: convenio positivo, negativo y paridad de emisión. El cliente miente
  -- deliberadamente sobre aplicado/diferencia; la BD conserva el cálculo real.
  FOREACH tc IN ARRAY ARRAY[20::numeric,17::numeric,18.1903::numeric] LOOP
    -- USD100 × 18.1903 = MXN1819.03: cero exacto con dinero recibido a centavos.
    aplicado := CASE WHEN tc=18.1903 THEN 100 ELSE 1 END;
    recibido := round(tc*aplicado,2);
    esperado := round(recibido-aplicado*18.1903,4);
    res := public.registrar_pago_factura_atomico(fac, CURRENT_DATE-1, recibido, 'MXN', tc, 7, '03', '', '', 999);
    pago := (res->>'pago_id')::uuid;
    PERFORM pg_temp.assert((SELECT monto=recibido AND monto_aplicado_factura=aplicado AND diferencia_cambiaria_mxn=esperado FROM public.pagos_factura WHERE id=pago), 'AUD93: cálculo autoritativo positivo/negativo/cero');
    detalle := public.pago_detalle('cobro', pago);
    PERFORM pg_temp.assert((detalle#>>'{pago,diferencia_cambiaria_mxn}')::numeric=esperado, 'AUD93: detalle conserva diferencia realizada');
    UPDATE public.pagos_factura SET diferencia_cambiaria_mxn=99 WHERE id=pago;
    PERFORM pg_temp.assert((SELECT diferencia_cambiaria_mxn=esperado FROM public.pagos_factura WHERE id=pago), 'AUD93: escritura directa no falsifica diferencia');
  END LOOP;
  PERFORM pg_temp.assert(public.saldo_factura(fac)=13, 'AUD91/92: USD1+1+1+100 dejan saldo13');

  res := public.registrar_pago_factura_atomico(fac_mxn, CURRENT_DATE-1, 1, 'MXN', 1, 1, '03');
  PERFORM pg_temp.assert((SELECT monto_aplicado_factura=1 AND diferencia_cambiaria_mxn=0 FROM public.pagos_factura WHERE id=(res->>'pago_id')::uuid), 'AUD91: controlMXN conserva factor1');
  res := public.registrar_pago_factura_atomico(fac_eur, CURRENT_DATE-1, 1, 'EUR', 21, 1, '03');
  PERFORM pg_temp.assert((SELECT monto_aplicado_factura=1 AND diferencia_cambiaria_mxn=1 FROM public.pagos_factura WHERE id=(res->>'pago_id')::uuid), 'AUD91: controlEUR aplica1 y realiza diferencia1');

  -- Lote actual utiliza la misma autoridad, sin multiplicar nominales del saldo.
  req := gen_random_uuid();
  res := public.registrar_pago_cliente_lote(jsonb_build_object('cliente_id',cli,'fecha_pago',CURRENT_DATE-1,
    'moneda','USD','tipo_cambio_usd',20,'forma_pago','03','importe_recibido',2,'request_id',req,
    'renglones',jsonb_build_array(jsonb_build_object('factura_id',fac,'monto',1),jsonb_build_object('factura_id',fac2,'monto',1))));
  PERFORM pg_temp.assert((SELECT count(*)=2 AND sum(monto_aplicado_factura)=2 AND sum(diferencia_cambiaria_mxn)=3.6194 FROM public.pagos_factura WHERE lote_id=(res->>'lote_id')::uuid), 'AUD91/93: loteUSD mantiene2 aplicados y diferencia3.6194');
  SELECT count(*) INTO antes FROM public.pagos_factura_lote WHERE cliente_id=cli;
  BEGIN
    PERFORM public.registrar_pago_cliente_lote(jsonb_build_object('cliente_id',cli,'fecha_pago',CURRENT_DATE-1,
      'moneda','USD','tipo_cambio_usd',20,'forma_pago','99','importe_recibido',2,'request_id',gen_random_uuid(),
      'renglones',jsonb_build_array(jsonb_build_object('factura_id',fac,'monto',1),jsonb_build_object('factura_id',fac2,'monto',1))));
    RAISE EXCEPTION 'AUD88: lote99 fue aceptado';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_PAGO_FORMA_REP_INVALIDA:%', 'AUD88: lote rechazado por otra causa: '||err);
  END;
  PERFORM pg_temp.assert((SELECT count(*) FROM public.pagos_factura_lote WHERE cliente_id=cli)=antes, 'AUD88: lote99 debe revertirse completo');

  -- Una vez reservado, la instantánea fiscal no cambia entre claim y PAC.
  UPDATE public.pagos_factura SET facturapi_rep_id='PENDING:00000000-0000-4000-8000-000000000091' WHERE id=pago;
  BEGIN
    UPDATE public.pagos_factura SET tipo_cambio=19 WHERE id=pago;
    RAISE EXCEPTION 'AUD92: edición monetaria durante claim permitida';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_PAGO_REP_EN_PROCESO:%', 'AUD92: rechazo de claim inesperado: '||err);
  END;
  FOREACH cambio IN ARRAY ARRAY['fecha_pago = CURRENT_DATE','created_at = now() + interval ''1 minute''','referencia = ''cambio fiscal''','deleted_at = now()'] LOOP
    BEGIN
      EXECUTE format('UPDATE public.pagos_factura SET %s WHERE id = $1', cambio) USING pago;
      RAISE EXCEPTION 'AUD92: cambio fiscal durante claim permitido: %', cambio;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
      PERFORM pg_temp.assert(err LIKE 'LC_PAGO_REP_EN_PROCESO:%', 'AUD92: rechazo de instantánea inesperado: '||err);
    END;
  END LOOP;
  BEGIN
    DELETE FROM public.pagos_factura WHERE id=pago;
    RAISE EXCEPTION 'AUD92: borrado durante primer claim permitido';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_PAGO_REP_EN_PROCESO:%', 'AUD92: rechazo DELETE inesperado: '||err);
  END;
  UPDATE public.pagos_factura SET rep_error='metadato de prueba' WHERE id=pago;
  PERFORM pg_temp.assert((SELECT diferencia_cambiaria_mxn=0 FROM public.pagos_factura WHERE id=pago), 'AUD93: metadatos no revalúan histórico');

  -- La liberación/cancelación del claim sigue siendo mantenimiento documental.
  UPDATE public.pagos_factura SET facturapi_rep_id=NULL, facturapi_rep_claim_at=NULL WHERE id=pago;
  UPDATE public.pagos_factura SET referencia='Tras liberar claim' WHERE id=pago;

  -- Simula un registro legado anterior a esta migración, sin reparar su TC.
  PERFORM pg_temp.as_postgres();
  ALTER TABLE public.pagos_factura DISABLE TRIGGER trg_pagos_factura_monto_convertido;
  INSERT INTO public.pagos_factura(id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
    monto_aplicado_factura, forma_pago, diferencia_cambiaria_mxn)
  VALUES (historico,fac2,fx.org_a,CURRENT_DATE-1,1,'USD',1,1,'99',0);
  ALTER TABLE public.pagos_factura ENABLE TRIGGER trg_pagos_factura_monto_convertido;
  PERFORM pg_temp.as_user(fx.admin_a);
  UPDATE public.pagos_factura SET rep_error='Diagnóstico histórico, sin retimbrar' WHERE id=historico;
  PERFORM pg_temp.assert((SELECT tipo_cambio=1 AND forma_pago='99' AND monto_aplicado_factura=1 AND diferencia_cambiaria_mxn=0
    FROM public.pagos_factura WHERE id=historico), 'AUD91/93: conservar metadatos e importes históricos sin backfill');
END;
$tests$;
ROLLBACK;
