-- Nuevos fixtures exclusivamente locales y transaccionales. Sin backfill.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record; org uuid; prov uuid := gen_random_uuid(); cat uuid := gen_random_uuid();
  eur uuid := gen_random_uuid(); eur_cruce uuid := gen_random_uuid(); mxn uuid := gen_random_uuid(); nc public.proveedor_notas_credito;
  fecha date := public.fecha_negocio_mx(); valor numeric; err text; cant integer; caso record; legado uuid;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD122_125');
  org := fx.org_a;
  INSERT INTO public.proveedores(id,organization_id,nombre,categoria,subtipo_gasto)
    VALUES(prov,org,'AUD122_125 PROVEEDOR','GastoOperativo','Otros');
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,org,'AUD122_125 ADMIN');
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,folio_proveedor,fecha_emision,moneda,tipo_cambio_usd,subtotal,iva,total,estado,estado_aprobacion)
    VALUES(eur,org,prov,cat,'AUD125-EUR',fecha,'EUR',20,1,0,1,'Vigente','aprobada'),
          (mxn,org,prov,cat,'AUD122-MXN',fecha,'MXN',1,1000,160,1160,'Vigente','aprobada');
  INSERT INTO public.proveedor_notas_credito(organization_id,proveedor_factura_id,fecha,folio_nc,monto,subtotal,moneda,tipo_cambio_mxn)
    VALUES(org,eur,fecha,'AUD125-EUR-NC',1,1,'EUR',20) RETURNING * INTO nc;
  PERFORM pg_temp.assert(nc.tipo_cambio IS NULL AND nc.tipo_cambio_mxn=20 AND nc.subtotal=1,
    'AUD125: la valuación EUR20 debe quedar separada de conversión de deuda EUR/EUR');
  UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=nc.id;
  UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=nc.id;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.assert((public.saldo_factura_proveedor(eur)->>'saldo')::numeric=0,
    'AUD125: EUR1 debe liquidar EUR1, no EUR20');
  PERFORM pg_temp.as_postgres();
  BEGIN
    UPDATE public.proveedor_notas_credito SET tipo_cambio_mxn=21 WHERE id=nc.id;
    RAISE EXCEPTION 'AUD125: se permitió revaluar NC aplicada';
  EXCEPTION WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_NC_PROV_DESGLOSE_INMUTABLE%', 'AUD125: rechazo incorrecto');
  END;
  INSERT INTO public.proveedor_notas_credito(organization_id,proveedor_factura_id,fecha,folio_nc,monto,subtotal,moneda)
    VALUES(org,mxn,fecha,'AUD122-16',116,100,'MXN') RETURNING * INTO nc;
  PERFORM pg_temp.assert(nc.monto=116 AND nc.subtotal=100 AND nc.tipo_cambio_mxn=1,
    'AUD122: guardar crédito116 y base100 independientemente');
  INSERT INTO public.proveedor_notas_credito(organization_id,proveedor_factura_id,fecha,folio_nc,monto,subtotal,moneda)
    VALUES(org,mxn,fecha,'AUD122-MIXTA',216,200,'MXN'),
          (org,mxn,fecha,'AUD122-PARCIAL',108,100,'MXN'),
          (org,mxn,fecha,'AUD122-RET',94,100,'MXN');
  -- No asumir que base <= total: las retenciones pueden invertir esa relación.
  SELECT count(*) INTO cant FROM public.proveedor_notas_credito WHERE organization_id=org AND subtotal>monto;
  PERFORM pg_temp.assert(cant=1,'AUD122: admitir base100/total94 con retenciones');
  FOREACH valor IN ARRAY ARRAY[NULL,-1,'NaN'::numeric,'Infinity'::numeric] LOOP
    BEGIN
      INSERT INTO public.proveedor_notas_credito(organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda)
        VALUES(org,mxn,fecha,1,valor,'MXN');
      RAISE EXCEPTION 'AUD122: se admitió base inválida';
    EXCEPTION WHEN invalid_parameter_value THEN
      GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      PERFORM pg_temp.assert(err LIKE 'LC_NC_PROV_BASE_REQUERIDA%', 'AUD122: rechazo incorrecto '||err);
    END;
  END LOOP;
  FOREACH valor IN ARRAY ARRAY[0,-1,'NaN'::numeric,'Infinity'::numeric] LOOP
    BEGIN
      INSERT INTO public.proveedor_notas_credito(organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,tipo_cambio_mxn)
        VALUES(org,eur,fecha,0.01,0.01,'EUR',valor);
      RAISE EXCEPTION 'AUD125: se admitió valuación inválida';
    EXCEPTION WHEN invalid_parameter_value THEN
      GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      PERFORM pg_temp.assert(err LIKE 'LC_NC_PROV_TC_INVALIDO%', 'AUD125: rechazo incorrecto '||err);
    END;
  END LOOP;
  -- La valuación propia puede diferir de la factura; el cruce de deuda no.
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,folio_proveedor,fecha_emision,moneda,tipo_cambio_usd,subtotal,iva,total,estado,estado_aprobacion)
    VALUES(eur_cruce,org,prov,cat,'AUD125-EUR-CRUCE',fecha,'EUR',20,5,0,5,'Vigente','aprobada');
  INSERT INTO public.proveedor_notas_credito(organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,tipo_cambio,tipo_cambio_mxn)
    VALUES(org,eur_cruce,fecha,44,44,'MXN',22,1) RETURNING * INTO nc;
  PERFORM pg_temp.assert(nc.tipo_cambio=22 AND nc.tipo_cambio_mxn=1
    AND public.monto_pago_en_moneda_factura(nc.monto,nc.moneda::text,nc.tipo_cambio,'EUR')=2,
    'AUD125: NC MXN44 vale MXN44 pero reduce deuda EUR2 a TC22');
  INSERT INTO public.proveedor_notas_credito(organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,tipo_cambio,tipo_cambio_mxn)
    VALUES(org,mxn,fecha,1,1,'EUR',22,22) RETURNING * INTO nc;
  PERFORM pg_temp.assert(nc.tipo_cambio=22 AND nc.tipo_cambio_mxn=22
    AND public.monto_pago_en_moneda_factura(nc.monto,nc.moneda::text,nc.tipo_cambio,'MXN')=22,
    'AUD125: NC EUR1 vale MXN22 y reduce deuda MXN22');
  INSERT INTO public.proveedor_notas_credito(organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,tipo_cambio_mxn)
    VALUES(org,eur_cruce,fecha,1,1,'EUR',23) RETURNING * INTO nc;
  PERFORM pg_temp.assert(nc.tipo_cambio IS NULL AND nc.tipo_cambio_mxn=23
    AND public.monto_pago_en_moneda_factura(nc.monto,nc.moneda::text,nc.tipo_cambio,'EUR')=1,
    'AUD125: NC EUR1 a TC23 propio conserva deuda EUR1 aunque factura use TC20');

  -- Regresión de inmutabilidad: un no-op autenticado no rellena historia.
  FOR caso IN SELECT * FROM (VALUES
    (mxn, 'MXN', 'Aprobada'), (eur_cruce, 'EUR', 'Aplicada')
  ) AS datos(factura, divisa, estado) LOOP
    PERFORM pg_temp.as_postgres();
    PERFORM set_config('session_replication_role', 'replica', true);
    INSERT INTO public.proveedor_notas_credito(organization_id,proveedor_factura_id,fecha,monto,moneda,estado,subtotal,tipo_cambio_mxn)
      VALUES(org,caso.factura,fecha,1,caso.divisa::public.moneda,
        caso.estado::public.estado_nota_credito_proveedor,NULL,NULL) RETURNING id INTO legado;
    PERFORM set_config('session_replication_role', 'origin', true);
    PERFORM pg_temp.as_user(fx.admin_a);
    UPDATE public.proveedor_notas_credito SET monto=monto WHERE id=legado;
    PERFORM pg_temp.assert((SELECT subtotal IS NULL AND tipo_cambio_mxn IS NULL
      FROM public.proveedor_notas_credito WHERE id=legado), 'AUD125: no-op no completa metadatos históricos');
    PERFORM pg_temp.as_postgres();
    INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,eur_mxn,origen)
      VALUES(fecha,18.1903,20.4368,'manual')
      ON CONFLICT ON CONSTRAINT tipos_cambio_dof_pkey DO UPDATE SET eur_mxn=EXCLUDED.eur_mxn;
    PERFORM pg_temp.as_user(fx.admin_a);
    err := NULL;
    BEGIN
      UPDATE public.proveedor_notas_credito SET monto=1.01 WHERE id=legado;
    EXCEPTION WHEN invalid_parameter_value THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
    END;
    PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_NC_PROV_DESGLOSE_INMUTABLE%',false),
      'AUD125: edición no puede inferir valuación de legado aprobado: '||COALESCE(err,'sin error'));
    PERFORM pg_temp.assert((SELECT monto=1 AND subtotal IS NULL AND tipo_cambio_mxn IS NULL
      FROM public.proveedor_notas_credito WHERE id=legado), 'AUD125: rechazo conserva fila histórica completa');
  END LOOP;
  PERFORM pg_temp.as_postgres();

  -- Un cliente antiguo tampoco puede convertir la parcialidad en descuento.
  BEGIN
    PERFORM public.crear_ajustes_factura_proveedor_rpc(mxn, '[{"monto":-40}]'::jsonb);
    RAISE EXCEPTION 'AUD123: se admitió reducción automática';
  EXCEPTION WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_AJUSTE_REDUCCION_NO_EXPLICITA%', 'AUD123: rechazo incorrecto '||err);
  END;
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.conceptos_costo WHERE organization_id=org),
    'AUD123: rechazo no puede crear/modificar costos');
  RAISE NOTICE 'AUD122/123/125: base neta, valuación separada y protección de parciales OK';
END;
$tests$;
ROLLBACK;
