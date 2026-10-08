-- Extension70, not a new finding. Real aggregate RPC and detail view, isolated
-- transactional fixtures only. No historical rewrite or disabled protections.
BEGIN;
\i supabase/tests/rls/_helpers.sql

-- The shared assertion helper permits NULL; this local assertion fails closed.
CREATE FUNCTION pg_temp.audit70_assert(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $assert$
BEGIN
  IF cond IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'AUD70 TEST FAIL: %', msg; END IF;
END $assert$;

DO $tests$
DECLARE
  o record;
  prov uuid := gen_random_uuid();
  cat uuid := gen_random_uuid();
  f_usd uuid := gen_random_uuid();
  f_mxn uuid := gen_random_uuid();
  f_eur uuid := gen_random_uuid();
  f_eur_mxn uuid := gen_random_uuid();
  f_mixed uuid := gen_random_uuid();
  f_same uuid := gen_random_uuid();
  f_full uuid := gen_random_uuid();
  f_round uuid := gen_random_uuid();
  f_future uuid := gen_random_uuid();
  f_boundary uuid;
  nc uuid := gen_random_uuid();
  deleted_nc uuid := gen_random_uuid();
  cancelled_nc uuid := gen_random_uuid();
  p uuid;
  a public.anticipos_proveedor;
  ap public.anticipos_aplicaciones;
  r record;
  currency text;
  day_offset integer;
  cutoff date := public.fecha_negocio_mx();
  reference_date date;
  body text;
  balance numeric;
  count_open integer;
  buckets numeric[];
BEGIN
  SELECT * INTO STRICT o FROM pg_temp.seed_org_pair('AUD70_AGING');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (prov, o.org_a, 'AUD70 aging canonical', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre)
  VALUES (cat, o.org_a, 'AUD70 aging canonical');
  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, fecha_vencimiento, dias_credito, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion
  ) VALUES (f_usd, o.org_a, prov, cat, 'AUD70-USD116', cutoff - 10, cutoff - 1, 9,
    'USD', 25, 116, 116, 'Vigente', 'aprobada');
  INSERT INTO public.proveedor_notas_credito(
    id, organization_id, proveedor_factura_id, fecha, folio_nc, monto, subtotal, moneda, tipo_cambio
  ) VALUES (nc, o.org_a, f_usd, cutoff - 8, 'AUD70-MXN2000', 2000, 2000, 'MXN', 20);
  INSERT INTO public.tipos_cambio_dof(fecha, usd_mxn, eur_mxn, origen)
  VALUES(cutoff, 18.1903, 20.44, 'manual') ON CONFLICT(fecha) DO UPDATE SET usd_mxn = 18.1903, eur_mxn = 20.44;
  PERFORM pg_temp.as_user(o.admin_a);

  FOR r IN SELECT unnest(ARRAY['Borrador','Aprobada','Aplicada']) AS status LOOP
    UPDATE public.proveedor_notas_credito SET estado = r.status::public.estado_nota_credito_proveedor WHERE id = nc;
    SELECT * INTO STRICT r FROM public.cxp_aging_proveedores(o.org_a, cutoff) WHERE proveedor_id = prov AND moneda = 'USD';
    balance := CASE WHEN (SELECT estado FROM public.proveedor_notas_credito WHERE id = nc) = 'Aplicada' THEN 16 ELSE 116 END;
    PERFORM pg_temp.audit70_assert(r.saldo_total IS NOT DISTINCT FROM balance AND r.num_facturas = 1 AND r.d_1_30 = balance,
      'AUD70: USD116 minus applied MXN2000@20 must retain USD16 and one invoice; drafts/approved must not reduce it');
    PERFORM pg_temp.audit70_assert(r.saldo_total IS NOT DISTINCT FROM (SELECT saldo FROM public.v_proveedor_facturas_saldo WHERE proveedor_factura_id = f_usd),
      'AUD70: aggregate must equal the exact drill-down server balance');
  END LOOP;
  RAISE NOTICE 'AUD70: minimal FP12 reproduction passes: USD16, one invoice';

  -- Same vendor, all currencies: stored NC rates override neither invoice TC25
  -- nor each other. Full NC removes only the settled invoice from the count.
  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, fecha_vencimiento, dias_credito, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion
  ) VALUES
    (f_mxn, o.org_a, prov, cat, 'AUD70-MXN2300', cutoff - 40, cutoff - 31, 9, 'MXN', 1, 2300, 2300, 'Vigente', 'aprobada'),
    (f_eur, o.org_a, prov, cat, 'AUD70-EUR116', cutoff - 70, cutoff - 61, 9, 'EUR', 25, 116, 116, 'Vigente', 'aprobada'),
    (f_eur_mxn, o.org_a, prov, cat, 'AUD70-EUR-MXN', cutoff - 100, cutoff - 91, 9, 'MXN', 1, 2300, 2300, 'Vigente', 'aprobada'),
    (f_mixed, o.org_a, prov, cat, 'AUD70-MIXED', cutoff - 5, cutoff, 5, 'USD', 25, 200, 200, 'Vigente', 'aprobada'),
    (f_same, o.org_a, prov, cat, 'AUD70-SAME', cutoff - 40, cutoff - 30, 10, 'EUR', 25, 50, 50, 'Vigente', 'aprobada'),
    (f_full, o.org_a, prov, cat, 'AUD70-FULL', cutoff - 70, cutoff - 60, 10, 'USD', 25, 12, 12, 'Vigente', 'aprobada'),
    (f_round, o.org_a, prov, cat, 'AUD70-PRECISION', cutoff - 100, cutoff - 90, 10, 'USD', 25, 1, 1, 'Vigente', 'aprobada'),
    (f_future, o.org_a, prov, cat, 'AUD70-FUTURE', cutoff + 1, cutoff + 10, 9, 'USD', 25, 100, 100, 'Vigente', 'aprobada');
  INSERT INTO public.proveedor_notas_credito(
    organization_id, proveedor_factura_id, fecha, folio_nc, monto, subtotal, moneda, tipo_cambio, tipo_cambio_mxn
  ) VALUES
    (o.org_a, f_mxn, cutoff - 38, 'AUD70-USD100', 100, 100, 'USD', 20, 20),
    (o.org_a, f_eur, cutoff - 68, 'AUD70-EUR-MXN2000', 2000, 2000, 'MXN', 20, 1),
    (o.org_a, f_eur_mxn, cutoff - 98, 'AUD70-EUR100', 100, 100, 'EUR', 20, 20),
    (o.org_a, f_mixed, cutoff - 3, 'AUD70-MIXED-1', 900, 900, 'MXN', 18, 1),
    (o.org_a, f_mixed, cutoff - 2, 'AUD70-MIXED-2', 800, 800, 'MXN', 20, 1),
    (o.org_a, f_mixed, cutoff - 1, 'AUD70-MIXED-3', 10, 10, 'USD', NULL, 25),
    (o.org_a, f_same, cutoff - 35, 'AUD70-EUR10', 10, 10, 'EUR', NULL, 25),
    (o.org_a, f_full, cutoff - 65, 'AUD70-FULL12', 12, 12, 'USD', NULL, 25);
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada' WHERE organization_id = o.org_a AND estado = 'Borrador';
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada' WHERE organization_id = o.org_a AND estado = 'Aprobada';
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd, fecha_pago, metodo_pago)
  VALUES (o.org_a, f_mixed, 360, 'MXN', 18, cutoff, 'Efectivo'),
         (o.org_a, f_same, 5, 'EUR', 25, cutoff, 'Efectivo');

  -- Actual advance application produces a frozen 0.055 USD credit. Its 0.945
  -- residual must stay unrounded in aggregate, drill-down and CSV alike.
  a := public.registrar_anticipo_proveedor(p_proveedor_id => prov, p_monto => 1, p_moneda => 'MXN',
    p_fecha_anticipo => cutoff, p_metodo_pago => 'Efectivo');
  ap := public.aplicar_anticipo_a_factura(a.id, f_round, 1, cutoff, gen_random_uuid());
  PERFORM pg_temp.audit70_assert((SELECT saldo FROM public.v_proveedor_facturas_saldo WHERE proveedor_factura_id = f_round) = 0.945,
    'AUD70: frozen advance must preserve the unrounded 0.945 residual');

  SELECT * INTO STRICT r FROM public.cxp_aging_proveedores(o.org_a, cutoff) WHERE proveedor_id = prov AND moneda = 'USD';
  PERFORM pg_temp.audit70_assert(r.saldo_total = 196.945 AND r.num_facturas = 4 AND r.vigente = 180 AND r.d_1_30 = 16
    AND r.d_31_60 = 0 AND r.d_61_90 = 0.945 AND r.mas_90 = 0,
    'AUD70: USD mixed NC rates/payment/full credit/precision/future invoice must reconcile exactly: ' || row_to_json(r)::text);
  SELECT * INTO STRICT r FROM public.cxp_aging_proveedores(o.org_a, cutoff) WHERE proveedor_id = prov AND moneda = 'MXN';
  PERFORM pg_temp.audit70_assert(r.saldo_total = 600 AND r.num_facturas = 2 AND r.d_31_60 = 300 AND r.mas_90 = 300,
    'AUD70: USD and EUR credits into MXN use individual stored rates');
  SELECT * INTO STRICT r FROM public.cxp_aging_proveedores(o.org_a, cutoff) WHERE proveedor_id = prov AND moneda = 'EUR';
  PERFORM pg_temp.audit70_assert(r.saldo_total = 51 AND r.num_facturas = 2 AND r.d_1_30 = 35 AND r.d_61_90 = 16,
    'AUD70: MXN credit into EUR plus same-currency credit/payment retain EUR51');

  -- Invoice membership and every boundary use current balances reclassified at
  -- p_fecha, including issue-date-derived due dates, not historical cutoff filtering.
  FOREACH day_offset IN ARRAY ARRAY[0,1,30,31,60,61,90,91] LOOP
    f_boundary := gen_random_uuid();
    INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
      fecha_emision, fecha_vencimiento, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
    VALUES(f_boundary, o.org_a, prov, cat, 'AUD70-BOUNDARY-' || day_offset, cutoff - day_offset, NULL,
      'USD', 25, 1, 1, 'Vigente', 'aprobada');
  END LOOP;
  FOREACH reference_date IN ARRAY ARRAY[cutoff, cutoff - 45, cutoff + 45] LOOP
    PERFORM pg_temp.audit70_assert((SELECT count(*) FROM public.cxp_aging_proveedores(o.org_a, reference_date)
      WHERE proveedor_id = prov) = 3, 'AUD70: reconciliation requires all three currency rows');
    FOR r IN SELECT * FROM public.cxp_aging_proveedores(o.org_a, reference_date) WHERE proveedor_id = prov LOOP
      SELECT sum(v.saldo), count(*)::integer,
        ARRAY[sum(CASE WHEN reference_date - coalesce(pf.fecha_vencimiento, pf.fecha_emision) <= 0 THEN v.saldo ELSE 0 END),
              sum(CASE WHEN reference_date - coalesce(pf.fecha_vencimiento, pf.fecha_emision) BETWEEN 1 AND 30 THEN v.saldo ELSE 0 END),
              sum(CASE WHEN reference_date - coalesce(pf.fecha_vencimiento, pf.fecha_emision) BETWEEN 31 AND 60 THEN v.saldo ELSE 0 END),
              sum(CASE WHEN reference_date - coalesce(pf.fecha_vencimiento, pf.fecha_emision) BETWEEN 61 AND 90 THEN v.saldo ELSE 0 END),
              sum(CASE WHEN reference_date - coalesce(pf.fecha_vencimiento, pf.fecha_emision) > 90 THEN v.saldo ELSE 0 END)]
      INTO STRICT balance, count_open, buckets
      FROM public.proveedor_facturas pf JOIN public.v_proveedor_facturas_saldo v ON v.proveedor_factura_id = pf.id
      WHERE pf.proveedor_id = prov AND pf.moneda::text = r.moneda AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada' AND v.saldo > 0.005;
      PERFORM pg_temp.audit70_assert(r.saldo_total IS NOT DISTINCT FROM balance AND r.num_facturas IS NOT DISTINCT FROM count_open
        AND ARRAY[r.vigente, r.d_1_30, r.d_31_60, r.d_61_90, r.mas_90] IS NOT DISTINCT FROM buckets
        AND r.saldo_total = r.vigente + r.d_1_30 + r.d_31_60 + r.d_61_90 + r.mas_90,
        'AUD70: aggregate/detail/count/all buckets must match for ' || r.moneda || ' at ' || reference_date);
    END LOOP;
  END LOOP;
  RAISE NOTICE 'AUD70: cross-currency, mixed rates, payments, all boundaries and unrounded detail reconciliation pass';

  -- Only live applied credit contributes, regardless of its VAT base. The NC
  -- balance uses monto; subtotal is a cost/P&L base and must not substitute it.
  INSERT INTO public.proveedor_notas_credito(id, organization_id, proveedor_factura_id, fecha, folio_nc, monto, subtotal, moneda, tipo_cambio, tipo_cambio_mxn)
  VALUES(deleted_nc, o.org_a, f_future, cutoff + 1, 'AUD70-DELETED', 11.6, 10, 'USD', NULL, 25),
        (cancelled_nc, o.org_a, f_future, cutoff + 1, 'AUD70-CANCELLED', 11.6, 10, 'USD', NULL, 25);
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada' WHERE id IN (deleted_nc, cancelled_nc);
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada' WHERE id IN (deleted_nc, cancelled_nc);
  PERFORM pg_temp.audit70_assert((SELECT saldo FROM public.v_proveedor_facturas_saldo WHERE proveedor_factura_id = f_future) = 76.8,
    'AUD70: credit amount including VAT, not the NC cost base, reduces invoice debt');
  UPDATE public.proveedor_notas_credito SET deleted_at = now() WHERE id = deleted_nc;
  UPDATE public.proveedor_notas_credito SET estado = 'Cancelada' WHERE id = cancelled_nc;
  PERFORM pg_temp.audit70_assert((SELECT saldo_total FROM public.cxp_aging_proveedores(o.org_a, cutoff) WHERE proveedor_id = prov AND moneda = 'USD') = 204.945,
    'AUD70: deleted/cancelled NC must restore the USD aggregate');
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd, fecha_pago, metodo_pago)
  VALUES(o.org_a, f_mixed, 10, 'USD', 25, cutoff, 'Efectivo') RETURNING id INTO p;
  PERFORM public.eliminar_pago_proveedor(p);
  PERFORM pg_temp.audit70_assert((SELECT saldo_total FROM public.cxp_aging_proveedores(o.org_a, cutoff) WHERE proveedor_id = prov AND moneda = 'USD') = 204.945,
    'AUD70: deleted payment must not reduce the aggregate');

  -- Missing/unsupported FX retains the established unknown contract. Invalid
  -- persisted rows are NOT manufactured to test legacy data. Flags remain in
  -- saldo_factura_proveedor; aging does not add a claim of complete valuation.
  FOREACH currency IN ARRAY ARRAY['USD','EUR'] LOOP
    PERFORM pg_temp.audit70_assert(public.monto_pago_en_moneda_factura(100, 'MXN', NULL, currency) IS NULL,
      'AUD70: missing NC rate must remain unknown');
    PERFORM pg_temp.audit70_assert(public.monto_pago_en_moneda_factura(100, currency, NULL, currency) = 100,
      'AUD70: same currency needs no TC');
    PERFORM pg_temp.audit70_assert(public.monto_pago_proveedor_en_moneda_factura(true, NULL, 100, 'MXN', 20, currency) IS NULL,
      'AUD70: missing frozen application amount must not be reconstructed from a rate or nominal amount');
  END LOOP;
  PERFORM pg_temp.audit70_assert(public.monto_pago_en_moneda_factura(100, 'USD', 20, 'EUR') IS NULL
    AND public.monto_pago_en_moneda_factura(100, 'EUR', 20, 'USD') IS NULL,
    'AUD70: unsupported USD/EUR crossing cannot invent a rate');
  body := lower(pg_get_functiondef('public.saldo_factura_proveedor(uuid)'::regprocedure));
  PERFORM pg_temp.audit70_assert(position('flujo_incompleto' IN body) > 0 AND position('v_nc_incompleto' IN body) > 0,
    'AUD70: canonical missing-rate flags must remain available');
  PERFORM pg_temp.audit70_assert(NOT (public.saldo_factura_proveedor(f_usd)->>'flujo_incompleto')::boolean,
    'AUD70: known NC conversion must not be flagged incomplete');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD70: NC lifecycle/base, payment reversal and no-invented-FX contracts pass';
END $tests$;
ROLLBACK;
