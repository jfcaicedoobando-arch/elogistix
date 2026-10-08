BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
 o record; cli uuid:=gen_random_uuid(); prov uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid();
 e1 uuid:=gen_random_uuid(); e2 uuid:=gen_random_uuid();
 f uuid:=gen_random_uuid(); n uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 d jsonb; row jsonb; st text;
BEGIN
 SELECT * INTO STRICT o FROM pg_temp.seed_org_pair('AUD139');
 INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES(cli,o.org_a,'AUD139','audit139@test.local');
 INSERT INTO public.proveedores(id,organization_id,nombre,categoria,subtipo_gasto) VALUES(prov,o.org_a,'AUD139','GastoOperativo','Otros');
 INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,o.org_a,'AUD139');
 INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd)
 VALUES(e1,o.org_a,cli,'ELIMP13901','Aéreo','Importación',20),(e2,o.org_a,cli,'ELIMP13902','Aéreo','Importación',20);
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,embarque_id,categoria_presupuesto_id,folio_proveedor,fecha_emision,moneda,tipo_cambio_usd,subtotal,total,estado,estado_aprobacion)
 VALUES(f,o.org_a,prov,e1,cat,'AUD139-F',public.fecha_negocio_mx(),'USD',20,1,1,'Vigente','aprobada');
 INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,folio_nc,fecha,monto,moneda,tipo_cambio,subtotal)
 VALUES(n,o.org_a,f,'AUD139-NC',public.fecha_negocio_mx(),20,'MXN',20,20);
 PERFORM pg_temp.as_user(o.admin_a);
 FOREACH st IN ARRAY ARRAY['Borrador','Aprobada','Aplicada','Cancelada'] LOOP
  UPDATE public.proveedor_notas_credito SET estado=st::public.estado_nota_credito_proveedor WHERE id=n;
  SELECT x INTO STRICT d FROM jsonb_array_elements(public.validar_cierre_embarque(e1)->'checks') x WHERE x->>'regla'='cxp_pagada';
  SELECT x INTO STRICT row FROM jsonb_array_elements(d->'detalle'->'por_moneda') x WHERE x->>'moneda'='USD';
  PERFORM pg_temp.assert((d->>'ok')::boolean=(st='Aplicada'),'AUD139: closure must honor only applied credit');
  PERFORM pg_temp.assert((row->>'facturas_pendientes')::int=CASE WHEN st='Aplicada' THEN 0 ELSE 1 END,'AUD139: pending invoice count must use net balance');
  PERFORM pg_temp.assert(round((row->>'saldo')::numeric,2)=(public.saldo_factura_proveedor(f)->>'saldo')::numeric,'AUD139: closure and invoice balance differ');
 END LOOP;
 -- Partial NC + payment extinguishes the remainder.
 n:=gen_random_uuid();
 INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,folio_nc,fecha,monto,moneda,tipo_cambio,subtotal)
 VALUES(n,o.org_a,f,'AUD139-NC-PARTIAL',public.fecha_negocio_mx(),10,'MXN',20,10);
 UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=n;
 UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=n;
 INSERT INTO public.pagos_proveedor(organization_id,proveedor_factura_id,monto,moneda,tipo_cambio_usd,fecha_pago,metodo_pago)
 VALUES(o.org_a,f,10,'MXN',20,public.fecha_negocio_mx(),'Efectivo');
 SELECT x INTO STRICT d FROM jsonb_array_elements(public.validar_cierre_embarque(e1)->'checks') x WHERE x->>'regla'='cxp_pagada';
 PERFORM pg_temp.assert((d->>'ok')::boolean,'AUD139: partial payment plus applied NC must settle');
 -- Multi-shipment membership: allocation overrides unrelated header.
 PERFORM pg_temp.as_postgres();
 INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,concepto,proveedor_id,monto,moneda)
 VALUES(c,o.org_a,e2,'AUD139 allocation',prov,1,'USD');
 INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,monto,cantidad)
 VALUES(o.org_a,f,c,'AUD139 allocation',1,1);
 PERFORM pg_temp.as_user(o.admin_a);
 SELECT x INTO STRICT d FROM jsonb_array_elements(public.validar_cierre_embarque(e1)->'checks') x WHERE x->>'regla'='cxp_pagada';
 PERFORM pg_temp.assert(jsonb_array_length(d->'detalle'->'por_moneda')=0,'AUD139: header must not duplicate allocated invoice');
 SELECT x INTO STRICT d FROM jsonb_array_elements(public.validar_cierre_embarque(e2)->'checks') x WHERE x->>'regla'='cxp_pagada';
 PERFORM pg_temp.assert((d->>'ok')::boolean AND jsonb_array_length(d->'detalle'->'por_moneda')=1,'AUD139: allocated shipment must see settled invoice');
 UPDATE public.proveedor_notas_credito SET estado='Cancelada' WHERE id=n;
 SELECT x INTO STRICT d FROM jsonb_array_elements(public.validar_cierre_embarque(e2)->'checks') x WHERE x->>'regla'='cxp_pagada';
 SELECT x INTO STRICT row FROM jsonb_array_elements(d->'detalle'->'por_moneda') x WHERE x->>'moneda'='USD';
 PERFORM pg_temp.assert(NOT (d->>'ok')::boolean AND (row->>'saldo')::numeric=0.5 AND (row->>'facturas_pendientes')::int=1,'AUD139: cancelled credit must restore debt in allocated shipment');
 RAISE NOTICE 'audit139: NC states, full/partial cross-currency credit, payment and allocation membership passed';
END $tests$;
ROLLBACK;
