-- Restored exact original accounting scenarios for residual40 split50/50 and NULL header.
-- Source: recovered original131-140 supabase/tests/audit139_140_cierre_nc.sql.
-- Disposable DB only. Real RPC diagnosis and canonical balance; no actual closure.
BEGIN;
\i supabase/tests/rls/_helpers.sql
CREATE FUNCTION pg_temp.cxp_cierre(e uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT c FROM jsonb_array_elements(public.validar_cierre_embarque(e)->'checks') c WHERE c->>'regla'='cxp_pagada'
$$;
CREATE FUNCTION pg_temp.assert_cierre(e uuid, esperado numeric, pendientes integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c jsonb := pg_temp.cxp_cierre(e); s numeric; n integer;
BEGIN
 SELECT COALESCE(sum((m->>'saldo')::numeric),0),COALESCE(sum((m->>'facturas_pendientes')::int),0)
 INTO s,n FROM jsonb_array_elements(c->'detalle'->'por_moneda') m;
 PERFORM pg_temp.assert(abs(s-esperado)<0.00001 AND n=pendientes, '139 closure expected '||esperado||'/'||pendientes||': '||c::text);
 PERFORM pg_temp.assert((c->>'ok')::boolean=(esperado<=0.01), '139 closure rule state: '||c::text);
END $$;
DO $$
DECLARE fx record; prov uuid:=gen_random_uuid(); cli uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid();
 e uuid:=gen_random_uuid(); e2 uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid();
 f uuid:=gen_random_uuid(); f2 uuid:=gen_random_uuid(); nc uuid:=gen_random_uuid(); nc2 uuid:=gen_random_uuid();
 check_evidencia jsonb;
BEGIN
 SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD139ORIGINAL');
 INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo) VALUES(prov,fx.org_a,'Fixture supplier','Logistico','Naviera');
 INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES(cli,fx.org_a,'Fixture client','fixture139original@test.local');
 INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,fx.org_a,'Fixture direct cost');
 INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
 VALUES(e,fx.org_a,cli,'DEMO-2026-139001','Aéreo','Importación'),(e2,fx.org_a,cli,'DEMO-2026-139002','Aéreo','Importación');
 INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda)
 VALUES(c,fx.org_a,e,prov,'Cost A',100,'MXN'),(c2,fx.org_a,e2,prov,'Cost B',100,'MXN');
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,embarque_id,folio_proveedor,categoria_presupuesto_id,fecha_emision,subtotal,total,moneda,estado,estado_aprobacion)
 VALUES(f,fx.org_a,prov,e,'TEST139',cat,public.fecha_negocio_mx(),100,100,'MXN','Vigente','aprobada');
 INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
 VALUES(fx.org_a,f,c,'Allocation',1,100);
 PERFORM pg_temp.as_user(fx.admin_a);
 PERFORM pg_temp.assert_cierre(e,100,1);
 -- 140: direct capture qualifies the existing evidence rule without inventing attachments.
 SELECT x INTO check_evidencia FROM jsonb_array_elements(public.validar_cierre_embarque(e)->'checks') x WHERE x->>'regla'='facturas_entrantes_evidencia';
 PERFORM pg_temp.assert((check_evidencia->>'ok')::boolean, '140 direct capture remains valid evidence alternative');
 SELECT x INTO check_evidencia FROM jsonb_array_elements(public.validar_cierre_embarque(e2)->'checks') x WHERE x->>'regla'='facturas_entrantes_evidencia';
 PERFORM pg_temp.assert(NOT (check_evidencia->>'ok')::boolean, '140 no inbox or linked invoice remains pending');
 INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,estado)
 VALUES(nc,fx.org_a,f,public.fecha_negocio_mx(),40,40,'MXN','Borrador');
 PERFORM pg_temp.assert_cierre(e,100,1);
 UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=nc;
 PERFORM pg_temp.assert_cierre(e,100,1);
 UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=nc;
 PERFORM pg_temp.assert_cierre(e,60,1);
 PERFORM public.aprobar_factura_proveedor(f,true,'Fixture expense without attachment',(SELECT updated_at FROM public.proveedor_facturas WHERE id=f));
 INSERT INTO public.pagos_proveedor(organization_id,proveedor_factura_id,fecha_pago,monto,moneda,metodo_pago)
 VALUES(fx.org_a,f,public.fecha_negocio_mx(),60,'MXN','Efectivo');
 PERFORM pg_temp.assert_cierre(e,0,0);
 PERFORM pg_temp.assert((public.saldo_factura_proveedor(f)->>'saldo')::numeric=0,'139 canonical invoice agrees with closure');
 UPDATE public.proveedor_notas_credito SET estado='Cancelada' WHERE id=nc;
 PERFORM pg_temp.assert_cierre(e,40,1);
 -- Separate invoice in USD, full MXN credit at explicit canonical rate.
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,embarque_id,folio_proveedor,categoria_presupuesto_id,fecha_emision,subtotal,total,moneda,tipo_cambio_usd,estado)
 VALUES(f2,fx.org_a,prov,e2,'TEST139-USD',cat,public.fecha_negocio_mx(),1,1,'USD',20,'Vigente');
 INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,tipo_cambio,tipo_cambio_mxn,estado)
 VALUES(nc2,fx.org_a,f2,public.fecha_negocio_mx(),20,20,'MXN',20,1,'Borrador');
 UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=nc2;
 UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=nc2;
 PERFORM pg_temp.assert_cierre(e2,0,0);
 PERFORM pg_temp.assert((public.saldo_factura_proveedor(f2)->>'saldo')::numeric=0,'139 FX credit agrees with invoice');
 -- Allocation without header must participate, and moving header cannot double-count.
 UPDATE public.proveedor_facturas SET embarque_id=e2 WHERE id=f;
 PERFORM pg_temp.assert_cierre(e,40,1);
 PERFORM pg_temp.assert_cierre(e2,0,0);
 -- Two shipments share one invoice: each gets half the residual, once.
 UPDATE public.proveedor_facturas_conceptos SET monto=50 WHERE proveedor_factura_id=f AND concepto_costo_id=c;
 INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
 VALUES(fx.org_a,f,c2,'Shared allocation',1,50);
 PERFORM pg_temp.assert_cierre(e,20,1);
 PERFORM pg_temp.assert_cierre(e2,20,1);
 UPDATE public.proveedor_facturas SET embarque_id=NULL WHERE id=f;
 PERFORM pg_temp.assert_cierre(e,20,1);
 PERFORM pg_temp.assert_cierre(e2,20,1);
 PERFORM pg_temp.as_user(fx.admin_b);
 BEGIN
   PERFORM public.validar_cierre_embarque(e);
   RAISE EXCEPTION '139 cross-tenant diagnosis unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM pg_temp.as_postgres();
END $$;
ROLLBACK;
