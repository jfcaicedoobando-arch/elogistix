-- Audit141: full portfolio count uses the same net balance and cutoff as the list.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  cli uuid := gen_random_uuid();
  doc uuid;
  nc_doc uuid := gen_random_uuid();
  pago_doc uuid := gen_random_uuid();
  item record;
  total_lista bigint;
  hoy date := public.fecha_negocio_mx();
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD141');
  INSERT INTO public.clientes(id,organization_id,nombre,rfc,email) VALUES(cli,fx.org_a,'Audit141','XAXX010101000','audit141@test.local');
  INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,eur_mxn,origen) VALUES(hoy-60,20,22,'manual')
    ON CONFLICT(fecha) DO UPDATE SET usd_mxn=20,eur_mxn=22;
  FOR item IN SELECT * FROM (VALUES
    ('MXN','Emitida',-1,100::numeric),('USD','Vencida',-3,100::numeric),('EUR','Parcialmente pagada',-30,100::numeric),
    ('MXN','Emitida',0,100::numeric),('MXN','Emitida',1,100::numeric),('MXN','Borrador',-1,100::numeric),
    ('MXN','Cancelada',-1,100::numeric),('MXN','Emitida',-1,0.01::numeric)
  ) x(moneda,estado,dias,total) LOOP
    doc := gen_random_uuid();
    INSERT INTO public.facturas(id,organization_id,cliente_id,cliente_nombre,numero,fecha_emision,fecha_vencimiento,
      moneda,tipo_cambio,subtotal,iva,total,estado)
    VALUES(doc,fx.org_a,cli,'Audit141','AUD141-'||doc::text,hoy-60,hoy+item.dias,item.moneda::public.moneda,
      CASE WHEN item.moneda='MXN' THEN 1 ELSE 20 END,item.total,0,item.total,item.estado::public.estado_factura);
  END LOOP;
  INSERT INTO public.facturas(id,organization_id,cliente_id,cliente_nombre,numero,fecha_emision,fecha_vencimiento,moneda,subtotal,iva,total,estado)
    VALUES(nc_doc,fx.org_a,cli,'Audit141','AUD141-NC',hoy-60,hoy-1,'MXN',100,0,100,'Emitida'),
      (pago_doc,fx.org_a,cli,'Audit141','AUD141-PAGO',hoy-60,hoy-1,'MXN',100,0,100,'Emitida');
  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT count(*) INTO total_lista FROM public.cobranza_listado(p_estatus=>'Vencida');
  PERFORM pg_temp.assert(public.cobranza_conteo_vencidas(fx.org_a)=total_lista AND total_lista=6,
    'AUD141 MXN/USD/EUR and documentary Vencida match list; today/future/draft/cancel excluded; a real cent remains included');
  PERFORM pg_temp.assert(public.cobranza_conteo_vencidas(fx.org_b)=0,'AUD141 explicit other tenant yields no rows');
  PERFORM pg_temp.as_postgres();
  INSERT INTO public.factura_notas_credito(organization_id,factura_id,folio,monto,moneda,tipo_cambio,fecha_emision,estado,uuid_fiscal,conceptos)
    VALUES(fx.org_a,nc_doc,'AUD141-NC',100,'MXN',1,hoy,'Aplicada',gen_random_uuid()::text,
      '[{"descripcion":"Descuento global","cantidad":1,"precio_unitario":100,"total":100,"subtotal":100}]'::jsonb);
  INSERT INTO public.pagos_factura(factura_id,organization_id,fecha_pago,monto,moneda,tipo_cambio,monto_aplicado_factura,forma_pago,referencia)
    VALUES(pago_doc,fx.org_a,hoy,100,'MXN',1,100,'Efectivo','AUD141');
  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT count(*) INTO total_lista FROM public.cobranza_listado(p_estatus=>'Vencida');
  PERFORM pg_temp.assert(public.cobranza_conteo_vencidas(fx.org_a)=total_lista AND total_lista=4,
    'AUD141 payment and effective NC both exhaust balance and refresh count');
  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.assert(public.cobranza_conteo_vencidas(fx.org_a)=0,'AUD141 other organization cannot count first portfolio');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(NOT has_function_privilege('anon','public.cobranza_conteo_vencidas(uuid)','EXECUTE'),'AUD141 anon denied');
END;
$tests$;
ROLLBACK;
