-- AUD103/108/114: fixtures nuevos, sólo DB efímera; rollback completo.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  prov uuid := gen_random_uuid(); cat uuid := gen_random_uuid(); bank uuid := gen_random_uuid();
  fac uuid; cash_fac uuid; req uuid := gen_random_uuid(); result jsonb; retry jsonb; row_ jsonb;
  tc numeric; err text; caso record; hoy date := public.fecha_negocio_mx();
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD103108');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES (prov, fx.org_a, 'AUD103108 proveedor', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre) VALUES (cat, fx.org_a, 'AUD103108');
  INSERT INTO public.cuentas_bancarias(id, organization_id, alias, moneda, saldo_inicial, fecha_saldo_inicial)
    VALUES (bank, fx.org_a, 'AUD103108 USD', 'USD', 100, hoy-30);
  fac := gen_random_uuid(); cash_fac := gen_random_uuid();
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, fecha_programada_pago, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
    VALUES (fac, fx.org_a, prov, cat, 'AUD108-bank', hoy-5, hoy, 'USD', 18.1903, 1, 1, 'Vigente', 'aprobada'),
           (cash_fac, fx.org_a, prov, cat, 'AUD103-cash', hoy-5, hoy, 'USD', 18.1903, 2, 2, 'Vigente', 'aprobada');
  PERFORM pg_temp.as_user(fx.admin_a);
  FOREACH tc IN ARRAY ARRAY[NULL::numeric, 0, -1, 'NaN'::numeric, 'Infinity'::numeric] LOOP
    BEGIN
      PERFORM public.ejecutar_pago_programado(fac, bank, hoy, 1, 'Transferencia', '', gen_random_uuid(), tc);
      RAISE EXCEPTION 'AUD108 allowed invalid TC';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
      PERFORM pg_temp.assert(err LIKE 'LC_PAGO_TC_REQUERIDO:%', 'AUD108 finite positive TC required: ' || err);
    END;
  END LOOP;
  BEGIN
    PERFORM public.ejecutar_pago_programado(fac, NULL, hoy, 1, 'Transferencia', '', NULL, 20);
    RAISE EXCEPTION 'AUD103 allowed bankless transfer';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_CUENTA_NO_EXISTE:%', 'AUD103 transfer still requires bank');
  END;
  FOR caso IN SELECT * FROM (VALUES (hoy+1, 1::numeric, 'LC_PAGO_FECHA_INVALIDA:%'),
    (hoy-6, 1::numeric, 'LC_PAGO_FECHA_INVALIDA:%'), (hoy, 2::numeric, 'LC_PAGO_EXCEDE_SALDO:%')) t(fecha,monto,patron)
  LOOP
    BEGIN
      PERFORM public.ejecutar_pago_programado(fac, bank, caso.fecha, caso.monto, 'Transferencia', '', gen_random_uuid(), 20);
      RAISE EXCEPTION 'AUD114 invalid payment persisted';
    EXCEPTION WHEN raise_exception OR check_violation THEN
      GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
      PERFORM pg_temp.assert(err LIKE caso.patron, 'AUD114 guard unchanged: ' || err);
    END;
  END LOOP;
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.pagos_proveedor WHERE proveedor_factura_id = fac), 'AUD108 failed operations leave no payments');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.bbva_movimientos WHERE cuenta_bancaria_id = bank), 'AUD108 failed operations leave no bank movement');
  result := public.ejecutar_pago_programado(fac, bank, hoy, 1, 'Transferencia', 'AUD108 manual rate', req, 20);
  retry := public.ejecutar_pago_programado(fac, bank, hoy, 1, 'Transferencia', 'AUD108 manual rate', req, 20);
  PERFORM pg_temp.assert(result = retry, 'AUD108 retry returns original result');
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.pagos_proveedor WHERE proveedor_factura_id = fac), 'AUD108 exactly one payment');
  PERFORM pg_temp.assert((SELECT tipo_cambio_usd = 20 FROM public.pagos_proveedor WHERE id = (result->>'pago_id')::uuid), 'AUD108 persists selected TC not document TC');
  PERFORM pg_temp.assert((SELECT count(*) = 1 AND sum(cargo) = 1 FROM public.bbva_movimientos WHERE pago_proveedor_id = (result->>'pago_id')::uuid), 'AUD108 one USD1 bank debit');
  PERFORM pg_temp.assert((SELECT saldo = 0 FROM public.v_proveedor_facturas_saldo WHERE proveedor_factura_id = fac), 'AUD108 invoice settled');
  SELECT p INTO STRICT row_ FROM jsonb_array_elements(public.libro_pagos(hoy,hoy,fx.org_a)->'pagos') p WHERE p->>'id'=result->>'pago_id';
  PERFORM pg_temp.assert((row_->>'monto_mxn')::numeric = 20, 'AUD108 appears in MXN net');
  -- Cash with a stale selected bank is deliberately detached; no bank movement.
  result := public.ejecutar_pago_programado(cash_fac, bank, hoy, 1, 'Efectivo', 'AUD103', gen_random_uuid(), 18.1903);
  PERFORM pg_temp.assert(result->>'movimiento_id' IS NULL AND result->>'saldo_cuenta_restante' IS NULL, 'AUD103 bankless result');
  PERFORM pg_temp.assert((SELECT cuenta_bancaria_id IS NULL AND tipo_cambio_usd = 18.1903 FROM public.pagos_proveedor WHERE id=(result->>'pago_id')::uuid), 'AUD103 cash ignores stale bank and keeps valuation');
  result := public.ejecutar_pago_programado(cash_fac, NULL, hoy, 1, '01', 'AUD103 SAT', gen_random_uuid(), 18.1903);
  PERFORM pg_temp.assert((SELECT saldo = 0 FROM public.v_proveedor_facturas_saldo WHERE proveedor_factura_id=cash_fac), 'AUD103 literal and SAT cash both apply');
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.bbva_movimientos WHERE cuenta_bancaria_id=bank), 'AUD103 cash never debits bank');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(to_regprocedure('public.ejecutar_pago_programado(uuid,uuid,date,numeric,text,text,uuid)') IS NULL, 'AUD108 no old overload');
  PERFORM pg_temp.assert(NOT has_function_privilege('anon','public.ejecutar_pago_programado(uuid,uuid,date,numeric,text,text,uuid,numeric)','EXECUTE'), 'AUD108 anon has no execute');
END;
$tests$;
ROLLBACK;
