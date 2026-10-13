-- Guard financiero de reconciliación: preservar TC USD documental live y
-- fallback EUR/DOF ya existente en replay. Fixtures reales, sin mocks y rollback.
BEGIN;
DO $$
DECLARE
  org uuid; uid uuid := gen_random_uuid(); cli uuid; emb uuid; fallback_emb uuid; eur_emb uuid;
  fac uuid; first_fac uuid; nc uuid := gen_random_uuid(); cat uuid; prov uuid;
  today date := public.fecha_negocio_mx(); invoice_day date; r record; out jsonb; detail jsonb; fn text;
  usd_amount numeric; fx numeric; before_rows jsonb; after_rows jsonb;
BEGIN
  INSERT INTO public.organizations(nombre,rfc,plan,activo)
    VALUES('TEST SALIDA FX','SFX000000XX0','basico',true) RETURNING id INTO org;
  INSERT INTO auth.users(id,email) VALUES(uid,'salida-fx@test.invalid');
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(org,uid,'admin_org');
  INSERT INTO public.user_roles(user_id,role) VALUES(uid,'admin_org') ON CONFLICT DO NOTHING;
  INSERT INTO public.clientes(organization_id,nombre,rfc,email)
    VALUES(org,'CLIENTE SALIDA FX','','cliente-salida-fx@test.invalid') RETURNING id INTO cli;
  INSERT INTO public.embarques(organization_id,cliente_id,expediente,modo,tipo,estado,etd,eta,tipo_cambio_usd)
    VALUES(org,cli,'ELIMP98201','Marítimo','Importación','Confirmado',today-20,today,17) RETURNING id INTO emb;
  INSERT INTO public.embarques(organization_id,cliente_id,expediente,modo,tipo,estado,etd,eta,tipo_cambio_usd)
    VALUES(org,cli,'ELIMP98202','Marítimo','Importación','Confirmado',today-20,today,17) RETURNING id INTO fallback_emb;
  INSERT INTO public.embarques(organization_id,cliente_id,expediente,modo,tipo,estado,etd,eta,tipo_cambio_eur)
    VALUES(org,cli,'ELIMP98203','Marítimo','Importación','Confirmado',today-20,today,NULL) RETURNING id INTO eur_emb;
  INSERT INTO public.conceptos_venta(organization_id,embarque_id,descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada)
    VALUES(org,fallback_emb,'USD pactado sin factura',1,50,50,'USD','tasa_0',0);

  -- Dos facturas válidas: TC bruto ponderado (100*18+300*22)/400 = 21.
  -- NC de50 en la primera: venta neta350; la regla LIVE convierte350*21=7350.
  -- Sin profit_fx el replay previo entregaba50*18+300*22=7500: control discriminante.
  -- Se congela la semántica LIVE existente, no se decide una política fiscal nueva.
  FOR r IN SELECT * FROM (VALUES(100::numeric,18::numeric),(300::numeric,22::numeric)) x(amount,rate) LOOP
    invoice_day:=today-CASE WHEN r.rate=18 THEN 1 ELSE 0 END;
    INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,eur_mxn,fuente,origen)
      VALUES(invoice_day,r.rate,24,'fixture','manual')
      ON CONFLICT(fecha) DO UPDATE SET usd_mxn=EXCLUDED.usd_mxn,eur_mxn=EXCLUDED.eur_mxn;
    fac := gen_random_uuid();
    INSERT INTO public.facturas(id,organization_id,cliente_id,cliente_nombre,embarque_id,numero,
      fecha_emision,fecha_vencimiento,moneda,tipo_cambio,subtotal,iva,total,estado,metodo_pago)
      VALUES(fac,org,cli,'CLIENTE SALIDA FX',emb,'SALIDA-FX-'||fac,invoice_day,today+30,'USD',r.rate,r.amount,0,r.amount,'Borrador','PPD');
    INSERT INTO public.conceptos_factura(organization_id,factura_id,embarque_id,descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada)
      VALUES(org,fac,emb,'Servicio',1,r.amount,r.amount,'USD','tasa_0',0);
    UPDATE public.facturas SET estado='Emitida' WHERE id=fac;
    IF r.amount=100 THEN first_fac:=fac; END IF;
  END LOOP;
  SELECT sum(f.subtotal*f.tipo_cambio)/sum(f.subtotal) INTO fx
    FROM public.facturas f WHERE f.id IN (first_fac,fac);
  IF fx IS DISTINCT FROM 21
     OR (SELECT tipo_cambio FROM public.facturas WHERE id=first_fac) IS DISTINCT FROM 18
     OR (SELECT tipo_cambio FROM public.facturas WHERE id=fac) IS DISTINCT FROM 22 THEN
    RAISE EXCEPTION 'Fixture tasas persistidas: esperado18/22 y promedio21, obtenido%',fx;
  END IF;
  INSERT INTO public.factura_notas_credito(id,organization_id,factura_id,folio,monto,moneda,tipo_cambio,
    fecha_emision,estado,uuid_fiscal,conceptos)
    VALUES(nc,org,first_fac,'SALIDA-NC-'||nc,50,'USD',18,today,'Aplicada',nc::text,
      jsonb_build_array(jsonb_build_object('descripcion','Descuento global','cantidad',1,'precio_unitario',50,'subtotal',50,'total',50,'tipo_iva','tasa_0','tasa_iva',0)));

  INSERT INTO public.proveedores(organization_id,nombre,categoria,subtipo_gasto)
    VALUES(org,'PROVEEDOR SALIDA FX','GastoOperativo','Otros') RETURNING id INTO prov;
  INSERT INTO public.presupuesto_categorias(organization_id,nombre,tipo_contable)
    VALUES(org,'Gasto administración FX','Administracion') RETURNING id INTO cat;
  INSERT INTO public.proveedor_facturas(organization_id,proveedor_id,embarque_id,folio_proveedor,categoria_presupuesto_id,
    subtotal,iva,total,moneda,tipo_cambio_usd,fecha_emision,estado,estado_aprobacion)
    VALUES(org,prov,eur_emb,'SALIDA-EUR',cat,10,0,10,'EUR',0,today,'Borrador','pendiente');
  INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,eur_mxn,fuente,origen)
    VALUES(today,20,24,'fixture','manual') ON CONFLICT(fecha) DO UPDATE SET eur_mxn=24;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  SELECT venta_usd INTO usd_amount FROM public.profit_por_embarque() WHERE embarque_id=emb;
  IF usd_amount IS DISTINCT FROM 350 THEN RAISE EXCEPTION 'Fixture netoUSD esperado350, obtenido%',usd_amount; END IF;
  SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) INTO before_rows FROM public.embarques e WHERE e.organization_id=org;

  out:=public.dashboard_summary_datos();
  IF (out#>>'{arribosEsteMes,ventaMxnFromUsd}')::numeric IS DISTINCT FROM 8200 THEN
    RAISE EXCEPTION 'USD ponderado/fallback: resumen esperado8200 (7350+850), obtenido%',out;
  END IF;
  out:=public.dashboard_details_datos();
  SELECT x INTO detail FROM jsonb_array_elements(out->'profitArribosEsteMes') x WHERE (x->>'id')::uuid=emb;
  IF (detail->>'ventaMxnFromUsd')::numeric IS DISTINCT FROM 7350 OR detail->>'estadoReal'<>'Confirmado' THEN
    RAISE EXCEPTION 'USD ponderado: detalle esperado7350 y Confirmado, obtenido%',detail;
  END IF;
  SELECT x INTO detail FROM jsonb_array_elements(out->'profitArribosEsteMes') x WHERE (x->>'id')::uuid=fallback_emb;
  IF (detail->>'ventaMxnFromUsd')::numeric IS DISTINCT FROM 850 THEN
    RAISE EXCEPTION 'USD fallback: sin factura se esperaba50*17=850, obtenido%',detail;
  END IF;

  FOREACH fn IN ARRAY ARRAY['dashboard_summary_datos','_dashboard_summary_calc'] LOOP
    EXECUTE format('SELECT public.%I()',fn) INTO out;
    IF (out#>>'{arribosEsteMes,gastosOperativosMXN}')::numeric IS DISTINCT FROM 240
       OR (out#>>'{arribosEsteMes,gastosOperativosSinTC}')::int IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION '% perdió fallbackEUR/DOF: esperado240 y sinTC0, obtenido%',fn,out;
    END IF;
  END LOOP;
  UPDATE public.tipos_cambio_dof SET eur_mxn=NULL WHERE fecha=today;
  FOREACH fn IN ARRAY ARRAY['dashboard_summary_datos','_dashboard_summary_calc'] LOOP
    EXECUTE format('SELECT public.%I()',fn) INTO out;
    IF (out#>>'{arribosEsteMes,gastosOperativosMXN}')::numeric IS DISTINCT FROM 0
       OR (out#>>'{arribosEsteMes,gastosOperativosSinTC}')::int IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION '% EUR sin tasa válida debe advertir sin inventar importe: %',fn,out;
    END IF;
  END LOOP;
  UPDATE public.tipos_cambio_dof SET eur_mxn=24 WHERE fecha=today;
  SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) INTO after_rows FROM public.embarques e WHERE e.organization_id=org;
  IF before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'La consulta financiera mutó embarques'; END IF;
  RAISE NOTICE 'OK USD ponderado7350 + fallback850; EUR DOF240; EUR sin tasa advertido; estado persistido y filas intactas';
END $$;
ROLLBACK;
