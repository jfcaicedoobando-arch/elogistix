-- AUD121: ajustes no monetarios no debilitan pagos reales. Fixtures nuevos con rollback.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record; prov uuid := gen_random_uuid(); cat uuid := gen_random_uuid(); fac uuid; pay uuid;
  m text; hoy date := public.fecha_negocio_mx(); err text;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD121');
  INSERT INTO public.proveedores(id,organization_id,nombre,categoria,subtipo_gasto)
    VALUES (prov,fx.org_a,'AUD121 proveedor','GastoOperativo','Otros');
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES (cat,fx.org_a,'AUD121');
  FOREACH m IN ARRAY ARRAY['MXN','USD','EUR'] LOOP
    PERFORM pg_temp.as_postgres(); fac := gen_random_uuid();
    INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,folio_proveedor,
      fecha_emision,moneda,tipo_cambio_usd,subtotal,total,estado,estado_aprobacion)
      VALUES (fac,fx.org_a,prov,cat,'AUD121-'||m,hoy-1,m::public.moneda,20,1,1,'Vigente','aprobada');
    PERFORM pg_temp.as_user(fx.admin_a);
    -- La restricción original sigue rechazando cero para dinero real.
    BEGIN
      INSERT INTO public.pagos_proveedor(organization_id,proveedor_factura_id,fecha_pago,monto,moneda,tipo_cambio_usd,metodo_pago)
        VALUES (fx.org_a,fac,hoy,1,m::public.moneda,0,'Efectivo');
      RAISE EXCEPTION 'AUD121 zero TC real payment allowed';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS err = CONSTRAINT_NAME;
      PERFORM pg_temp.assert(err = 'pagos_proveedor_tc_pos', 'AUD121 positive rate constraint stays active');
    END;
    pay := public.cerrar_factura_proveedor_sin_pago(fac,'condonacion','Motivo trazable de prueba');
    PERFORM pg_temp.assert((SELECT es_ajuste AND motivo_ajuste='condonacion' AND monto=1 AND tipo_cambio_usd IS NULL
      AND cuenta_bancaria_id IS NULL AND fecha_pago=hoy AND notas='Motivo trazable de prueba'
      FROM public.pagos_proveedor WHERE id=pay), 'AUD121 typed adjustment, null TC, no bank, audit reason');
    PERFORM pg_temp.assert((SELECT saldo=0 FROM public.v_proveedor_facturas_saldo WHERE proveedor_factura_id=fac), 'AUD121 zero debt');
    PERFORM pg_temp.assert((SELECT estado='Pagada' FROM public.proveedor_facturas WHERE id=fac), 'AUD121 closed invoice');
    PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.bbva_movimientos WHERE pago_proveedor_id=pay), 'AUD121 no cash movement');
    PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.bitacora_actividad WHERE entidad_id=fac AND accion='cerrar_sin_pago'
      AND detalles->>'motivo'='condonacion'), 'AUD121 reason is in audit trail');
  END LOOP;
  PERFORM pg_temp.as_postgres();
END;
$tests$;
ROLLBACK;
