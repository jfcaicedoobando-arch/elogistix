-- Extensión70: fixtures locales transaccionales; sin alterar protecciones ni historia.
BEGIN;
\i supabase/tests/rls/_helpers.sql

-- El helper compartido admite NULL accidentalmente: esta suite exige TRUE.
CREATE OR REPLACE FUNCTION pg_temp.assert(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'RLS TEST FAIL: %', msg;
  END IF;
END;
$$;

DO $tests$
DECLARE
  fx record;
  prov uuid := gen_random_uuid(); cat uuid := gen_random_uuid();
  usd uuid := gen_random_uuid(); mxn uuid := gen_random_uuid();
  eur uuid := gen_random_uuid(); parcial uuid := gen_random_uuid();
  cancelada uuid := gen_random_uuid(); borrada uuid := gen_random_uuid();
  completa uuid := gen_random_uuid(); nc_completa uuid := gen_random_uuid();
  nc_usd uuid := gen_random_uuid(); nc_mxn uuid := gen_random_uuid();
  nc_eur uuid := gen_random_uuid(); nc_parcial uuid := gen_random_uuid();
  pago uuid := gen_random_uuid(); row_actual record; valor numeric; body text;
  hoy date := public.fecha_negocio_mx();
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD70_POR_PAGAR');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES(prov, fx.org_a, 'AUD70 Por Pagar', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre)
    VALUES(cat, fx.org_a, 'AUD70 Por Pagar');
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id,
    categoria_presupuesto_id, folio_proveedor, fecha_emision, fecha_vencimiento,
    dias_credito, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
  VALUES
    (usd, fx.org_a, prov, cat, 'AUD70-FP12', hoy-10, hoy-1, 9, 'USD', 25, 116, 116, 'Vigente', 'aprobada'),
    (mxn, fx.org_a, prov, cat, 'AUD70-MXN', hoy-10, hoy+2, 12, 'MXN', 1, 2300, 2300, 'Vigente', 'aprobada'),
    (eur, fx.org_a, prov, cat, 'AUD70-EUR', hoy-10, hoy+3, 13, 'EUR', 25, 1, 1, 'Vigente', 'aprobada'),
    (parcial, fx.org_a, prov, cat, 'AUD70-PARCIAL', hoy-10, hoy+10, 20, 'USD', 25, 200, 200, 'Vigente', 'aprobada'),
    (cancelada, fx.org_a, prov, cat, 'AUD70-CANCELADA', hoy-10, hoy-2, 8, 'MXN', 1, 10, 10, 'Cancelada', 'aprobada'),
    (borrada, fx.org_a, prov, cat, 'AUD70-BORRADA', hoy-10, hoy-3, 7, 'MXN', 1, 10, 10, 'Vigente', 'aprobada'),
    (completa, fx.org_a, prov, cat, 'AUD70-COMPLETA', hoy-10, hoy+4, 14, 'USD', 25, 1, 1, 'Vigente', 'aprobada');
  UPDATE public.proveedor_facturas SET deleted_at = now() WHERE id = borrada;
  INSERT INTO public.proveedor_notas_credito(id, organization_id, proveedor_factura_id,
    fecha, folio_nc, monto, subtotal, moneda, tipo_cambio, tipo_cambio_mxn)
  VALUES
    (nc_usd, fx.org_a, usd, hoy-5, 'AUD70-NC-MXN', 2000, 2000, 'MXN', 20, 1),
    (nc_mxn, fx.org_a, mxn, hoy-5, 'AUD70-NC-USD', 100, 100, 'USD', 20, 20),
    (nc_eur, fx.org_a, eur, hoy-5, 'AUD70-NC-EUR-PRECISION', 1.10, 1.10, 'MXN', 20, 1),
    (nc_parcial, fx.org_a, parcial, hoy-5, 'AUD70-NC-PARCIAL', 30, 30, 'USD', NULL, 22),
    (nc_completa, fx.org_a, completa, hoy-5, 'AUD70-NC-COMPLETA', 1, 1, 'USD', NULL, 25);
  INSERT INTO public.pagos_proveedor(id, organization_id, proveedor_factura_id,
    fecha_pago, monto, moneda, tipo_cambio_usd, metodo_pago)
  VALUES(pago, fx.org_a, parcial, hoy-4, 400, 'MXN', 20, 'Transferencia');

  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT * INTO STRICT row_actual FROM public.cxp_por_pagar() WHERE factura_id = usd;
  PERFORM pg_temp.assert(row_actual.saldo = 116 AND row_actual.pagado = 0,
    'AUD70 Por Pagar: a draft NC must not reduce balance');
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada'
    WHERE id IN (nc_usd, nc_mxn, nc_eur, nc_parcial, nc_completa);
  SELECT * INTO STRICT row_actual FROM public.cxp_por_pagar() WHERE factura_id = usd;
  PERFORM pg_temp.assert(row_actual.saldo = 116,
    'AUD70 Por Pagar: approved but unapplied NC must not reduce balance');
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada'
    WHERE id IN (nc_usd, nc_mxn, nc_eur, nc_parcial, nc_completa);

  SELECT * INTO STRICT row_actual FROM public.cxp_por_pagar() WHERE factura_id = usd;
  PERFORM pg_temp.assert(row_actual.saldo = 16 AND row_actual.total = 116 AND row_actual.pagado = 0,
    'AUD70 Por Pagar: USD116 minus applied MXN2000 at NC TC20 must be USD16, never USD116');
  PERFORM pg_temp.assert(row_actual.moneda = 'USD' AND row_actual.tipo_cambio_usd = 25
    AND row_actual.fecha_vencimiento = hoy-1
    AND row_actual.dias_para_vencer = hoy-1-CURRENT_DATE,
    'AUD70/85: native currency, documentary TC and due-date contract remain intact');
  SELECT * INTO STRICT row_actual FROM public.cxp_por_pagar() WHERE factura_id = mxn;
  PERFORM pg_temp.assert(row_actual.saldo = 300 AND row_actual.pagado = 0,
    'AUD70 Por Pagar: inverse USD100 at TC20 reduces MXN2300 to MXN300');
  SELECT * INTO STRICT row_actual FROM public.cxp_por_pagar() WHERE factura_id = eur;
  PERFORM pg_temp.assert(row_actual.saldo = 0.945 AND row_actual.moneda = 'EUR',
    'AUD70 Por Pagar: preserve exact EUR0.945, not rounded JSON helper EUR0.95');
  SELECT * INTO STRICT row_actual FROM public.cxp_por_pagar() WHERE factura_id = parcial;
  PERFORM pg_temp.assert(row_actual.pagado = 20 AND row_actual.saldo = 150
    AND row_actual.fecha_vencimiento = hoy+10 AND row_actual.dias_para_vencer = hoy+10-CURRENT_DATE,
    'AUD70 Por Pagar: frozen payment20 and same-currency NC30 each subtract once');
  PERFORM pg_temp.assert((SELECT estado::text FROM public.proveedor_facturas WHERE id = completa) = 'Pagada'
    AND (SELECT saldo FROM public.v_proveedor_facturas_saldo WHERE proveedor_factura_id = completa) = 0
    AND NOT EXISTS(SELECT 1 FROM public.cxp_por_pagar() WHERE factura_id = completa),
    'AUD70 Por Pagar: fully credited invoice becomes Pagada and keeps original Vigente-only membership');
  PERFORM pg_temp.assert(NOT EXISTS(
    SELECT 1 FROM public.cxp_por_pagar() b
    JOIN public.v_proveedor_facturas_saldo s ON s.proveedor_factura_id = b.factura_id
    WHERE b.saldo IS DISTINCT FROM s.saldo OR b.pagado IS DISTINCT FROM s.pagado),
    'AUD70 Por Pagar: every returned amount must match canonical view exactly');
  SELECT sum(saldo) INTO STRICT valor FROM public.cxp_por_pagar() WHERE moneda = 'USD';
  PERFORM pg_temp.assert(valor = 166,
    'AUD70 Por Pagar: native USD aggregate uses net invoice balances');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.cxp_por_pagar()) = 4
    AND NOT EXISTS(SELECT 1 FROM public.cxp_por_pagar() WHERE factura_id IN(cancelada,borrada)),
    'AUD70 Por Pagar: preserve live Vigente invoice membership');
  PERFORM pg_temp.assert((SELECT array_agg(factura_id) FROM public.cxp_por_pagar())
    IS NOT DISTINCT FROM ARRAY[usd,mxn,eur,parcial],
    'AUD70 Por Pagar: sort distinct due dates in ascending order');


  UPDATE public.proveedor_notas_credito SET deleted_at = now() WHERE id = nc_usd;
  UPDATE public.proveedor_notas_credito SET estado = 'Cancelada' WHERE id = nc_mxn;
  UPDATE public.pagos_proveedor SET deleted_at = now() WHERE id = pago;
  SELECT saldo INTO STRICT valor FROM public.cxp_por_pagar() WHERE factura_id = usd;
  PERFORM pg_temp.assert(valor = 116, 'AUD70 Por Pagar: deleted applied NC no longer reduces balance');
  SELECT saldo INTO STRICT valor FROM public.cxp_por_pagar() WHERE factura_id = mxn;
  PERFORM pg_temp.assert(valor = 2300, 'AUD70 Por Pagar: canceled NC no longer reduces balance');
  SELECT * INTO STRICT row_actual FROM public.cxp_por_pagar() WHERE factura_id = parcial;
  PERFORM pg_temp.assert(row_actual.pagado = 0 AND row_actual.saldo = 170,
    'AUD70 Por Pagar: deleted payment excluded while active NC still applies');

  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.cxp_por_pagar()),
    'AUD70 Por Pagar: other tenant cannot see invoices or canonical balances');
  PERFORM pg_temp.as_postgres();
  -- Read-only contract check for legacy frozen NULL: never invent nominal money.
  body := regexp_replace(lower(pg_get_viewdef('public.v_proveedor_facturas_saldo'::regclass)), '[[:space:]]+', '', 'g');
  PERFORM pg_temp.assert(position('sum(pp.monto_en_moneda_factura)' IN body) > 0
    AND position('coalesce(pp.monto_en_moneda_factura,' IN body) = 0,
    'AUD70 Por Pagar: canonical payment sum never substitutes nominal amount for unknown frozen NULL');
  body := regexp_replace(lower(pg_get_functiondef('public.cxp_por_pagar()'::regprocedure)), '[[:space:]]+', '', 'g');
  PERFORM pg_temp.assert(position('joinpublic.v_proveedor_facturas_saldosons.proveedor_factura_id=pf.id' IN body) > 0
    AND position('s.pagado,s.saldo' IN body) > 0
    AND position('orderbypf.fecha_vencimientonullslast,pf.created_atdesc' IN body) > 0
    AND position('limit500' IN body) > 0,
    'AUD70 Por Pagar: use canonical unrounded balance directly with original 500 row cap');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD70 Por Pagar: applied/live NC, own FX, precision, frozen payments, filters, totals and tenant isolation passed';
END;
$tests$;
ROLLBACK;
