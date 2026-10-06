-- AUD94/98/99: sólo fixtures nuevos en una transacción local con rollback.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  cli uuid := gen_random_uuid();
  prov uuid := gen_random_uuid();
  cat uuid := gen_random_uuid();
  fac uuid;
  doc uuid := gen_random_uuid();
  pay uuid;
  p1 uuid;
  p2 uuid;
  nc uuid := gen_random_uuid();
  nums text[] := ARRAY['SF437181', 'A4', '4'];
  series text[] := ARRAY['SF43718', 'A', 'A'];
  expected text[] := ARRAY['SF437181', 'A4', 'A4'];
  data jsonb;
  row_ jsonb;
  i integer;
  hoy date := public.fecha_negocio_mx();
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD94_98_99');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES (cli, fx.org_a, 'AUD94 cliente', 'XAXX010101000', 'audit94@example.invalid');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES (prov, fx.org_a, 'AUD98 proveedor', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre) VALUES (cat, fx.org_a, 'AUD98 categoria');
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, fecha_vencimiento, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
    VALUES (doc, fx.org_a, prov, cat, 'AUD98-USD', hoy-5, hoy+10, 'USD', 20, 1, 1, 'Vigente', 'aprobada');
  PERFORM pg_temp.as_user(fx.admin_a);
  -- Dos pagos en monedas diferentes aportan0.50USD en total.
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd, metodo_pago)
    VALUES (fx.org_a, doc, hoy, 5, 'MXN', 20, 'Efectivo') RETURNING id INTO p1;
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd, metodo_pago)
    VALUES (fx.org_a, doc, hoy, 0.25, 'USD', 20, 'Efectivo') RETURNING id INTO p2;
  INSERT INTO public.proveedor_notas_credito(id, organization_id, proveedor_factura_id, fecha, folio_nc, monto, moneda, tipo_cambio, subtotal)
    VALUES (nc, fx.org_a, doc, hoy, 'AUD98-NC', 10, 'MXN', 20, 10);
  data := public.pago_detalle('pago', p1); row_ := data->'aplicaciones'->0;
  PERFORM pg_temp.assert((row_->>'pagado')::numeric = 0.5 AND (row_->>'notas_credito_aplicadas')::numeric = 0,
    'AUD98: varios pagos usan moneda factura y Borrador no descuenta');
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada' WHERE id = nc;
  PERFORM pg_temp.assert((public.pago_detalle('pago', p1)->'aplicaciones'->0->>'notas_credito_aplicadas')::numeric = 0,
    'AUD98: Aprobada sin aplicar no descuenta');
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada' WHERE id = nc;
  row_ := public.pago_detalle('pago', p1)->'aplicaciones'->0;
  PERFORM pg_temp.assert(row_->>'moneda' = 'USD' AND (row_->>'notas_credito_aplicadas')::numeric = 0.5
    AND (row_->>'total')::numeric - (row_->>'pagado')::numeric - (row_->>'notas_credito_aplicadas')::numeric = 0,
    'AUD98: USD1 menos pagado0.50 menos NC MXN10@20 da saldo0');
  UPDATE public.proveedor_notas_credito SET estado = 'Cancelada' WHERE id = nc;
  PERFORM pg_temp.assert((public.pago_detalle('pago', p1)->'aplicaciones'->0->>'notas_credito_aplicadas')::numeric = 0,
    'AUD98: Cancelada no descuenta');
  -- Misma moneda conserva el mismo saldo, NC eliminada tampoco descuenta.
  nc := gen_random_uuid();
  INSERT INTO public.proveedor_notas_credito(id, organization_id, proveedor_factura_id, fecha, folio_nc, monto, moneda, tipo_cambio, subtotal, tipo_cambio_mxn)
    VALUES (nc, fx.org_a, doc, hoy, 'AUD98-NC-USD', 0.5, 'USD', NULL, 0.5, 20);
  UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=nc;
  UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=nc;
  PERFORM pg_temp.assert((public.pago_detalle('pago', p2)->'aplicaciones'->0->>'notas_credito_aplicadas')::numeric = 0.5,
    'AUD98: NC en moneda factura conserva0.50');
  UPDATE public.proveedor_notas_credito SET deleted_at=now() WHERE id=nc;
  PERFORM pg_temp.assert((public.pago_detalle('pago', p1)->'aplicaciones'->0->>'notas_credito_aplicadas')::numeric = 0,
    'AUD98: NC eliminada no descuenta');
  data := public.libro_pagos(hoy,hoy,fx.org_a);
  SELECT p INTO STRICT row_ FROM jsonb_array_elements(data->'pagos') p WHERE p->>'id'=p1::text;
  PERFORM pg_temp.assert(row_->>'estado_conciliacion'='No aplica' AND NOT (row_->>'conciliado')::boolean
    AND row_->>'movimiento_id' IS NULL, 'AUD99: efectivo sin banco no es pendiente ni conciliado ficticio');
  FOR i IN 1..3 LOOP
    fac := gen_random_uuid();
    INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero, serie, fecha_emision,
      fecha_vencimiento, moneda, tipo_cambio, subtotal, total, estado, metodo_pago)
      VALUES (fac, fx.org_a, cli, 'AUD94', nums[i], series[i], hoy, hoy+30, 'MXN', 1, 100, 100, 'Emitida', 'PPD');
    INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago)
      VALUES (fac, fx.org_a, hoy, 1, 'MXN', 1, 1, CASE WHEN i=1 THEN '01' ELSE '03' END) RETURNING id INTO pay;
    row_ := public.pago_detalle('cobro',pay)->'aplicaciones'->0;
    PERFORM pg_temp.assert(row_->>'folio'=expected[i] AND row_->>'documento_id'=fac::text,
      'AUD94: folio detalle coincide con número canónico y conserva vínculo');
    data := public.libro_pagos(hoy,hoy,fx.org_a);
    SELECT p INTO STRICT row_ FROM jsonb_array_elements(data->'pagos') p WHERE p->>'id'=pay::text;
    PERFORM pg_temp.assert(row_->>'documento_folio'=expected[i], 'AUD94: libro no duplica serie ni pierde serie legacy numérica');
    PERFORM pg_temp.assert((SELECT numero FROM public.facturas WHERE id=fac)=nums[i], 'AUD94: histórico no se renumera');
    PERFORM pg_temp.assert(row_->>'estado_conciliacion'=CASE WHEN i=1 THEN 'No aplica' ELSE 'Pendiente' END,
      'AUD99: SAT01 sin banco no aplica, transferencia03 sin banco sigue pendiente');
  END LOOP;
  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.assert(jsonb_array_length(public.libro_pagos(hoy,hoy,fx.org_b)->'pagos')=0,
    'AUD94_98_99: libro no expone organización ajena');
  PERFORM pg_temp.as_postgres();
END;
$tests$;
ROLLBACK;
