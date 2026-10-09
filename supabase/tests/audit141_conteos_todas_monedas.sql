-- AUD141: header, full badge and filtered list share a documentary universe.
-- Disposable fixtures only; exact native balances, no aggregation across FX.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  o record;
  cli uuid := gen_random_uuid();
  cli2 uuid := gen_random_uuid();
  doc uuid;
  paid uuid := gen_random_uuid();
  credited uuid := gen_random_uuid();
  hoy date := public.fecha_negocio_mx();
  row_case record;
  kpis jsonb;
  n bigint;
BEGIN
  SELECT * INTO STRICT o FROM pg_temp.seed_org_pair('AUD141_ALL_CURRENCIES');
  INSERT INTO public.clientes(id, organization_id, nombre, email) VALUES
    (cli, o.org_a, 'AUD141 all currencies', 'audit141@example.invalid'),
    (cli2, o.org_a, 'AUD141 second client', 'audit141-2@example.invalid');
  INSERT INTO public.tipos_cambio_dof(fecha, usd_mxn, eur_mxn, origen)
    VALUES(hoy-2, 20, 22, 'manual'), (hoy, 20, 22, 'manual')
    ON CONFLICT(fecha) DO UPDATE SET usd_mxn=20, eur_mxn=22;
  FOR row_case IN SELECT * FROM (VALUES
    ('MXN', 'Emitida', -1, 100::numeric),
    ('USD', 'Emitida', -1, 50::numeric),
    ('EUR', 'Emitida', -1, 99::numeric),
    ('EUR', 'Emitida', 0, 20::numeric),
    ('EUR', 'Emitida', 1, 30::numeric),
    ('EUR', 'Borrador', -1, 40::numeric),
    ('EUR', 'Cancelada', -1, 40::numeric),
    ('EUR', 'Pagada', -1, 40::numeric)
  ) x(moneda, estado, days, total) LOOP
    doc := gen_random_uuid();
    INSERT INTO public.facturas(id, organization_id, cliente_id, numero, fecha_emision,
      fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
    VALUES(doc, o.org_a, cli, 'AUD141-ALL-'||doc::text, hoy-2, hoy+row_case.days,
      row_case.moneda::public.moneda, CASE WHEN row_case.moneda='MXN' THEN 1 ELSE 22 END,
      row_case.total, 0, row_case.total, row_case.estado::public.estado_factura);
  END LOOP;
  INSERT INTO public.facturas(id, organization_id, cliente_id, numero, fecha_emision,
    fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, metodo_pago)
  VALUES(paid, o.org_a, cli2, 'AUD141-EUR-PAID', hoy-2, hoy-1, 'EUR', 22, 1, .16, 1.16, 'Emitida', 'PPD'),
    (credited, o.org_a, cli2, 'AUD141-EUR-NC', hoy-2, hoy-1, 'EUR', 22, 10, 0, 10, 'Emitida', 'PPD');
  -- MXN 25.41 / 22 applies EUR 1.155: the native .005 remains a real cent.
  INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, forma_pago)
  VALUES(paid, o.org_a, hoy, 25.41, 'MXN', 22, 'Efectivo');
  PERFORM set_config('app.recalc_estado_factura', '1', true);
  UPDATE public.facturas SET estado='Pagada' WHERE id=paid;
  PERFORM set_config('app.recalc_estado_factura', '', true);
  INSERT INTO public.factura_notas_credito(organization_id, factura_id, folio, monto, moneda,
    tipo_cambio, fecha_emision, estado, uuid_fiscal, conceptos)
  VALUES(o.org_a, credited, 'AUD141-EUR-NC', 10, 'EUR', 22, hoy, 'Aplicada', gen_random_uuid()::text,
    '[{"descripcion":"Descuento global","cantidad":1,"precio_unitario":10,"total":10,"subtotal":10}]');
  PERFORM pg_temp.as_user(o.admin_a);
  PERFORM pg_temp.assert(public.saldo_factura(paid)=.005, 'AUD141 exact EUR native residual is preserved');
  kpis := public.cobranza_agregados();
  SELECT count(*) INTO n FROM public.cobranza_listado(p_estatus=>'Vencida');
  PERFORM pg_temp.assert(n=4 AND (kpis->>'facturas_vencidas')::bigint=n
    AND public.cobranza_conteo_vencidas(o.org_a)=n,
    'AUD141 all-currency header equals global badge and unfiltered overdue list');
  PERFORM pg_temp.assert((kpis->>'total_mxn')::numeric=100 AND (kpis->>'total_usd')::numeric=50
    AND (kpis->>'vencido_mxn')::numeric=100 AND (kpis->>'vencido_usd')::numeric=50,
    'AUD141 EUR contributes no converted or mixed MXN/USD amount');
  PERFORM pg_temp.assert(public.cobranza_conteo_por_cobrar(o.org_a)=2,
    'AUD141 EUR due today and tomorrow are not overdue');
  FOREACH doc IN ARRAY ARRAY[cli, cli2] LOOP
    kpis := public.cobranza_agregados(p_cliente_id=>doc);
    PERFORM pg_temp.assert((kpis->>'facturas_vencidas')::bigint=(SELECT count(*)
      FROM public.cobranza_listado(p_cliente_id=>doc, p_estatus=>'Vencida')),
      'AUD141 customer filter retained in header/list');
  END LOOP;
  FOR row_case IN SELECT unnest(ARRAY['MXN','USD','EUR']) AS moneda LOOP
    kpis := public.cobranza_agregados(p_moneda=>row_case.moneda);
    PERFORM pg_temp.assert((kpis->>'facturas_vencidas')::bigint=(SELECT count(*)
      FROM public.cobranza_listado(p_moneda=>row_case.moneda, p_estatus=>'Vencida')),
      'AUD141 currency filter retained; MXN never includes EUR');
  END LOOP;
  PERFORM pg_temp.assert((public.cobranza_agregados(p_cliente_id=>cli2, p_moneda=>'EUR')->>'facturas_vencidas')::bigint=1,
    'AUD141 paid EUR residual with active payment counts; effective EUR NC exhausts debt');
  PERFORM pg_temp.as_user(o.admin_b);
  PERFORM pg_temp.assert((public.cobranza_agregados()->>'facturas_vencidas')::bigint=0
    AND public.cobranza_conteo_vencidas(o.org_a)=0
    AND NOT EXISTS(SELECT 1 FROM public.cobranza_listado(p_estatus=>'Vencida')),
    'AUD141 org_scope preserved in header, badge and list');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(NOT has_function_privilege('anon', 'public.cobranza_agregados(uuid,text)', 'EXECUTE'),
    'AUD141 header remains unavailable to anon');
END $tests$;
ROLLBACK;
